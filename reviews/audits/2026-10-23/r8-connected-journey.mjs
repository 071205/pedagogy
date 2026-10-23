import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// In its audited location this resolves to the repository root. The override
// only supports validating a candidate copy before it enters the repository.
const root = resolve(process.env.R8_REPO_ROOT || fileURLToPath(new URL('../../../', import.meta.url)));
const out = process.env.R8_OUT_DIR
  ? resolve(process.env.R8_OUT_DIR) : await mkdtemp(join(tmpdir(), 'pedagogy-r8-'));
await mkdir(out, { recursive: true });
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const { observeStaticChild } = await import(
  pathToFileURL(join(root, 'scripts/serve-static-staging.mjs')).href);
const port = await new Promise(resolve => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1', () => {
    const value = socket.address().port;
    socket.close(() => resolve(value));
  });
});
const base = `http://127.0.0.1:${port}`;
let server;
let lifecycle;
let browser;
const results = [];
const redMode = process.env.R8_RED || '';
const redControl = redMode === 'drop-result-local';
const editPrint = process.env.R8_EDIT_PRINT === '1';
if (redMode && !['drop-result-local', 'drop-edit', 'blank-print'].includes(redMode)) throw Error('Unknown R8_RED');
if (['drop-edit', 'blank-print'].includes(redMode) && !editPrint) throw Error('R8_EDIT_PRINT=1 required');
const settled = page => page.waitForFunction(() => !document.querySelector('.cmp-content')?.disabled);
const canonical = items => items.map(({ payload }) => payload)
  .sort((a, b) => a.title.localeCompare(b.title, 'ko'));

