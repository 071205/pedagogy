import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as playwright from 'playwright';
import { buildGuest, verifyGuest } from './build-guest-preview.mjs';
import { PUBLIC_FILES } from './build-public.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'dist/guest-preview/dist/public');
const first=await buildGuest(root);
assert.deepEqual(await verifyGuest(root),first);
assert.deepEqual(Object.keys(first).sort(),[...PUBLIC_FILES]);
const config=await readFile(join(root,'dist/guest-preview/wrangler.toml'),'utf8');
assert.match(config,/name = "pedagogy-guest-preview"/);
assert.match(config,/directory = "\.\/dist\/public"/);
assert.doesNotMatch(config,/\[vars\]|\[durable_objects\]|main\s*=|secret/);

async function red(file, change, message) {
  const path=join(output,file), original=await readFile(path);
  try {
    await writeFile(path,change(original.toString('utf8')));
    await assert.rejects(verifyGuest(root),message);
  } finally { await writeFile(path,original); }
}
await red('index.html',s=>s.replace('게스트 미리보기 ·','미리보기 ·'),/Guest banner missing/);
await red('index.html',s=>s.replace("connect-src 'self'","connect-src 'self' https://firebaseappcheck.googleapis.com"),/Guest CSP contains backend origin/);
await red('index.html',s=>s.replace('</head>','<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script></head>'),/Firebase SDK in guest HTML/);
await red('index.html',s=>s.replace("frame-src 'self'","frame-src 'none'"),/Guest iframe policy missing/);
await red('assets/index-3.js',s=>s.replace('const AI_PROXY_URL="";','const AI_PROXY_URL="https://dawn-shape-2664.dbruddl79.workers.dev";'),/Production endpoint or identifier in guest asset/);
await red('service-config.js',s=>s.replace('guestPreview:true','guestPreview:false'),/Guest config flag missing/);
await red('index.html',s=>s.replace('</body>','<script>window.unsafe=1</script></body>'),/Inline script/);
await red('assets/index-3.js',s=>s.replace('if(window.PEDAGOGY_PUBLIC_CONFIG?.guestPreview) return;',''),/Guest runtime guard missing/);
await red('assets/mock-exam-editor-1.js',s=>s.replace('if(window.PEDAGOGY_PUBLIC_CONFIG?.guestPreview){LIVE.found=false;return false;}',''),/Guest runtime guard missing/);
await red('assets/document-editor-1.js',s=>s.replace('if(window.PEDAGOGY_PUBLIC_CONFIG?.guestPreview||!AI_PROXY_URL)','if(!AI_PROXY_URL)'),/Guest runtime guard missing/);
await red('assets/index-3.js',s=>s.replace('if(window.PEDAGOGY_PUBLIC_CONFIG?.guestPreview || !AI_PROXY_URL)','if(!AI_PROXY_URL)'),/Guest runtime guard missing/);
const metadata=join(root,'dist/guest-preview/guest-manifest.json');
const held=metadata+'.held';
await rename(metadata,held);
try {
  await symlink(held,metadata);
  await assert.rejects(verifyGuest(root),/Guest metadata must be a regular file/);
} finally { await rm(metadata); await rename(held,metadata); }
const guestParent=join(root,'dist/guest-preview/dist');
const heldParent=guestParent+'.held';
await rename(guestParent,heldParent);
try {
  await symlink(heldParent,guestParent);
  await assert.rejects(verifyGuest(root),/Guest dist parent must be a regular directory/);
} finally { await rm(guestParent); await rename(heldParent,guestParent); }
await writeFile(join(output,'private.txt'),'private decoy');
try { await assert.rejects(verifyGuest(root),/allowlist mismatch/); }
finally { await rm(join(output,'private.txt')); }


