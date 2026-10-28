import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { rehashInlineScripts } from './lib/csp-rehash.mjs';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const port = await new Promise(resolve => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1', () => {
    const free = socket.address().port;
    socket.close(() => resolve(free));
  });
});
const base = `http://127.0.0.1:${port}`;
const results = [], cache = new Map();
let server, browser, complete = false;

async function settle(page) {
  await page.waitForFunction(() => document.querySelector('#sheetState').dataset.s === 'ok' && !sheetBusy);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function closeContext(context) {
  await context.unrouteAll({ behavior: 'wait' });
  await context.close();
}
async function open(viewport, html = source) {
  const context = await browser.newContext({ viewport, locale: 'ko-KR' });
  try {
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base) {
        if (url.pathname === '/index.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
        return route.continue();
      }
      if (url.hostname !== 'cdn.jsdelivr.net') return route.abort(); // No Firebase, accounts or paid services.
      if (!cache.has(url.href)) cache.set(url.href, (async () => {
        const response = await route.fetch({ timeout: 15000 });
        const headers = response.headers();
        for (const key of ['content-encoding', 'content-length', 'transfer-encoding']) delete headers[key];
        return { status: response.status(), headers, body: await response.body() };
      })());
      return route.fulfill(await cache.get(url.href));
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => typeof showEditor === 'function');
    await page.evaluate(() => {
      sets = [normSet({ id: 'navigation-synthetic', name: '시험지 이동 점검', problems: Array.from({ length: 12 }, (_, i) => ({
        id: 'nav-q' + (i + 1), span: 'col', blocks: [{ type: 'statement', data: { text: i === 11 ? Array.from({ length: 20 }, (_, line) => `SYNTHETIC 12번 조건 ${line + 1}: 모든 실수 $x$에 대하여 함수 $f(x)=x^2$가 다음 조건을 만족한다고 할 때, 주어진 조건을 이용하여 함수의 값을 구하시오.`).join("\n") : `SYNTHETIC ${i + 1}번. 함수 $f(x)=x^2$의 값을 구하시오.` } }],
      })) }, { keepId: true })];
      showEditor(sets[0].id);
    });
    await page.locator(viewport.width > 1023 ? '#viewSeg [data-view="sheet"]' : '.pane-tab[data-pane="sheet"]').click();
    await settle(page);
    return { page, context };
  } catch (error) { await closeContext(context); throw error; }
}
async function state(page) {
  return page.evaluate(() => {
    const rect = e => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const hit = selector => {
      const e = document.querySelector(selector), r = e.getBoundingClientRect();
      const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!target && (target === e || e.contains(target));
    };
    const pane = document.querySelector('#sheetPane'), sc = document.querySelector('#sheetScroll');
    return {
      nav: hit('#sheetPageSel'), zoom: hit('#sheetZoomBtn'), outer: [pane.scrollTop, document.querySelector('#editorView').scrollTop, document.querySelector('#appMain').scrollTop, scrollY],
      pane: rect(pane), scroll: rect(sc), clientHeight: sc.clientHeight,
      page: document.querySelector('#sheetPageSel').value, selected: currentQId,
      inspector: document.querySelector('#sheetInspectorDetails')?.open,
    };
  });
}
function tools(state) {
  assert(state.nav && state.zoom && state.outer.every(value => value === 0), 'Preview tools must remain visible and outer panels stationary');
}
async function oversized(page) {
  await page.evaluate(() => selectSheetProblem('nav-q12'));
  if (await page.evaluate(() => SHEET_NARROW())) {
    assert.equal(await page.locator('#sheetInspectorDetails').evaluate(e => e.open), true, 'Explicit selection reveals problem settings');
    await page.locator('#sheetInspectorToggle').click();
  }
  await page.locator('#sheetZoomBtn').click();
  const heading = await page.evaluate(() => {
    const sc = document.querySelector('#sheetScroll'), v = sc.getBoundingClientRect();
    const q = document.querySelector('#sheetStage .pq[data-qid="nav-q12"]');
    const r = q.querySelector('.pq-header').getBoundingClientRect();
    return { viewport:{top:v.top,bottom:v.bottom,left:v.left,right:v.right,height:sc.clientHeight,scrollTop:sc.scrollTop},heading:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},questionHeight:q.getBoundingClientRect().height, oversized: q.getBoundingClientRect().height > sc.clientHeight, visible: r.top >= v.top - 1 && r.bottom <= v.bottom + 1 && r.left >= v.left - 1 && r.right > v.left };
  });
  assert(heading.oversized && heading.visible, 'Oversized question must show its heading at 100 percent: '+JSON.stringify(heading));
  tools(await state(page));
  await page.locator('#sheetZoomBtn').click();
}
async function repairClipping(page) {
  assert(await page.evaluate(() => (sheetIssues.get('nav-q12') || []).some(item => item.kind === 'clip')), 'Long-question fixture must begin with a clipping warning');
  await page.locator('#sheetIssuesBtn').click();
  await page.locator('#sheetIssues button').first().click();
  await page.waitForFunction(() => currentQId === 'nav-q12');
  await page.locator('#sheetSpan button[data-v="page"]').click();
  await settle(page);
  const repaired = await page.evaluate(() => ({ span: activeQ().span, id: activeQ().id, issues: sheetIssues.get('nav-q12') || [], current: sheetKey() === sheetShownKey, page: document.querySelector('#sheetStage .pq[data-qid="nav-q12"]')?.closest('.page').className }));
  assert(repaired.span === 'page' && !repaired.issues.some(item => item.kind === 'clip') && repaired.current, 'Full-page layout resolves clipping in the selected long question: '+JSON.stringify(repaired));
  await page.keyboard.press('ControlOrMeta+z');
  await settle(page);
  const restored = await page.evaluate(() => ({ id: activeQ().id, span: activeQ().span, q12span: activeSet().problems.find(q => q.id === 'nav-q12')?.span, issues: (sheetIssues.get('nav-q12') || []).map(item => item.kind), state: document.querySelector('#sheetState').dataset.s, current: sheetKey() === sheetShownKey }));
  assert(restored.q12span === 'col' && restored.issues.includes('clip') && restored.current, 'Undo restores original layout and its clipping warning: '+JSON.stringify(restored));
  if (await page.locator('#sheetIssues').isVisible()) await page.locator('#sheetIssuesBtn').click();
  if (await page.evaluate(() => SHEET_NARROW()) && await page.locator('#sheetInspectorDetails').evaluate(e => e.open)) await page.locator('#sheetInspectorToggle').click();
}
async function scope(page, kind) {
  // Simulate a taller source/settings panel: ancestor scrolling must remain
  // prohibited even if a future layout or the on-screen keyboard creates overflow.
  await page.locator('.sheet-body').evaluate(e => { e.style.flex = '0 0 auto'; e.style.minHeight = '900px'; });
  try {
    if (kind === 'page') await page.evaluate(() => gotoSheetPage(6));
    else if (kind === 'selection') await page.evaluate(() => selectSheetProblem('nav-q12'));
    else {
      await page.evaluate(() => selectSheetProblem('nav-q12'));
      await page.locator('#sheetZoomBtn').click();
    }
    const s = await state(page);
    assert(s.outer.every(value => value === 0) && s.nav && s.zoom, 'Only paper viewport may scroll: ' + kind);
  } finally {
    await page.locator('.sheet-body').evaluate(e => { e.style.flex = ''; e.style.minHeight = ''; });
  }
}
async function sourceOpen(page) {
  if (await page.locator('#sheetInspectorDetails').evaluate(e => e.open) && await page.evaluate(() => SHEET_NARROW())) await page.locator('#sheetInspectorToggle').click();
  await page.locator('#sheetSrcBtn').click();
  await page.waitForFunction(() => !document.querySelector('#sheetSrc').hidden);
  await page.evaluate(() => renderSheetSource(true));
  await settle(page);
  const beforeDisclosure = await page.locator('#sheetScroll').evaluate(e => ({ height: e.clientHeight, top: e.getBoundingClientRect().top }));
  await page.evaluate(async () => { selectSheetProblem('nav-q11'); await renderSheetSource(true); });
  await settle(page);
  if (await page.evaluate(() => SHEET_NARROW())) {
    const afterDisclosure = await page.locator('#sheetScroll').evaluate(e => ({ height: e.clientHeight, top: e.getBoundingClientRect().top }));
    assert(Math.abs(afterDisclosure.height - beforeDisclosure.height) <= 1 && Math.abs(afterDisclosure.top - beforeDisclosure.top) <= 1, 'Problem settings must not displace paper viewport');
  }
  const inspect = () => page.evaluate(() => {
    const pane = document.querySelector('#sheetPane').getBoundingClientRect();
    const sc = document.querySelector('#sheetScroll'), r = sc.getBoundingClientRect();
    const body = document.querySelector('.sheet-body');
    return { fits: r.top >= pane.top - 1 && r.bottom <= pane.bottom + 1, useful: sc.clientHeight >= Math.min(120, body.clientHeight / 4), height: sc.clientHeight };
  });
  let measured = await inspect();
  assert(measured.fits && measured.useful, 'Source comparison must leave a visible paper viewport');
  // Layout fixture only: existing source tests verify actual file/IDB/PDF paths.
  // An actual decoded tall image exercises the source viewer's intrinsic height.
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 1000;
    const image = new Image(); image.alt = '합성 원본'; image.src = canvas.toDataURL('image/png'); await image.decode();
    document.querySelector('#sheetSrcView').replaceChildren(image);
    document.querySelector('#sheetSrcMsg').textContent = '';
  });
  await settle(page);
  measured = await inspect();
  assert(measured.fits && measured.useful, 'Source comparison must leave a visible paper viewport');
  tools(await state(page));
  if (await page.evaluate(() => SHEET_NARROW())) {
    if (!await page.locator('#sheetInspectorDetails').evaluate(e => e.open)) await page.locator('#sheetInspectorToggle').click();
    assert.equal(await page.locator('#sheetInspectorDetails').evaluate(e => e.open), true, 'Escape control must begin with settings open');
    await page.locator('#sheetSpan button[data-v="col"]').focus();
    await page.keyboard.press('Escape');
    const escaped = await page.evaluate(() => !document.querySelector('#sheetInspectorDetails').open && document.activeElement.id === 'sheetInspectorToggle');
    assert(escaped, 'Escape closes settings and restores disclosure focus');
  }
  await page.locator('#sheetSrcBtn').click();
  await page.waitForFunction(() => document.querySelector('#sheetSrc').hidden);
}
async function normal(viewport) {
  const { page, context } = await open(viewport);
  try {
    const before = await state(page); tools(before);
    assert(before.scroll.bottom <= before.pane.bottom + 1 && before.scroll.top >= before.pane.top && before.clientHeight > 0, 'Paper viewport must fit the visible pane');
    assert.equal(before.inspector, viewport.width > 1023, 'Narrow inspector starts collapsed; desktop stays expanded');
    if (viewport.width <= 1023) {
      await page.locator('#sheetInspectorToggle').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#sheetInspectorDetails').evaluate(e => e.open), true, 'Keyboard opens problem settings');
      await page.keyboard.press('Space');
      assert.equal(await page.locator('#sheetInspectorDetails').evaluate(e => e.open), false, 'Keyboard closes problem settings');
    }
    const signature = () => page.evaluate(() => [...document.querySelectorAll('#sheetStage .page')].map(pg => ({
      width: pg.offsetWidth, height: pg.offsetHeight, questions: [...pg.querySelectorAll('.pq')].map(q => ({ id: q.dataset.qid, text: q.querySelector('.content').textContent, transform: q.style.transform })),
    })));
    const original = await signature();
    await page.locator('#sheetPageSel').selectOption('6'); tools(await state(page));
    assert.equal((await state(page)).page, '6', 'Last page selected');
    await page.locator('#sheetPrev').click(); assert.equal((await state(page)).page, '5');
    await page.locator('#sheetNext').click(); assert.equal((await state(page)).page, '6');
    await sourceOpen(page);
    await repairClipping(page);
    await oversized(page);
    assert.deepEqual(await signature(), original, 'Navigation and zoom preserve printed page content and dimensions');
    for (const kind of ['page', 'selection', 'zoom']) await scope(page, kind);
    await page.setViewportSize({ width: viewport.width > 1023 ? 768 : 1194, height: 1024 });
    await page.waitForFunction(() => document.querySelector('#sheetInspectorDetails').open === !SHEET_NARROW());
    assert.equal((await state(page)).selected, 'nav-q12', 'Resize preserves selection');
    results.push({ viewport, passed: true, pages: original.length });
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => document.querySelector('#sheetInspectorDetails').open === !SHEET_NARROW());
    if (viewport.width <= 1023 && await page.locator('#sheetInspectorDetails').evaluate(e => e.open)) await page.locator('#sheetInspectorToggle').click();
    await page.evaluate(() => { sheetZoomFit = true; layoutSheetScale(); syncSheetSelection(true); });
    await settle(page);
    tools(await state(page));
    await page.screenshot({ path: `test-results/sheet-navigation/${viewport.width}-preview.png`, fullPage: true });
  } finally { await closeContext(context); }
}