async function waitForOwnedServer() {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const terminal = lifecycle.status();
    if (terminal) throw Error(`Owned serve.py exited before readiness (${terminal.error ? 'spawn error' : 'exit'})`);
    try {
      const response = await fetch(base + '/health', { signal: AbortSignal.timeout(400) });
      if (response.ok && !lifecycle.status()) return;
    } catch { /* Not yet listening on this owned loopback port. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Owned serve.py readiness timed out');
}

async function inventory(page) {
  return page.evaluate(() => {
    const payload = p => ({ title: p.title, answer: p.answer, desc: p.desc || '',
      blocks: p.blocks });
    const entries = list => list.flatMap(set => set.problems.map(p => ({ id: p.id,
      payload: payload(p) })));
    return { original: entries(sets.filter(set => set.id === 'r8-original')),
      results: entries(sets.filter(set => set.id !== 'r8-original')) };
  });
}

function assertInventory(actual, original, label, expectedResults = original.original) {
  assert.equal(actual.original.length, 8, `${label}: original count`);
  assert.equal(actual.results.length, 8, `${label}: result count`);
  assert.deepEqual(canonical(actual.original), canonical(original.original),
    `${label}: original body payload`);
  assert.deepEqual(canonical(actual.results), canonical(expectedResults),
    `${label}: result body payload`);
  const resultIds = actual.results.map(item => item.id);
  assert.equal(new Set(resultIds).size, 8, `${label}: unique result IDs`);
  const sourceIds = new Set(original.original.map(item => item.id));
  assert.ok(resultIds.every(id => !sourceIds.has(id)), `${label}: newly issued result IDs`);
}

async function planSnapshot(page) {
  return page.evaluate(async () => {
    const client = createIntakeStorageClient({ editorsConfirmed: true });
    const job = (await client.listJobs()).find(item => item.name === 'R8 합성 원본');
    if (!job) throw Error('synthetic composition job missing');
    return (await client.readComposition(job.id)).composition;
  });
}

async function seed(page) {
  await page.evaluate(async () => {
    localStorage.clear();
    currentUser = null; authEpoch++; fbReady = false; intakeCloudReady = false;
    const problem = i => ({
      id: `q${i}`, title: `합성 함수 문항 ${i}`, answer: String(i),
      blocks: [{ type: 'statement', data: { text: `합성 본문 ${i}: f(x)=x+${i}의 값을 구하시오.` } }],
      intake: { version: 1, sources: [], units: [{ value: `단원${i}`, origin: 'user' }],
        difficulty: null, points: null, pointsState: 'absent',
        contentReview: 'reviewed', classificationReview: 'reviewed' },
    });
    sets = [normSet({ id: 'r8-original', name: 'R8 합성 원본', subject: 'math',
      problems: Array.from({ length: 8 }, (_, i) => problem(i + 1)) }, { keepId: true })];
    localDirty = true;
    if (!writeLocalNow()) throw Error('synthetic original did not persist');
    renderLibrary();
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='), x => x.charCodeAt(0));
    const file = new File([png], 'r8-synthetic-source.png', { type: 'image/png' });
    const renderer = { count: async () => 1,
      page: async () => ({ imageBase64: '', mimeType: 'image/png', width: 1, height: 1, bytes: png.length }) };
    const client = createIntakeStorageClient({ editorsConfirmed: true, renderer });
    const { sourceId } = await client.registerSource(file, 'r8-original');
    await client.assignPages('r8-original', 'q1', [{ sourceId, pages: [1] }]);
  });
}

// This optional extension preserves the original journey's offline boundary.
// It exercises the UI print preparation and Chromium PDF output, not an OS dialog.
async function editAndPrint(page, viewport, result, mark) {
  const before = await page.evaluate(() => ({ setId: currentSetId, questionId: currentQId,
    question: JSON.parse(JSON.stringify(activeProblems().find(q => q.id === currentQId))) }));
  assert.ok(before.question, 'an adopted question must be selected');
  const body = ['R8-EDIT-BEGIN', ...Array.from({ length: 12 }, (_, i) =>
    `편집한 긴 본문 ${i + 1}: 두 정수의 합과 차를 구하고 풀이 과정을 쓰시오.`), 'R8-EDIT-END'].join('\n');
  if (!await page.getByLabel('문항 제목', { exact: true }).isVisible()) await page.locator('#metaHead').click();
  await page.getByLabel('문항 제목', { exact: true }).fill('R8-EDIT-TITLE');
  await page.getByLabel('문항 정답', { exact: true }).fill('R8-EDIT-ANSWER');
  await page.getByLabel('문제 본문', { exact: true }).fill(body);
  await page.waitForFunction(({ setId, questionId, body }) => {
    const saved = JSON.parse(localStorage.getItem('PM_SETS_V7:guest') || '[]');
    const q = saved.find(s => s.id === setId)?.problems.find(q => q.id === questionId);
    return q?.title === 'R8-EDIT-TITLE' && q.answer === 'R8-EDIT-ANSWER' && q.blocks[0]?.data?.text === body;
  }, { ...before, body });
  const after = await page.evaluate(() => JSON.parse(JSON.stringify(activeProblems().find(q => q.id === currentQId))));
  assert.equal(after.id, before.questionId, 'editing retains adopted question ID');
  const sheetButton = viewport.width < 1024 ? '.pane-tab[data-pane="sheet"]' : '#viewSeg button[data-view="sheet"]';
  await page.locator(sheetButton).click();
  await page.waitForFunction(() => document.querySelector('#sheetState')?.dataset.s === 'ok' && !sheetBusy);
  assert.match(await page.locator('#sheetStage').innerText(), /R8-EDIT-END/);
  await page.locator('#sheetEditBtn').click();
  await page.evaluate(() => { window.__r8PrintCalls = 0; window.print = () => { window.__r8PrintCalls++; }; });
  const dialogs = [];
  const acceptFallback = async dialog => { dialogs.push(dialog.message()); await dialog.accept(); };
  page.on('dialog', acceptFallback);
  try {
    await page.locator('#printBtn').click();
    await page.locator('#exportWithAns').click();
    await page.waitForFunction(() => window.__r8PrintCalls === 1 && !printing);
  } finally { page.off('dialog', acceptFallback); }
  assert.equal(dialogs.length, 1, 'offline missing KaTeX explicitly asks for fallback printing');
  assert.match(dialogs[0], /KaTeX/);
  const appPages = await page.locator('#printDoc .page').count();
  assert.ok(appPages > 0);
  if (redMode === 'blank-print') {
    await page.locator('#printDoc .content').evaluateAll(nodes => nodes.forEach(node => node.textContent = ''));
    result.mutation = { kind: redMode, scope: 'isolated print DOM only' };
  }
  const pdfPath = join(out, `edit-print-${viewport.width}${redMode ? '-' + redMode : ''}.pdf`);
  const pdf = await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  const textPages = await page.evaluate(async data => {
    const pdfjs = await import('/vendor/pdfjs/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
    const task = pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false });
    try {
      const doc = await task.promise, pages = [];
      for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map(x => x.str || '').join(''));
      return pages;
    } finally { await task.destroy(); }
  }, Array.from(pdf));
  assert.equal(textPages.length, appPages, 'PDF page count matches prepared app pages');
  const text = textPages.join('');
  for (const marker of ['R8-EDIT-BEGIN', 'R8-EDIT-END', 'R8-EDIT-ANSWER'])
    assert.ok(text.includes(marker), `PDF retains edited payload: ${marker}`);
  assert.ok(!text.replace(/\s/g, '').includes('본문으로건너뛰기'), 'PDF excludes screen navigation');
  mark('UI edits → local persistence → sheet → prepared print → Chromium PDF', {
    editedQuestionIdRetained: true, bodyLines: 14, pdfPages: textPages.length,
    offlineFontFallbackAccepted: true, systemPrintDialogTested: false, pdfFile: pdfPath.split('/').pop() });
  if (redMode === 'drop-edit') {
    result.mutation = await page.evaluate(({ setId, questionId, question }) => {
      const key = 'PM_SETS_V7:guest', saved = JSON.parse(localStorage.getItem(key));
      const target = saved.find(s => s.id === setId);
      target.problems[target.problems.findIndex(q => q.id === questionId)] = question;
      localStorage.setItem(key, JSON.stringify(saved));
      return { kind: 'drop-edit', scope: 'isolated guest persisted edited question only' };
    }, before);
  }
  return { before: before.question, after };
}

async function runOne(viewport) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1194,
    locale: 'ko-KR' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === base ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const result = { viewport: `${viewport.width}×${viewport.height}`, steps: [],
    fixture: 'guest existing set + one synthetic image source; no PDF extraction or AI call' };
  let step = 'boot';
  const mark = (name, detail) => result.steps.push({ name, ...detail });
  try {
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => typeof compositionUI === 'object');
    await seed(page);
    const original = await inventory(page);
    let expectedResults = original.original;
    assert.equal(original.original.length, 8);
    assert.equal(original.results.length, 0);
    step = 'start from library';
    await page.getByRole('button', { name: '+ 새 문제집', exact: true }).click();
    await settled(page);
    await page.getByRole('menuitem', { name: /여러 권으로 새로 구성/ }).click();
    await settled(page);
    assert.equal(await page.getByRole('button', { name: 'PDF·사진 일괄 추출 준비 중' }).isEnabled(), false);
    await page.getByLabel('같은 브라우저의 다른 PEDAGOGY 탭을 닫았어요').check();
    await page.getByLabel('R8 합성 원본 · 8문항').check();
    await page.getByRole('button', { name: '선택한 문제집으로 구성 시작' }).click();
    await settled(page);
    mark('library → saved local composition', { aiCalls: 0 });

    step = 'five-book proposal';
    await page.getByLabel('원하는 권수', { exact: true }).fill('5');
    await page.getByRole('button', { name: '새 구성안 미리보기' }).click();
    await settled(page);
    const countApproval = page.getByLabel(/요청한 권수와 다른 .*권으로 적용할게요/);
    if (await countApproval.count()) await countApproval.check();
    await page.getByRole('button', { name: '새 구성안 적용' }).click();
    await settled(page);
    const destinations = await page.locator('.cmp-destinations button[aria-pressed]').count();
    assert.ok(destinations >= 3, 'proposal must create at least one destination');
    let bookCount = destinations - 2;
    mark('book proposal applied', { requested: 5, destinations: bookCount });

    step = 'move and undo';
    const beforeMove = await planSnapshot(page);
    await page.locator('.cmp-questions button').first().click();
    await settled(page);
    const originalBucket = await page.locator('.cmp-destinations button[aria-pressed=true]').innerText();
    await page.getByLabel('문항 목적지').selectOption({ index: 1 });
    await page.getByRole('button', { name: '이 목적지로 이동' }).click();
    await settled(page);
    const movedBucket = await page.locator('.cmp-destinations button[aria-pressed=true]').innerText();
    assert.notEqual(movedBucket, originalBucket);
    const afterMove = await planSnapshot(page);
    assert.notDeepEqual(afterMove.destinations.map(x => x.items),
      beforeMove.destinations.map(x => x.items), 'destination item lists must change');
    await page.getByRole('button', { name: '실행취소' }).click();
    await settled(page);
    const afterUndo = await planSnapshot(page);
    assert.deepEqual(afterUndo, beforeMove, 'Undo must restore entire plan snapshot');
    mark('misclassification move → Undo', { originalBucket, movedBucket,
      restoredPlanAndDestinationItems: true });

    step = 'source return';
    await page.locator('.cmp-destinations button[aria-pressed]').first().click();
    await settled(page);
    await page.locator('.cmp-questions button').first().click();
    await settled(page);
    await page.getByRole('button', { name: '원문 1 열기' }).click();
    await settled(page);
    await page.locator('.cmp-original img').waitFor();
    assert.match(await page.locator('.cmp-original').innerText(), /r8-synthetic-source.png/);
    mark('source opened from question detail', { source: 'synthetic PNG page 1' });

    step = 'manual fifth destination';
    if (bookCount < 5) {
      await page.getByLabel('새 목적지 이름').fill('R8 수동 추가 권');
      await page.getByRole('button', { name: '목적지 추가' }).click();
      await settled(page);
      const multi = page.locator('.cmp-destinations button[aria-pressed]')
        .filter({ hasText: /· [2-9]\d*$/ }).first();
      await multi.click();
      await settled(page);
      await page.locator('.cmp-questions button').first().click();
      await settled(page);
      await page.getByLabel('문항 목적지').selectOption({ label: 'R8 수동 추가 권' });
      await page.getByRole('button', { name: '이 목적지로 이동' }).click();
      await settled(page);
      bookCount++;
      assert.equal(bookCount, 5);
      mark('manual fifth destination and moved one item', { destinations: bookCount });
    }

    step = 'adopt results';
    await page.getByRole('button', { name: `문제집 ${bookCount}권 만들기` }).click();
    await page.getByRole('heading', { name: '만들기 결과' }).waitFor();
    const rows = await page.locator('.cmp-result').count();
    assert.equal(rows, bookCount);
    const statuses = await page.locator('.cmp-result p').allInnerTexts();
    assert.ok(statuses.every(x => /이 기기 저장됨.*로그인 전/.test(x)));
    const state = await page.evaluate(() => ({ count: sets.length,
      originalCount: sets.find(x => x.id === 'r8-original')?.problems.length,
      ids: sets.map(x => x.id) }));
    assert.equal(state.count, bookCount + 1);
    assert.equal(state.originalCount, 8);
    const adoptedInventory = await inventory(page);
    assertInventory(adoptedInventory, original, 'after adoption');
    mark('local guest results', { rows, statuses, setCount: state.count,
      uniqueNewQuestionIds: 8, bodyPayloadsPreserved: 8 });

    step = 'editor and sheet';
    await page.locator('.cmp-result').first().getByRole('button', { name: '편집기 열기' }).click();
    await page.waitForFunction(() => document.querySelector('#compositionDialog')?.open === false);
    const editor = await page.evaluate(() => ({ active: currentSetId, mode: editorMode }));
    assert.notEqual(editor.active, 'r8-original');
    const sheetButton = viewport.width < 1024
      ? '.pane-tab[data-pane="sheet"]' : '#viewSeg button[data-view="sheet"]';
    await page.locator(sheetButton).click();
    await page.waitForFunction(() => document.querySelector('#sheetState')?.dataset.s === 'ok' && !sheetBusy);
    const sheet = await page.evaluate(() => ({ mode: editorMode,
      pages: document.querySelectorAll('#sheetStage .page').length,
      active: currentSetId }));
    assert.equal(sheet.mode, 'sheet'); assert.ok(sheet.pages > 0);
    assert.equal(sheet.active, editor.active);
    await page.locator('#sheetEditBtn').click();
    assert.equal(await page.evaluate(() => editorMode), 'edit');
    mark('result editor ↔ sheet ↔ editor', { pages: sheet.pages, sameSet: true });

    if (editPrint) {
      step = 'edit persistence and PDF output';
      const edit = await editAndPrint(page, viewport, result, mark);
      expectedResults = adoptedInventory.results.map(item => item.id === edit.after.id
        ? { id: item.id, payload: { title: edit.after.title, answer: edit.after.answer, desc: edit.after.desc || '', blocks: edit.after.blocks } } : item);
    }

    step = 'reload and resume';
    if (redControl) {
      result.mutation = await page.evaluate(() => {
        const key = 'PM_SETS_V7:guest';
        const saved = JSON.parse(localStorage.getItem(key));
        const kept = saved.filter(set => set.id === 'r8-original');
        localStorage.setItem(key, JSON.stringify(kept));
        sets = kept;
        return { key, before: saved.length, after: kept.length,
          removedResultSets: saved.length - kept.length,
          mechanism: 'test-only isolated guest local storage and in-memory state mutation' };
      });
      assert.equal(result.mutation.removedResultSets, bookCount,
        'RED mutation must remove exactly the generated result sets');
      mark('RED control removes persisted result sets', result.mutation);
    }
    await page.reload();
    await page.waitForFunction(() => typeof compositionUI === 'object' && Array.isArray(sets));
    const after = await page.evaluate(() => ({ ids: sets.map(x => x.id),
      originalCount: sets.find(x => x.id === 'r8-original')?.problems.length }));
    assert.deepEqual(after.ids, state.ids, 'reload must retain generated result set IDs');
    assert.equal(after.originalCount, 8);
    assertInventory(await inventory(page), original, 'after reload', expectedResults);
    await page.getByRole('button', { name: '문제집 라이브러리로 이동' }).click();
    await page.getByRole('button', { name: '+ 새 문제집', exact: true }).click();
    await settled(page);
    await page.getByRole('menuitem', { name: /여러 권으로 새로 구성/ }).click();
    await settled(page);
    await page.getByLabel('같은 브라우저의 다른 PEDAGOGY 탭을 닫았어요').check();
    await page.getByRole('button', { name: /R8 합성 원본 · 8문항 · 만들기 결과 있음/ }).click();
    await settled(page);
    assert.equal(await page.locator('.cmp-result').count(), bookCount);
    mark('reload → preserved result IDs, payloads and composition',
      { unchangedIds: true, preservedInventory: 8, results: bookCount });
    result.complete = true;
  } catch (error) {
    result.complete = false;
    result.failedStep = step;
    result.error = error.message.slice(0, 600);
    result.message = await page.locator('.cmp-message').innerText().catch(() => '');
    await page.screenshot({ path: `${out}/journey-${viewport.width}-${redControl ? 'red-' : ''}failure.png`,
      fullPage: false }).catch(() => {});
  } finally {
    await context.close();
  }
  results.push(result);
}

try {
  server = spawn('python3', ['serve.py', '--port', String(port)], {
    cwd: root, stdio: 'ignore', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  lifecycle = observeStaticChild(server);
  await waitForOwnedServer();
  browser = await chromium.launch({ headless: true });
  const viewports = redMode ? [{ width: 1194, height: 834 }]
    : [{ width: 1194, height: 834 }, { width: 768, height: 1024 }, { width: 375, height: 812 }];
  for (const viewport of viewports) await runOne(viewport);
  await writeFile(`${out}/connected-journey${editPrint ? '-edit-print' : ''}${redMode ? '-' + redMode : ''}.json`,
    JSON.stringify(results, null, 2));
  for (const result of results) console.log(JSON.stringify({ viewport: result.viewport,
    complete: result.complete, failedStep: result.failedStep, error: result.error,
    steps: result.steps.map(x => x.name) }));
  if (results.some(x => !x.complete)) process.exitCode = 1;
} finally {
  const cleanup = await Promise.allSettled([
    browser ? browser.close() : Promise.resolve(),
    lifecycle ? lifecycle.stop({ timeoutMs: 3000 }) : Promise.resolve(),
  ]);
  for (const [index, result] of cleanup.entries()) {
    if (result.status === 'rejected') {
      process.exitCode = 1;
      console.error(`${index ? 'Owned server' : 'Temporary browser'} cleanup failed: ${result.reason.message}`);
    }
  }
  console.log(JSON.stringify({ cleanup: { temporaryBrowserClosed: cleanup[0].status === 'fulfilled',
    ownedServerStopped: cleanup[1].status === 'fulfilled',
    serverTerminal: lifecycle?.status()?.signal || lifecycle?.status()?.code || null }, output: out }));
}
