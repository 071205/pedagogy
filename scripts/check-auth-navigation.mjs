import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import * as playwright from 'playwright';

const port=await new Promise(resolve=>{
  const server=createServer();server.listen(0,'127.0.0.1',()=>{
    const port=server.address().port;server.close(()=>resolve(port));
  });
});
const server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
let browser;
try {
  for(let i=0;i<80;i++) {
    try{if((await fetch(base+'/health')).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  for(const engine of (process.env.AUTH_ENGINES||'chromium').split(',')) {
    browser=await playwright[engine].launch();
    for(const brokenAppCheck of [true,false]) {
      const context=await browser.newContext();
      await context.route('**/*',route=>{
        if(!route.request().url().startsWith(base+'/'))return route.abort();
        if(new URL(route.request().url()).pathname==='/service-config.js') {
          return route.fulfill({contentType:'application/javascript',body:
            'window.PEDAGOGY_PUBLIC_CONFIG=Object.freeze({appCheckSiteKey:"fixture-key",libraryCloudSchema:1,mockCloudSchema:1});'});
        }
        return route.continue();
      });
      await context.addInitScript(({brokenAppCheck})=>{
        // Fake only remote SDK boundaries; navigation, lifecycle, cache and UI are real.
        const callbacks=[];
        const saved=localStorage.getItem('__review_auth_owner');
        const makeUser=uid=>({uid,displayName:uid,email:uid+'@example.test',
          getIdTokenResult:async()=>({claims:{}}),getIdToken:async()=> 'fixture-id-token'});
        let current=saved?makeUser(saved):null;
        const emit=async uid=>{
          current=uid?makeUser(uid):null;
          if(uid)localStorage.setItem('__review_auth_owner',uid);else localStorage.removeItem('__review_auth_owner');
          for(const callback of callbacks)await callback(current);
        };
        window.__authFixture={emit,redirectReads:0};
        const auth={onAuthStateChanged:callback=>{callbacks.push(callback);queueMicrotask(()=>callback(current));return()=>{};},
          onIdTokenChanged:()=>()=>{},getRedirectResult:async()=>{window.__authFixture.redirectReads++;return{};},
          signOut:()=>emit(null),signInWithPopup:()=>emit('A')};
        const ref={collection:()=>ref,doc:()=>ref,get:async()=>({docs:[],exists:false,forEach(){}}),
          set:async()=>{},onSnapshot:()=>()=>{}};
        const appCheck=()=>({activate(){if(brokenAppCheck)throw Error('fixture attestation initialization failure');},
          getToken:async()=>({token:'fixture-app-check'})});
        appCheck.ReCaptchaEnterpriseProvider=function(){};
        window.firebase={initializeApp(){},auth:Object.assign(()=>auth,{GoogleAuthProvider:function(){}}),
          firestore:()=>({...ref,batch:()=>({set(){},commit:async()=>{}})}),storage:()=>({}),appCheck};
      },{brokenAppCheck});
      const page=await context.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      for(const file of ['index.html','document-editor.html','index.html']) {
        await page.goto(base+'/'+file);await page.waitForLoadState('networkidle');
        const ready=await page.evaluate(file=>file==='index.html'?fbReady:!document.querySelector('#loginBtn').disabled,file);
        assert.equal(ready,true,`${file}: App Check initialization must not disable authentication`);
        assert.equal(await page.evaluate(()=>window.__authFixture.redirectReads),1,`${file}: consume redirect result`);
        const attestation=await page.evaluate(async()=>{try{return await getAiAppCheckToken();}catch{return 'blocked';}});
        assert.equal(attestation,brokenAppCheck?'blocked':'fixture-app-check',file);
        await page.evaluate(()=>window.__authFixture.emit('A'));
        if(file==='index.html') {
          await page.waitForFunction(()=>authInitialized && currentUser?.uid==='A');
          await page.evaluate(()=>{
            sets=[{id:'A-only',name:'A-only',header:'',problems:[newProblem()]}];writeLocalNow();
          });
        } else assert.equal(await page.locator('#authState').innerText(),'A');
      }
      await page.evaluate(()=>window.__authFixture.emit('B'));
      assert.equal(await page.evaluate(()=>sets.some(s=>s.id==='A-only')),false,'owner switch must isolate local data');
      await page.evaluate(()=>window.__authFixture.emit('A'));
      assert.equal(await page.evaluate(()=>sets.some(s=>s.id==='A-only')),true,'returning owner must recover its own work');
      assert.deepEqual(errors,[]);
      await context.close();
    }
    await browser.close();browser=null;
    console.log(`Auth ${engine}: document/index round trips, owner isolation, redirect results and App Check initialization failure passed (SDK fixture)`);
  }
} finally {await browser?.close();server.kill();}