const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.split('/').includes('..')) throw Error('invalid path');
    const bytes=await readFile(join(output,path));
    res.setHeader('Content-Type',path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.js')?'application/javascript; charset=utf-8':'application/octet-stream');
    res.end(bytes);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser=await playwright.chromium.launch({headless:true});
  const context=await browser.newContext();
  const external=[],serverCalls=[],errors=[];
  await context.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(origin+'/')){
      if(/\/(?:health|render|hwpx|document-hwpx)(?:\?|$)/.test(url)) serverCalls.push(url);
      return route.continue();
    }
    external.push(url);
    return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/index.html');
  await page.waitForFunction(()=>typeof window.normSet==='function'&&typeof window.showEditor==='function');
  assert.equal(await page.locator('#guestPreviewBanner').isVisible(),true);
  assert.equal(await page.locator('#loginBtn').isDisabled(),true);
  assert.equal(await page.evaluate(()=>fbReady),false);
  await page.evaluate(()=>{
    sets=[normSet({id:'guest-test',name:'게스트 검사',problems:[{blocks:[{type:'statement',data:{text:'본문 $x+1$'}}]}]},{keepId:true})];
    currentSetId=sets[0].id;
    saveSets(null);
    showEditor(sets[0].id);
  });
  await page.locator('#metaHead').click();
  await page.locator('#qTitle').fill('화면에서 고친 제목');
  await page.locator('textarea[aria-label="문제 본문"]').first().fill('화면에서 고친 본문 $x+2$');
  await page.evaluate(()=>buildPrintDoc(false));
  assert.ok(await page.locator('#printDoc .pq').count());
  await page.reload();
  await page.waitForFunction(()=>typeof sets!=='undefined'&&sets.some(s=>s.id==='guest-test'));
  await page.waitForFunction(()=>document.querySelector('#editorView')?.style.display==='flex');
  assert.equal(await page.locator('#qTitle').inputValue(),'화면에서 고친 제목');
  assert.equal(await page.locator('textarea[aria-label="문제 본문"]').first().inputValue(),'화면에서 고친 본문 $x+2$');
  await page.evaluate(()=>{showLibrary('mocks');newMock();});
  await page.frameLocator('#mockFrame').locator('#guestPreviewBanner').waitFor();
  await page.frameLocator('#mockFrame').locator('#round').fill('게스트 모의고사');
  await page.waitForFunction(()=>mocks.some(e=>e.round==='게스트 모의고사'),null,{timeout:10000});
  assert.equal(await page.evaluate(async()=>{await aiGenerateFromImage(new File(['x'],'x.png',{type:'image/png'}));return true;}),true);
  await page.goto(origin+'/document-editor.html');
  assert.equal(await page.locator('#guestPreviewBanner').isVisible(),true);
  assert.equal(await page.locator('#loginBtn').isDisabled(),true);
  assert.equal(await page.locator('#draftBtn').isDisabled(),true);
  await page.locator('#json').fill(JSON.stringify({title:'게스트 문서',blocks:[{type:'paragraph',text:'본문'}]}));
  await page.locator('#validateBtn').click();
  assert.match(await page.locator('#docStatus').innerText(),/검증됨/);
  await page.reload();
  assert.match(await page.locator('#json').inputValue(),/게스트 문서/);
  await page.goto(origin+'/mock-exam-editor.html');
  assert.equal(await page.locator('#guestPreviewBanner').isVisible(),true);
  assert.equal(await page.evaluate(async()=>await pingServer()),false);
  assert.deepEqual(serverCalls,[],'guest pages must never probe server endpoints');
  assert.ok(external.every(url=>!/firebase|recaptcha|dawn-shape|identitytoolkit|securetoken|googleapis/.test(url)),external.join('\n'));
  for(const file of ['worker/index.js','serve.py','reviews/INDEX.md','.git/config','index.html.map'])
    assert.equal((await fetch(origin+'/'+file)).status,404,file);
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('Guest Chromium: local save/reload, print, mock iframe, document JSON, auth/AI/server guards, CSP and private 404 passed');
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
console.log('Guest RED: banner, CSP, SDK, iframe, endpoint, config, account/runtime guards, symlinks, private asset and inline injection detected');

