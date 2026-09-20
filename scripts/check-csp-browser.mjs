import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import * as playwright from 'playwright';

// Test the policy delivered by serve.py, not a hand-written copy of it.
const port = await new Promise(resolve => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
const server = spawn('python3', ['serve.py', '--port', String(port)], { stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 70; i++) {
    try { ready = (await fetch(base + '/index.html')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'serve.py must start');
  for (const engine of (process.env.CSP_ENGINES || 'chromium').split(',')) {
    const browser = await playwright[engine].launch({ headless: true });
    try {
      for (const file of ['index.html', 'mock-exam-editor.html', 'document-editor.html']) {
        for (const broken of [false, true]) {
          const context = await browser.newContext();
          try {
            await context.route('**/*', async route => {
              const probe = new URL(route.request().url());
              if(probe.hostname==='apis.google.com' && probe.searchParams.has('pedagogyAuthProbe')) {
                return route.fulfill({contentType:'application/javascript',body:'window.__authScriptLoaded=true;'});
              }
              if(probe.hostname==='pedagogy-huryul.firebaseapp.com' && probe.searchParams.has('pedagogyAuthProbe')) {
                return route.fulfill({contentType:'text/html',body:'<body>auth helper fixture</body>'});
              }
              if (!route.request().url().startsWith(base + '/')) return route.abort();
              if (broken && route.request().url() === `${base}/${file}`) {
                const response = await route.fetch();
                const body = (await response.text())
                  .replace(/\s*'sha256-[^']+'/g, '')
                  .replace(/script-src\s+'self'/, "script-src 'self' 'unsafe-inline'")
                  .replace(/script-src-attr\s+'none';/g, '');
                return route.fulfill({ response, body });
              }
              return route.continue();
            });
            const page = await context.newPage();
            await page.goto(`${base}/${file}`);
            await page.waitForLoadState('networkidle');
            const result = await page.evaluate(() => {
              window.__cspProbe = { attribute: 0, property: 0, listener: 0, script: 0 };
              const inline = document.createElement('script');
              inline.textContent = 'window.__cspProbe.script++';
              document.head.append(inline);
              const attribute = document.createElement('button');
              attribute.setAttribute('onclick', 'window.__cspProbe.attribute++');
              document.body.append(attribute);
              attribute.click();
              const property = document.createElement('button');
              property.onclick = () => window.__cspProbe.property++;
              property.addEventListener('click', () => window.__cspProbe.listener++);
              document.body.append(property);
              property.click();
              inline.remove(); attribute.remove(); property.remove();
              return window.__cspProbe;
            });
            assert.equal(result.attribute, broken ? 1 : 0, `${engine}/${file}: inline attribute ${broken ? 'mutation must execute' : 'must be blocked'}`);
            assert.deepEqual([result.property, result.listener], [1, 1], 'registered JS callbacks must work');
            assert.equal(result.script, broken ? 1 : 0,
              `${engine}/${file}: injected inline script ${broken ? 'mutation must execute' : 'must be blocked'}`);
            if(!broken && file!=='mock-exam-editor.html') {
              const loaded=await page.evaluate(()=>new Promise(resolve=>{
                const script=document.createElement('script');
                script.src='https://apis.google.com/js/api.js?pedagogyAuthProbe=1';
                script.onload=()=>resolve(window.__authScriptLoaded===true);
                script.onerror=()=>resolve(false);
                document.head.append(script);
              }));
              assert.equal(loaded,true,`${file}: Firebase popup helper must pass CSP`);
              await page.evaluate(()=>{
                const frame=document.createElement('iframe');frame.id='auth-csp-probe';
                frame.src='https://pedagogy-huryul.firebaseapp.com/__/auth/iframe?pedagogyAuthProbe=1';
                document.body.append(frame);
              });
              await page.frameLocator('#auth-csp-probe').getByText('auth helper fixture').waitFor({timeout:3000});
            }
          } finally { await context.close(); }
        }
        console.log(`CSP ${engine}/${file}: blocked injected script/attribute, working callbacks, red mutation confirmed`);
      }
    } finally { await browser.close(); }
  }
} finally { server.kill(); }
