import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// A real PDF with a blue first page and red second page. No text/font/network dependency.
export function twoPagePdf() {
  const stream = text => `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 280] /Contents 4 0 R >>',
    stream('0 0 1 rg 20 20 160 240 re f'),
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 280] /Contents 6 0 R >>',
    stream('1 0 0 rg 20 20 160 240 re f'),
  ];
  let text = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(text.length); text += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  text += offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text, 'latin1');
}

const sheetButton = width => width < 1024 ? '.pane-tab[data-pane="sheet"]' : '#viewSeg button[data-view="sheet"]';
async function openSource(page, width) {
  await page.locator(sheetButton(width)).click();
  await page.waitForFunction(() => document.querySelector('#sheetState')?.dataset.s === 'ok' && !sheetBusy);
  if (!await page.evaluate(() => srcOpen)) await page.locator('#sheetSrcBtn').click();
}

async function assertPagePixels(page, number) {
  await page.waitForFunction(n => document.querySelector('#sheetSrcView canvas')?.getAttribute('aria-label') === `원본 ${n}쪽`, number);
  const pixel = await page.locator('#sheetSrcView canvas').evaluate(canvas =>
    Array.from(canvas.getContext('2d').getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data));
  assert.deepEqual(pixel, number === 1 ? [0, 0, 255, 255] : [255, 0, 0, 255], `PDF page ${number} actual raster pixels`);
}

async function sourceProof(page, setId, questionId, sourceId) {
  return page.evaluate(async ({ setId, questionId, sourceId }) => {
    const reader = await sheetSourceReader();
    const record = reader ? await reader.readLinked(setId, sourceId) : null;
    const q = sets.find(set => set.id === setId)?.problems.find(q => q.id === questionId);
    const blob = record?.blob;
    const digest = blob ? await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()) : null;
    return { sourceId, refs: q?.intake?.sources || [], blobPresent: !!blob, bytes: blob?.size,
      sha256: digest ? Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('') : null };
  }, { setId, questionId, sourceId });
}

export async function connectPdfSource({ page, viewport, out, mark, result, redMode }) {
  const before = await page.evaluate(() => ({ setId: currentSetId, questionId: currentQId,
    refs: structuredClone(activeQ()?.intake?.sources || []) }));
  assert.ok(before.setId && before.questionId, 'adopted question selected before source upload');
  const pdf = twoPagePdf(), sha256 = createHash('sha256').update(pdf).digest('hex');
  await writeFile(join(out, 'synthetic-source-two-pages.pdf'), pdf);
  await openSource(page, viewport.width);
  const dialogs = [];
  const handler = async dialog => {
    dialogs.push(dialog.message());
    if (/다른 탭을 닫았으면/.test(dialog.message())) await dialog.accept(); else await dialog.dismiss();
  };
  page.on('dialog', handler);
  try {
    // The first adopted book contains q2, whereas only original q1 had a source.
    // Establish an actual existing ref through the same manual UI before adding PDF.
    if (!before.refs.length) {
      const chooser = page.waitForEvent('filechooser');
      await page.locator('#sheetSrcAdd').click();
      const png64 = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
        canvas.getContext('2d').fillRect(0, 0, 16, 16);
        return canvas.toDataURL('image/png').split(',')[1];
      });
      await (await chooser).setFiles({ name: 'r8-existing-source.png', mimeType: 'image/png', buffer: Buffer.from(png64, 'base64') });
      await page.waitForFunction(() => document.querySelector('#sheetSrcView img')?.naturalWidth === 16);
      await page.locator('#sheetSrcAssign').click();
      await page.waitForFunction(() => activeQ()?.intake?.sources?.length > 0);
      before.refs = await page.evaluate(() => structuredClone(activeQ().intake.sources));
    }
    assert.ok(before.refs.length > 0, 'PDF prior-reference coverage requires existing source ref');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#sheetSrcAdd').click();
    await (await chooser).setFiles({ name: 'r8-real-two-pages.pdf', mimeType: 'application/pdf', buffer: pdf });
    await assertPagePixels(page, 1);
  } finally { page.off('dialog', handler); }
  assert.equal(dialogs.length, 1, 'manual source upload requires explicit other-tab confirmation');
  assert.match(dialogs[0], /다른 탭을 닫았으면/);
  const sourceId = await page.evaluate(() => srcCur?.sourceId);
  assert.ok(sourceId, 'UI upload supplies a source ID');
  await page.locator('#sheetSrcNext').click();
  if (redMode === 'blank-pdf-canvas') {
    await page.waitForFunction(() => document.querySelector('#sheetSrcView canvas')?.getAttribute('aria-label') === '원본 2쪽');
    await page.locator('#sheetSrcView canvas').evaluate(canvas => canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height));
    result.mutation = { kind: 'blank-pdf-canvas', scope: 'isolated source-view canvas pixels only; page label unchanged' };
  }
  await assertPagePixels(page, 2);
  await page.locator('#sheetSrcAssign').click();
  await page.waitForFunction(({ setId, questionId, sourceId }) => {
    const saved = JSON.parse(localStorage.getItem('PM_SETS_V7:guest') || '[]');
    return saved.find(s => s.id === setId)?.problems.find(q => q.id === questionId)?.intake?.sources
      ?.some(ref => ref.sourceId === sourceId && JSON.stringify(ref.pages) === '[2]');
  }, { ...before, sourceId });
  const actual = await sourceProof(page, before.setId, before.questionId, sourceId);
  assert.equal(actual.sha256, sha256, 'UI uploaded source Blob matches actual PDF bytes');
  assert.deepEqual(actual.refs, [...before.refs, { sourceId, pages: [2] }], 'PDF assignment preserves prior source refs');
  const proof = { ...before, sourceId, sha256, bytes: pdf.length, assignedPages: [2] };
  mark('actual PDF chooser → tab confirmation → blue/red rendering → page 2 assignment',
    { sourceId, bytes: pdf.length, sha256, pdfPages: 2, assignedPages: [2], priorRefCount: before.refs.length, priorRefsPreserved: true });
  await page.locator('#sheetEditBtn').click();
  return proof;
}

export async function dropPdfBlob(page, proof) {
  return page.evaluate(async sourceId => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('PM_INTAKE_V1');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('owners', 'readwrite'), store = tx.objectStore('owners');
        const request = store.get('guest');
        request.onsuccess = () => {
          const root = request.result;
          if (!root?.sources[sourceId]?.blob) { tx.abort(); return; }
          root.sources[sourceId].blob = null; store.put(root);
        };
        tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || Error('PDF RED target missing'));
      });
    } finally { db.close(); }
    return { kind: 'drop-pdf-source', sourceId, scope: 'isolated guest IDB source Blob only' };
  }, proof.sourceId);
}

export async function verifyPdfSourceReload({ page, viewport, proof, mark }) {
  const actual = await sourceProof(page, proof.setId, proof.questionId, proof.sourceId);
  assert.ok(actual.blobPresent, 'PDF source Blob retained after reload');
  assert.equal(actual.bytes, proof.bytes, 'PDF source byte count retained after reload');
  assert.equal(actual.sha256, proof.sha256, 'PDF source SHA retained after reload');
  assert.deepEqual(actual.refs, [...proof.refs, { sourceId: proof.sourceId, pages: [2] }], 'PDF page refs retained after reload');
  await page.locator('.cmp-result').first().getByRole('button', { name: '편집기 열기' }).click();
  await page.waitForFunction(() => document.querySelector('#compositionDialog')?.open === false);
  assert.equal(await page.evaluate(() => currentSetId), proof.setId, 'reopened same adopted set');
  if (viewport.width < 1024) await page.locator('.pane-tab[data-pane="list"]').click();
  await page.locator(`#qList .q-open[data-qid="${proof.questionId}"]`).click();
  await openSource(page, viewport.width);
  await page.locator('#sheetSrcSel').waitFor({ state: 'visible' });
  await page.locator('#sheetSrcSel').selectOption(proof.sourceId);
  await assertPagePixels(page, 2);
  assert.match(await page.locator('#sheetSrcPage').innerText(), /2 \/ 2쪽 · 이 문항: 2쪽/);
  mark('reload → exact PDF Blob/SHA/ref → reopened page 2 raster',
    { sameSourceId: true, sameQuestionId: true, exactBlob: true, assignedPages: [2] });
}


// RED removes the application's preservation of other source refs, with valid CSP.
export async function dropPriorRefsHtml(root) {
  let html = await readFile(join(root, 'index.html'), 'utf8');
  const from = 'const others=refs.filter(r=>r.sourceId!==cur.sourceId), mine=refs.find';
  assert.equal(html.split(from).length, 2, 'prior-ref mutation anchor');
  html = html.replace(from, 'const others=[], mine=refs.find');
  const tags = /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  const hashes = [...html.matchAll(tags)].filter(m => m[1] !== undefined && !/\bsrc\s*=/.test(m[1]))
    .map(m => `'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
  assert.equal(hashes.length, 3, 'mutation inline script count');
  let index = 0;
  return html.replace(/(script-src[^;]*?)((?:'sha256-[^']+'\s*)+)/,
    (_all, head, list) => head + list.replace(/'sha256-[^']+'/g, () => hashes[index++]));
}