const redCases = [
  { name: 'selection-scope', before: '  if(box && scroll) scrollSheetTo(box);', after: '  if(box && scroll) box.scrollIntoView({block:"center",behavior:"auto"});', target: 'Only paper viewport may scroll: selection', run: p => scope(p, 'selection') },
  { name: 'page-scope', before: '  if(pg) scrollSheetTo(pg,{block:"start"});', after: '  if(pg) pg.scrollIntoView({block:"start",behavior:"auto"});', target: 'Only paper viewport may scroll: page', run: p => scope(p, 'page') },
  { name: 'zoom-scope', before: '  if(box) scrollSheetTo(box,{inline:"center"});', after: '  if(box) box.scrollIntoView({block:"center",inline:"center",behavior:"auto"});', target: 'Only paper viewport may scroll: zoom', run: p => scope(p, 'zoom') },
  { name: 'visible-height', before: '  .sheet-scroll{padding:12px 8px;min-height:0}', after: '  .sheet-scroll{padding:12px 8px;min-height:480px}', target: 'Paper viewport must fit the visible pane', run: async p => {
    const s = await state(p);
    assert(s.scroll.bottom <= s.pane.bottom + 1 && s.scroll.top >= s.pane.top, 'Paper viewport must fit the visible pane');
  } },
  { name: 'narrow-disclosure', before: 'const resetSheetInspector=()=>{ $("#sheetInspectorDetails").open=!sheetInspectorViewport.matches; };', after: 'const resetSheetInspector=()=>{ $("#sheetInspectorDetails").open=true; };', target: 'Narrow inspector starts collapsed', run: async p => {
    assert.equal((await state(p)).inspector, false, 'Narrow inspector starts collapsed');
  } },
  { name: 'source-bounds', before: '.sheet-src{flex:0 1 auto;width:auto;min-width:0;max-width:none;max-height:50%;overflow:auto;', after: '.sheet-src{flex:0 0 auto;width:auto;min-width:0;max-width:none;max-height:60vh;', target: 'Source comparison must leave a visible paper viewport', run: sourceOpen },
  { name: 'inspector-overlay', before: '.sheet-insp-content{position:absolute;', after: '.sheet-insp-content{position:static;', target: 'Problem settings must not displace paper viewport', run: sourceOpen },
  { name: 'escape-close', before: 'if(e.key==="Escape" && SHEET_NARROW() && e.currentTarget.open){', after: 'if(e.key==="__disabled_escape__" && SHEET_NARROW() && e.currentTarget.open){', target: 'Escape closes settings and restores disclosure focus', run: sourceOpen },
  { name: 'oversized-heading' , before: 'Math.max(0,(sc.clientHeight-r.height)/2)', after: '((sc.clientHeight-r.height)/2)', target: 'Oversized question must show its heading at 100 percent', run: oversized },
];
async function red(test) {
  assert.equal(source.split(test.before).length, 2, 'RED source anchor must be unique: ' + test.name);
  const html = rehashInlineScripts(source.replace(test.before, test.after));
  const { page, context } = await open({ width: 375, height: 812 }, html);
  let error;
  try { await test.run(page); } catch (e) { error = e; }
  finally { await closeContext(context); }
  assert(error?.code === 'ERR_ASSERTION' && error.message.includes(test.target), 'RED must fail its specific target: ' + test.name + '; ' + (error?.message || 'unexpected pass'));
  results.push({ red: test.name, target: test.target, detected: true });
}
async function stopServer() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const stopped = new Promise(resolve => server.once('exit', resolve));
  server.kill();
  const timer = setTimeout(() => server.kill('SIGKILL'), 2000);
  try { await stopped; } finally { clearTimeout(timer); }
}

await mkdir('test-results/sheet-navigation', { recursive: true });
try {
  server = spawn('python3', ['serve.py', '--port', String(port)], { stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, 'Owned UI server must start');
  browser = await chromium.launch();
  for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1194, height: 834 }]) await normal(viewport);
  for (const test of redCases) await red(test);
  complete = true;
} finally {
  const cleanup = await Promise.allSettled([browser?.close(), stopServer()]);
  if (cleanup.some(item => item.status === 'rejected')) { complete = false; process.exitCode = 1; }
  await writeFile('test-results/sheet-navigation/results.json', JSON.stringify({ complete, scope: 'synthetic local UI; all backend traffic blocked', results, cleanup: cleanup.map(item => item.status) }, null, 2) + '\n');
}
console.log('Preview navigation: 3 viewports and 9 specific RED targets passed.');
