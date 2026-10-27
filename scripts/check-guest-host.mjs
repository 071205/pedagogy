import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer as httpServer } from 'node:http';
import { chromium } from 'playwright';
import { observeStaticChild, stopStaticStaging } from './serve-static-staging.mjs';
import { verifyGuest } from './build-guest-preview.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function ready(base, lifecycle) {
  for (let i = 0; i < 100; i++) {
    const ended = lifecycle.status();
    if (ended) throw Error(`Wrangler exited ${ended.code ?? ended.signal ?? ended.error} before readiness`);
    let response;
    try { response = await fetch(base + '/', { signal: AbortSignal.timeout(500) }); }
    catch { /* Local runtime is still starting. */ }
    if (lifecycle.status()) throw Error('Wrangler exited during readiness');
    if (response?.ok) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Local Wrangler did not become ready');
}

function normalizedMeta(html) {
  const raw = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"/i)?.[1];
  assert.ok(raw, 'Missing source CSP meta');
  return raw.replace(/\s+/g, ' ').trim();
}

async function checkResponse(base, path, asset, framing, manifest) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, `${path} did not serve an asset`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha(bytes), manifest[asset].sha256, `${path} differs from the verified build`);
  assert.equal(bytes.length, manifest[asset].bytes);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  if (asset.endsWith('.html')) {
    const policy = response.headers.get('content-security-policy');
    assert.equal(policy, `${normalizedMeta(bytes.toString('utf8'))}; frame-ancestors ${framing}`, 'Guest HTTP CSP must match verified framing');
    assert.equal((policy.match(/frame-ancestors/g) || []).length, 1);
  }
}

const remote = process.env.GUEST_HOST_BASE || '';
if(remote && !/^https:\/\/pedagogy-guest-preview\.[a-z0-9-]+\.workers\.dev$/.test(remote))
  throw Error('Remote verification requires the dedicated guest preview workers.dev origin');
