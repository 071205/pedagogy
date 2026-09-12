import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import * as playwright from 'playwright';
import { buildPublic } from './build-public.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await buildPublic(root);
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith('/pedagogy/')) throw Error('outside mount');
    const file = path.slice('/pedagogy/'.length) || 'index.html';
    if (!/^[a-zA-Z0-9_./-]+$/.test(file) || file.split('/').includes('..')) throw Error('invalid path');
    const content = await readFile(join(root, 'dist/public', file));
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8'
      : file.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
 for(const engine of (process.env.PUBLIC_ENGINES||'chromium').split(',')) {
  browser = await playwright[engine].launch({ headless: true });
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const file of ['index.html', 'mock-exam-editor.html', 'document-editor.html', 'legal.html']) {
    await page.goto(`${origin}/pedagogy/${file}`);
    await page.waitForLoadState('networkidle');
    assert.ok(await page.title());
    // Actual DOM references must resolve at a subpath, not accidentally from the source root.
    const assets = await page.locator('script[src],link[rel="stylesheet"][href]').evaluateAll(nodes =>
      nodes.map(node => node.src || node.href).filter(url => url.startsWith(location.origin + '/')));
    for (const url of assets) assert.equal((await fetch(url)).status, 200, url);
    if (file === 'index.html') assert.equal(await page.evaluate(() => typeof window.normSet), 'function');
    if(file !== 'legal.html') {
      const injected=await page.evaluate(()=>{
        window.__publicInjection=0;
        const script=document.createElement('script');script.textContent='window.__publicInjection++';
        document.head.append(script);script.remove();
        return window.__publicInjection;
      });
      assert.equal(injected,0,`${engine}/${file}: public CSP must block arbitrary script blocks`);
    }
    if(file==='index.html') {
      await page.evaluate(()=>{
        sets=[normSet({id:'public-test',name:'공개 빌드 검사',problems:[{blocks:[
          {type:'statement',data:{text:'본문 $x+1$'}}]}]},{keepId:true})];
        showEditor(sets[0].id);
        buildPrintDoc(false);
      });
      assert.equal(await page.locator('#editorView').isVisible(),true);
      assert.ok(await page.locator('#printDoc .pq').count(),'public print path must produce a question');
      await page.evaluate(()=>{showLibrary('mocks');newMock();});
      await page.frameLocator('#mockFrame').locator('#hostStatus[data-mock-id]').waitFor();
      await page.frameLocator('#mockFrame').locator('#round').fill('공개 빌드 모의고사');
      await page.waitForFunction(()=>mocks.some(e=>e.round==='공개 빌드 모의고사'),null,{timeout:10000});
    }
    if (file === 'index.html' || file === 'document-editor.html') {
      const token = await page.evaluate(async () => {
        window.firebase = { appCheck: () => ({ getToken: async () => ({ token: 'browser-app-check-token' }) }) };
        appCheckReady = true;
        return getAiAppCheckToken();
      });
      assert.equal(token, 'browser-app-check-token', `${file} must acquire the custom-backend token`);
      const failedClosed = await page.evaluate(async () => {
        window.firebase = { appCheck: () => ({ getToken: async () => { throw Error('attestation failed'); } }) };
        try { await getAiAppCheckToken(); return false; } catch { return true; }
      });
      assert.equal(failedClosed, true, `${file} must not silently omit a configured but failed token`);
    }
    if (file === 'mock-exam-editor.html') {
      const count = await page.evaluate(async () => {
        const bytes = await (await fetch('experiments/hwp-export/templates/exam-math.hwpx')).arrayBuffer();
        const { doc } = await window.PedagogyExamTemplate.openTemplate(bytes);
        return (await doc.toBlob()).size;
      });
      assert.ok(count > 1000, 'public exam template must open and serialize');
    }
    if (file === 'document-editor.html') {
      const count = await page.evaluate(async () => {
        const { blob } = await window.PedagogyHwpxDocument.buildDocument(
          { title: '빌드 검사', blocks: [{ type: 'paragraph', text: '본문' }] },
          'experiments/hwp-export/templates/blank.hwpx');
        return blob.size;
      });
      assert.ok(count > 1000, 'public document path must generate HWPX');
    }
  }
  for (const file of ['worker/index.js', 'reviews/INDEX.md', 'serve.py', '.git/config', 'index.html.map']) {
    assert.equal((await fetch(`${origin}/pedagogy/${file}`)).status, 404, file);
  }
  assert.deepEqual(errors, []);
  // Removing just the delivered policy must make the injection probe turn red.
  await page.route('**/pedagogy/index.html',async route=>{
    const response=await route.fetch();
    const body=(await response.text()).replace(/(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([\s\S]*?)(")/i,
      (_tag,a,policy,b)=>a+policy.replace("script-src 'self'","script-src 'self' 'unsafe-inline'")+b);
    await route.fulfill({response,body});
  });
  await page.goto(`${origin}/pedagogy/index.html`);
  assert.equal(await page.evaluate(()=>{
    window.__publicRed=0;const s=document.createElement('script');s.textContent='window.__publicRed++';
    document.head.append(s);return window.__publicRed;
  }),1,'public CSP removal must be detected');
  await context.close();
  const local=await browser.newPage();
  await local.route('https://**/*',route=>route.abort());
  await local.goto(pathToFileURL(join(root,'dist/public/index.html')).href);
  assert.equal(await local.evaluate(()=>typeof window.normSet),'function','classic external scripts preserve file://');
  await browser.close();browser=null;
  console.log(`Public artifact ${engine}: four pages, editing/print/mock save, strict CSP + red probe, file://, HWPX and private 404 passed`);
 }
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
