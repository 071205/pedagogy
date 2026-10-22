import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startStaticStaging } from './serve-static-staging.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function ready(base, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(`Wrangler exited ${child.exitCode} before readiness`);
    try { if ((await fetch(base + '/', { signal: AbortSignal.timeout(500) })).ok) return; }
    catch { /* Local runtime is still starting. */ }
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
    assert.equal(policy, `${normalizedMeta(bytes.toString('utf8'))}; frame-ancestors ${framing}`);
    assert.equal((policy.match(/frame-ancestors/g) || []).length, 1);
  }
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const { child, manifest, clean } = await startStaticStaging({ root, port });
let browser;
try {
  await ready(base, child);
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
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  await page.goto(base + '/');
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
  console.log(`Static host: ${Object.keys(manifest).length} manifest assets, root/aliases/404/headers and iframe policies passed`);
} finally {
  await browser?.close();
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
  await clean();
}