const red = process.env.GUEST_HOST_RED || '';
if(remote && red) throw Error('Failure injection is local only');
if(red && !['drop-frame-headers','missing-library-view'].includes(red)) throw Error('Unknown guest host failure injection');
const manifest = await verifyGuest(root);
const port = remote ? 0 : await freePort();
let base = remote || `http://127.0.0.1:${port}`;
let lifecycle, clean = async()=>{}, proxy;
const state = remote ? null : await mkdtemp(join(tmpdir(),'pedagogy-guest-host-'));
if(!remote) {
  clean = async()=>{await rm(state,{recursive:true,force:true});};
  const env = Object.fromEntries(['HOME','PATH','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  env.WRANGLER_SEND_METRICS='false';
  try {
    const child=spawn(join(root,'node_modules/.bin/wrangler'),[
      'dev','--config',join(root,'dist/guest-preview/wrangler.toml'),'--local',
      '--ip','127.0.0.1','--port',String(port),'--inspector-ip','127.0.0.1',
      '--persist-to',state,'--log-level','warn','--no-show-interactive-dev-session'
    ],{cwd:state,stdio:['ignore','ignore','ignore'],env});
    lifecycle=observeStaticChild(child);
  }catch(error){await clean();throw error;}
}
let browser;
try {
  if(lifecycle) await ready(base, lifecycle);
  if(red==='drop-frame-headers') {
    const upstream=base;
    proxy=httpServer(async(req,res)=>{
      try {
        const response=await fetch(upstream+req.url,{redirect:'manual'});
        for(const [key,value] of response.headers) if(!['content-security-policy','transfer-encoding','content-encoding','content-length'].includes(key)) res.setHeader(key,value);
        res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()));
      }catch{res.writeHead(502);res.end();}
    });
    await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
    base='http://127.0.0.1:'+proxy.address().port;
  }
  // Every public byte except Cloudflare's private _headers control file.
  const files=Object.keys(manifest).filter(file=>file!=='_headers');
  for(let offset=0;offset<files.length;offset+=8) await Promise.all(files.slice(offset,offset+8).map(async file=>{
    const response=await fetch(base+'/'+file);
    assert.equal(response.status,200,'Guest manifest asset: '+file);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length,manifest[file].bytes,file);
    assert.equal(sha(bytes),manifest[file].sha256,'Guest manifest SHA: '+file);
  }));
  for (const [path, asset, framing] of [
    ['/', 'index.html', "'none'"], ['/index.html?probe=1', 'index.html', "'none'"],
    ['/index?probe=1', 'index.html', "'none'"],
    ['/document-editor', 'document-editor.html', "'none'"],
    ['/document-editor.html?probe=1', 'document-editor.html', "'none'"],
    ['/legal', 'legal.html', "'none'"], ['/legal.html', 'legal.html', "'none'"],
    ['/mock-exam-editor', 'mock-exam-editor.html', "'self'"],
    ['/mock-exam-editor.html?probe=1', 'mock-exam-editor.html', "'self'"],
    ['/service-config.js', 'service-config.js', null],
    ['/pedagogy-composition.css', 'pedagogy-composition.css', null],
  ]) await checkResponse(base, path, asset, framing, manifest);
  for (const path of ['/worker/index.js', '/reviews/INDEX.md', '/scripts/build-public.mjs',
    '/.git/config', '/dist/public-manifest.json', '/_headers', '/missing-file',
    '/missing-file?x=1', '/mock-exam-editor/extra']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404, `${path} must not fall back to index.html`);
  }
  for (const [path, location] of [
    ['/index.html', '/'], ['/index', '/'],
    ['/mock-exam-editor.html', '/mock-exam-editor'],
    ['/mock-exam-editor/', '/mock-exam-editor'],
  ]) {
    const response = await fetch(base + path, { redirect: 'manual' });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), location);
  }
  // Browser-level framing: the mock editor is a same-origin iframe; index
  // must refuse an embedding page on a different local origin.
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin===base || url.hostname==='127.0.0.1' ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  await page.goto(base + '/');
  if(red==='missing-library-view') await page.locator('#libraryView').evaluate(el=>el.removeAttribute('id'));
  assert.equal(await page.locator('#libraryView').count(),1,'Guest top-level library positive control');
  assert.equal(await page.locator('#guestPreviewBanner').isVisible(),true);
  assert.equal(await page.locator('#loginBtn').isDisabled(),true);
  assert.equal(await page.evaluate(()=>fbReady),false);
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'r7-mock-frame'; frame.src = '/mock-exam-editor'; document.body.append(frame);
  });
  await page.frameLocator('#r7-mock-frame').locator('body').waitFor();
  assert.ok((await page.frameLocator('#r7-mock-frame').locator('title').textContent()).length);
  const otherPort = await freePort();
  // The framed page is served by Wrangler; this second loopback origin only
  // supplies a harmless embedding document and does not touch app storage.
  const http = (await import('node:http')).createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<iframe id="framed" src="${base}/"></iframe>`);
  });
  await new Promise(resolve => http.listen(otherPort, '127.0.0.1', resolve));
  try {
    const outer = await context.newPage();
    await outer.goto(`http://127.0.0.1:${otherPort}/`);
    await outer.locator('#framed').waitFor();
    await outer.waitForLoadState('networkidle');
    const framed = outer.frameLocator('#framed');
    assert.equal(await framed.locator('body #libraryView').count(), 0,
      'Cross-origin embedding must be blocked by frame-ancestors');
  } finally { await new Promise(resolve => http.close(resolve)); }
  await context.close();
  console.log(JSON.stringify({kind:'guest-host',base,manifestFiles:Object.keys(manifest).length,servedAssets:files.length,manifestSha256:sha(Buffer.from(JSON.stringify(manifest))),allBytesMatch:true,topLevelLibrary:true,aliases:true,private404:true,httpHeaders:true,sameOriginMock:true,crossOriginIndexBlocked:true}));
} finally {
  try { await browser?.close(); }
  finally {
    try {if(proxy)await new Promise(resolve=>proxy.close(resolve));}
    finally {if(lifecycle)await stopStaticStaging(lifecycle,clean);}
  }
}
