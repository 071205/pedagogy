import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startBackendStaging } from './serve-backend-staging.mjs';
import { ROOT, OUTPUT, SCRIPT_GATE } from './build-backend-staging.mjs';
import { IDENTITY, ORIGIN } from './backend-staging-config.mjs';

const at=process.argv.indexOf('--config');
const realSdk=at>=0;
const configuration=realSdk?JSON.parse(await readFile(process.argv[at+1],'utf8')):{
  kind:'backend-staging-a0',origin:ORIGIN,
  firebase:{apiKey:'AIza'+'x'.repeat(35),projectId:IDENTITY.projectId,appId:IDENTITY.appId,
    authDomain:IDENTITY.authDomain,storageBucket:IDENTITY.storageBucket,messagingSenderId:IDENTITY.projectNumber},
  appCheckSiteKey:'6L'+'x'.repeat(38),
};
const results=[];
let host,browser;
let status=0;
const publicRoot=join(ROOT,OUTPUT,'public');
const mutations={
  'no-sdk-init': ['assets/index-3.js','    firebase.initializeApp(firebaseConfig);',''],
  'no-fetch-guard': ['service-config.js',"    if (!allows(url, method)) return Promise.reject(Error('A0 network request blocked'));",''],
  'no-ai-guard': ['assets/index-3.js','async function getAiAppCheckToken(){\n  throw Error("A0에서는 AI·이미지·계정 삭제를 지원하지 않습니다");','async function getAiAppCheckToken(){'],
  'no-storage-guard': ['assets/index-3.js','async function storeImageFile(file){\n  throw Error("A0에서는 AI·이미지·계정 삭제를 지원하지 않습니다");','async function storeImageFile(file){'],
  'no-text-guard': ['assets/index-3.js','  window.PEDAGOGY_A0.textOnly(s);',''],
  'no-profile-guard': ['service-config.js','    if ((old && old !== identity) || (!old && localStorage.length)) fail();',''],
  'no-idb-guard': ['service-config.js',"    if ((fresh && dbs.length) || dbs.some(d => !/^(firebase|PM_)/.test(d.name || ''))) fail();",''],
  'early-marker': ['service-config.js','    fresh = !profile();\n  } catch','    fresh = !profile(); localStorage.setItem(marker, identity);\n  } catch'],
  'no-fresh-recheck': ['service-config.js','    fresh = !profile(); // Another A0 tab may have admitted this profile during the await.',''],
  'no-late-gate': ['assets/index-1.js',SCRIPT_GATE,''],
  'no-appcheck-positive': ['service-config.js',"    if (u.hostname === 'content-firebaseappcheck.googleapis.com') return method.toUpperCase() === 'POST' && u.searchParams.get('key') === f.apiKey && path === '/v1/projects/' + f.projectId + '/apps/' + f.appId + ':exchangeRecaptchaEnterpriseToken';","    if (u.hostname === 'content-firebaseappcheck.googleapis.com') return false;"],
  'no-appcheck-binding': ['service-config.js',"    if (u.hostname === 'content-firebaseappcheck.googleapis.com') return method.toUpperCase() === 'POST' && u.searchParams.get('key') === f.apiKey && path === '/v1/projects/' + f.projectId + '/apps/' + f.appId + ':exchangeRecaptchaEnterpriseToken';","    if (u.hostname === 'content-firebaseappcheck.googleapis.com') return true;"],
  'no-appcheck-csp': ['index.html','https://content-firebaseappcheck.googleapis.com','https://appcheck-disabled.invalid'],
  'no-auth-frame': ['index.html','https://pedagogy-ai-staging.firebaseapp.com','https://frame-disabled.invalid'],
};
async function open({red='',dirty=false,wrongOrigin=false,holdAdmission=false,lateBundle=false}={}) {
  const context=await browser.newContext({locale:'ko-KR'}); // never use the user's profile
  const errors=[];
  if(!realSdk) await context.addInitScript(({dirty,holdAdmission})=>{
    document.addEventListener('load',e=>{if(e.target.src?.endsWith('/assets/index-1.js'))window.__A0_LATE_LOADED=true;},true);
    if(holdAdmission){const original=indexedDB.databases.bind(indexedDB);indexedDB.databases=()=>new Promise(resolve=>{window.__releaseA0Admission=()=>original().then(resolve);});}
    if(dirty)localStorage.setItem('private-existing-work','must remain unchanged');
    const trace={configs:[],order:[],storageCalls:0,signIns:0,fetches:0,sends:0};window.__a0SDK=trace;
    // Observe only the SDK/network boundaries. Product initialization, guards,
    // navigation, file handling, DOM, persistence and serialization are real.
    window.__a0NativeFetch=window.fetch.bind(window);
    window.fetch=async()=>{trace.fetches++;return new Response('{}',{status:200});};
    XMLHttpRequest.prototype.send=function(){trace.sends++;};
    const callbacks=[];
    const auth={onAuthStateChanged:cb=>{callbacks.push(cb);queueMicrotask(()=>cb(null));return()=>{};},
      onIdTokenChanged:()=>()=>{},getRedirectResult:async()=>({}),
      signInWithPopup:async()=>{trace.signIns++;return{};},signOut:async()=>{}};
    const ref={collection:()=>ref,doc:()=>ref,get:async()=>({docs:[],exists:false,forEach(){}}),onSnapshot:()=>()=>{}};
    const check=()=>({activate(){trace.order.push('appCheck');},getToken:async()=>({token:'fixture-app-check'})});
    check.ReCaptchaEnterpriseProvider=function(key){if(!key)throw Error('No key');};
    window.firebase={initializeApp(c){trace.configs.push(c);trace.order.push('initialize');},
      auth:Object.assign(()=>{trace.order.push('auth');return auth;},{GoogleAuthProvider:function(){}}),
      firestore:()=>{trace.order.push('firestore');return ref;},
      storage:()=>{trace.storageCalls++;throw Error('A0 must not instantiate Storage');},appCheck:check};
  },{dirty,holdAdmission});
  await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    const local=wrongOrigin?'http://localhost:8797':ORIGIN;
    if(u.origin===local) {
      const file=u.pathname==='/'?'index.html':u.pathname.slice(1);
      if((wrongOrigin||mutations[red]?.[0]===file||(lateBundle&&['service-config.js','assets/index-1.js'].includes(file)))&&Object.hasOwn(host.files,file)) {
        let body=await readFile(join(publicRoot,file),'utf8');
        if(mutations[red]?.[0]===file) {
          const [,before,after]=mutations[red];
          assert.equal(body.split(before).length,2,'Browser RED anchor exists exactly once');body=body.replace(before,after);
        }
        if(lateBundle&&file==='service-config.js')body=body.replace('resolve(false),15000)', 'resolve(false),100)');
        if(lateBundle&&file==='assets/index-1.js'){await new Promise(resolve=>setTimeout(resolve,500));body+='\nwindow.__A0_LATE_EXEC=true;localStorage.setItem("a0-late-side-effect","bad");';}
        return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':'application/javascript; charset=utf-8',body});
      }
      return route.continue();
    }
    if(!realSdk&&u.origin==='https://content-firebaseappcheck.googleapis.com'&&u.pathname==='/v1/projects/'+IDENTITY.projectId+'/apps/'+IDENTITY.appId+':exchangeRecaptchaEnterpriseToken'&&u.searchParams.get('a0control')==='1'&&route.request().method()==='POST')
      return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':ORIGIN},body:'{"a0AppCheckCsp":true}'});
    // A CSP positive control, not a Google authentication exchange. No backend request.
    if(u.origin==='https://'+IDENTITY.authDomain&&u.pathname==='/__/auth/iframe'&&u.searchParams.get('a0control')==='1')
      return route.fulfill({contentType:'text/html',body:'<!doctype html><p id="a0-auth-positive">staging auth frame</p>'});
    if(realSdk&&u.hostname==='www.gstatic.com'&&/^\/firebasejs\/10\.12\.0\/firebase-(app|auth|firestore|storage|app-check)-compat\.js$/.test(u.pathname))
      return route.continue();
    // Includes all real Firebase/Auth/AppCheck/reCAPTCHA/AI requests. A0 is not A1.
    return route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(8000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((wrongOrigin?'http://localhost:8797':ORIGIN)+'/index.html');
  await page.waitForFunction(()=>window.PEDAGOGY_A0);
  return {page,context,errors};
}
async function positive(page) {
  await page.waitForFunction(()=>typeof fbReady!=='undefined'&&fbReady,null,{timeout:30000});
  const state=await page.evaluate(expected=>({identityMatches:Object.entries(expected).every(([key,value])=>(window.__a0SDK?(__a0SDK.configs[0]||{}):firebase.app().options)[key]===value),project:firebaseConfig.projectId,app:firebaseConfig.appId,ready:fbReady,
    check:appCheckReady,storage:fbStorage===null,guest:!!publicConfig.guestPreview,staging:publicConfig.stagingBackendPreview,
    trace:window.__a0SDK?{count:__a0SDK.configs.length,order:__a0SDK.order,storageCalls:__a0SDK.storageCalls}:null,
    sdk:firebase.SDK_VERSION||'fixture'}),configuration.firebase);
  assert(state.project===IDENTITY.projectId&&state.app===IDENTITY.appId&&state.check&&state.storage&&!state.guest&&state.staging,'A0 SDK identity and mode positive control');
  if(!realSdk) {
    assert.equal(state.trace.count,1,'A0 SDK initialization positive control');
    assert.deepEqual(state.trace.order,['initialize','appCheck','auth','firestore'],'App Check before protected services');
    assert.equal(state.trace.storageCalls,0);
  }else assert.equal(state.sdk,'10.12.0','Actual pinned Firebase SDK must execute');
  assert(state.identityMatches,'A0 SDK full configuration positive control');
  assert(await page.locator('#a0StagingBanner').isVisible());
  assert.equal(await page.locator('#loginBtn').isDisabled(),false,'A0 login UI enabled');
  return state.sdk;
}
async function unsupported(page,name) {
  const blocked=await page.evaluate(async name=>{
    try {
      if(name==='storeImageFile') {
        const cv=document.createElement('canvas');cv.width=cv.height=1;
        const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
        await storeImageFile(new File([blob],'synthetic.png',{type:'image/png'}));
      }else await window[name]();
      return false;
    }catch{return true;}
  },name);
  assert(blocked,'A0 unsupported '+name);
}
async function network(page) {
  const result=await page.evaluate(async()=>{
    const before=__a0SDK.fetches;
    const denied=[
      ['https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=wrong','POST'],
      ['https://firestore.googleapis.com/v1/projects/not-staging/databases/(default)/documents/x','GET'],
      ['https://firestore.googleapis.com/v1/projects/not-staging/databases/(default)/documents/x?database=projects/pedagogy-ai-staging/databases/(default)','GET'],
      ['https://content-firebaseappcheck.googleapis.com/v1/projects/1/apps/wrong:exchangeRecaptchaEnterpriseToken','POST'],
      ['https://firebasestorage.googleapis.com/v0/b/pedagogy-ai-staging.firebasestorage.app/o','POST'],
      ['https://pedagogy-ai-staging.dbruddl79.workers.dev/','POST'],
      ['https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects/pedagogy-ai-staging/databases/(default)&database=projects/other/databases/(default)','GET'],
      ['https://unapproved.invalid/','POST'],['/document','POST'],['http://127.0.0.1:8787/health','GET'],
    ];
    let blocks=0;
    for(const [url,method]of denied){try{await fetch(url,{method});}catch{blocks++;}}
    const deniedReached=__a0SDK.fetches-before;
    await fetch('https://firestore.googleapis.com/v1/projects/pedagogy-ai-staging/databases/(default)/documents/test');
    const afterAllowed=__a0SDK.fetches;
    let xhrBlocked=false;
    try{const x=new XMLHttpRequest();x.open('GET','https://firebasestorage.googleapis.com/v0/b/x/o');x.send();}catch{xhrBlocked=true;}
    const a=new XMLHttpRequest();a.open('GET','https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects%2Fpedagogy-ai-staging%2Fdatabases%2F(default)');a.send();
    return {blocks,expected:denied.length,deniedReached,allowed:afterAllowed-before,sends:__a0SDK.sends,xhrBlocked};
  });
  assert(result.blocks===result.expected&&result.deniedReached===0,'A0 production fetch blocked');
  assert(result.allowed===1&&result.xhrBlocked&&result.sends===1,'A0 allowed staging and blocked XHR controls');
}
async function appCheckBoundary(page) {
  const result=await page.evaluate(async()=>{
    const base='https://content-firebaseappcheck.googleapis.com/v1/projects/'+firebaseConfig.projectId+'/apps/'+firebaseConfig.appId;
    const endpoint=base+':exchangeRecaptchaEnterpriseToken?key='+firebaseConfig.apiKey;
    const beforeFetch=__a0SDK.fetches,beforeSend=__a0SDK.sends;
    let fetched=false,xhr=false;
    try{await fetch(endpoint,{method:'POST'});fetched=true;}catch{}
    try{const x=new XMLHttpRequest();x.open('POST',endpoint);x.send('{}');xhr=true;}catch{}
    const positive={fetched,xhr,fetches:__a0SDK.fetches-beforeFetch,sends:__a0SDK.sends-beforeSend};
    const denied=[
      [endpoint.replace('/projects/'+firebaseConfig.projectId+'/', '/projects/other/'),'POST'],
      [endpoint.replace('/projects/'+firebaseConfig.projectId+'/', '/projects/'+firebaseConfig.messagingSenderId+'/'),'POST'],
      [endpoint.replace('/apps/'+firebaseConfig.appId+':','/apps/wrong:'),'POST'],
      [endpoint.replace(':exchangeRecaptchaEnterpriseToken',':exchangeDebugToken'),'POST'],
      [endpoint.split('?')[0],'POST'],[endpoint.replace(firebaseConfig.apiKey,'wrong'),'POST'],
      [endpoint+'&key='+firebaseConfig.apiKey,'POST'],[endpoint,'GET'],
    ];
    let blocked=0;const before=__a0SDK.fetches;
    for(const [url,method]of denied){try{await fetch(url,{method});}catch{blocked++;}}
    return {positive,blocked,total:denied.length,leaked:__a0SDK.fetches-before};
  });
  assert(result.positive.fetched&&result.positive.xhr&&result.positive.fetches===1&&result.positive.sends===1,'A0 pinned SDK App Check endpoint positive control');
  assert(result.blocked===result.total&&result.leaked===0,'A0 App Check project/app/action/key/method boundary');
}
async function appCheckCsp(page) {
  const allowed=await page.evaluate(async()=>{try{return (await (await window.__a0NativeFetch('https://content-firebaseappcheck.googleapis.com/v1/projects/'+firebaseConfig.projectId+'/apps/'+firebaseConfig.appId+':exchangeRecaptchaEnterpriseToken?key='+firebaseConfig.apiKey+'&a0control=1',{method:'POST',body:'{}'})).json()).a0AppCheckCsp===true;}catch{return false;}});
  assert(allowed,'A0 actual SDK App Check CSP host positive control');
}
async function appCheckCheck(red='') {
  const {page,context}=await open({red});
  try{await positive(page);await appCheckBoundary(page);await appCheckCsp(page);}finally{await context.close();}
}
async function authFrame(page) {
  await page.evaluate(()=>{const f=document.createElement('iframe');f.id='a0AuthControl';f.src='https://pedagogy-ai-staging.firebaseapp.com/__/auth/iframe?a0control=1';document.body.append(f);});
  let loaded=false;
  try{await page.frameLocator('#a0AuthControl').locator('#a0-auth-positive').waitFor({timeout:2500});loaded=true;}catch{}
  assert(loaded,'A0 staging auth frame positive control');
}
async function dirtyIndexedDb(red='') {
  const {page,context}=await open({red});
  try{
    await positive(page);
    await page.evaluate(async()=>{
      await new Promise((resolve,reject)=>{const request=indexedDB.open('PM_existing_private',1);request.onsuccess=()=>{request.result.close();resolve();};request.onerror=()=>reject(Error('fixture IDB setup failed'));});
      localStorage.clear();
    });
    await page.reload();await page.waitForFunction(()=>window.PEDAGOGY_A0.bootstrapFinished);
    assert.equal(await page.evaluate(()=>__a0SDK.configs.length),0,'A0 existing IndexedDB must stop SDK initialization');
    assert.equal(await page.evaluate(()=>localStorage.getItem('PM_A0_PROFILE_V1')),null,'Failed first admission must not leave a reusable profile marker');
    await page.reload();await page.waitForFunction(()=>window.PEDAGOGY_A0.bootstrapFinished);
    assert.equal(await page.evaluate(()=>__a0SDK.configs.length),0,'A0 dirty IndexedDB stays blocked on reload');
  }finally{await context.close();}
}
async function admission(red='') {
  const {page,context}=await open({red,holdAdmission:true});
  try{
    await page.waitForFunction(()=>typeof window.__releaseA0Admission==='function');
    assert.equal(await page.evaluate(()=>localStorage.getItem('PM_A0_PROFILE_V1')),null,'A0 must not mark profile before asynchronous admission');
    assert.equal(await page.evaluate(()=>__a0SDK.configs.length),0);
    await page.evaluate(()=>window.__releaseA0Admission());await positive(page);
  }finally{await context.close();}
}
async function lateBundleCheck(red='') {
  const {page,context}=await open({red,lateBundle:true});
  try {
    await page.waitForFunction(()=>window.PEDAGOGY_A0.bootstrapFinished);
    await page.waitForFunction(()=>window.__A0_LATE_LOADED===true);
    assert.equal(await page.locator('#loginBtn').isDisabled(),true,'Timed out loader must disable login');
    assert.equal(await page.evaluate(()=>!!window.__A0_LATE_EXEC||localStorage.getItem('a0-late-side-effect')!==null),false,'A0 timed-out bundle must not execute application code');
  }finally{await context.close();}
}
async function concurrentAdmission(red='') {
  const {page,context}=await open({red,holdAdmission:true});
  try {
    const second=await context.newPage();
    await second.goto(ORIGIN+'/index.html');
    await second.waitForFunction(()=>typeof window.__releaseA0Admission==='function');
    await page.evaluate(()=>window.__releaseA0Admission());await positive(page);
    await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('firebaseLocalStorageDb',1);r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(Error('fixture database failed'));}));
    await second.evaluate(()=>window.__releaseA0Admission());
    await second.waitForFunction(()=>window.PEDAGOGY_A0.bootstrapFinished);
    assert.equal(await second.evaluate(()=>__a0SDK.configs.length),1,'A0 concurrent admitted profile must initialize second SDK');
  }finally{await context.close();}
}
async function check(red='') {
  if(red==='no-appcheck-positive'||red==='no-appcheck-binding'||red==='no-appcheck-csp')return appCheckCheck(red);
  if(red==='no-late-gate')return lateBundleCheck(red);
  if(red==='no-fresh-recheck')return concurrentAdmission(red);
  if(red==='early-marker')return admission(red);
  if(red==='no-idb-guard')return dirtyIndexedDb(red);
  const dirty=red==='no-profile-guard';
  const {page,context,errors}=await open({red,dirty});
  try {
    if(dirty) {
      await page.waitForFunction(()=>window.PEDAGOGY_A0.bootstrapFinished);
      const count=await page.evaluate(()=>__a0SDK.configs.length);
      assert.equal(count,0,'A0 dirty profile must stop SDK initialization');
      return;
    }
    const sdk=await positive(page);
    if(realSdk){assert(errors.length===0,'No product page errors (details suppressed)');return {sdk};}
    if(red==='no-fetch-guard'){await network(page);return;}
    if(red==='no-ai-guard'){await unsupported(page,'getAiAppCheckToken');return;}
    if(red==='no-storage-guard'){await unsupported(page,'storeImageFile');return;}
    if(red==='no-text-guard') {
      const rejected=await page.evaluate(()=>{try{setToDoc({id:'bad',problems:[{id:'q',answerImg:'data:image/png;base64,eA==',blocks:[]}]},0);return false;}catch{return true;}});
      assert(rejected,'A0 cloud image rejected');return;
    }
    await authFrame(page);
    if(red==='no-auth-frame')return;
    await network(page);await appCheckBoundary(page);await appCheckCsp(page);
    for(const name of ['getAiAppCheckToken','uploadBlobToStorage','storeImageFile','wipeStorageImages','purgeAttemptLedgerBeforeAccountDelete','deleteAccountEverything'])await unsupported(page,name);
    const text=await page.evaluate(()=>{
      sets=[normSet({id:'a0-text',name:'합성 텍스트',problems:[{id:'a0-q',blocks:[{type:'statement',data:{text:'A0 TEXT $x+1$'}}]}]},{keepId:true})];
      currentSetId=sets[0].id;saveSets();showEditor(currentSetId);writeLocalNow();
      return setToDoc(sets[0],0).problems.length;
    });
    assert.equal(text,1,'Text-only serialization positive control');
    await page.reload();await positive(page);
    assert(await page.evaluate(()=>sets.some(s=>s.id==='a0-text')),'A0 text local reload');
    await page.locator('#loginBtn').click();
    await page.locator('#csAll').check();await page.locator('#consentOk').click();
    await page.waitForFunction(()=>__a0SDK.signIns===1);
    assert.equal(await page.evaluate(()=>__a0SDK.signIns),1,'Actual login button calls staging SDK boundary');
    const imageRejected=await page.evaluate(()=>{
      try{setToDoc({id:'bad',problems:[{id:'q',answerImg:'data:image/png;base64,eA==',blocks:[]}]},0);return false;}catch{return true;}
    });
    assert(imageRejected,'A0 cloud image rejected');
    await page.evaluate(()=>{showLibrary('mocks');newMock();});
    await page.frameLocator('#mockFrame').locator('#a0StagingBanner').waitFor();
    const frame=page.frames().find(f=>f.url().includes('/mock-exam-editor'));
    await frame.waitForFunction(()=>window.PEDAGOGY_A0_MOCK_READY===true);
    assert.equal(await page.frameLocator('#mockFrame').locator('input[type=file]:enabled').count(),0);
    await page.frameLocator('#mockFrame').locator('#round').fill('A0 합성 모의고사');
    await page.waitForFunction(()=>mocks.some(m=>m.round==='A0 합성 모의고사'));
    await page.goto(ORIGIN+'/document-editor.html');
    await page.waitForFunction(()=>typeof appCheckReady!=='undefined'&&appCheckReady&&typeof auth!=='undefined'&&auth,null,{timeout:30000});
    await page.locator('#loginBtn').click();assert.equal(await page.evaluate(()=>__a0SDK.signIns),1);
    assert.equal(await page.locator('#draftBtn').isDisabled(),true);
    await page.evaluate(()=>makeDraft());assert.match(await page.locator('#aiStatus').innerText(),/A0에서는/);
    await page.goto(ORIGIN+'/legal.html');assert(await page.locator('#a0StagingBanner').isVisible());
    assert.deepEqual(errors,[],'No product page errors');
    return {sdk};
  }finally{await context.close();}
}
try {
  host=await startBackendStaging({configuration});
  // Verify actual HTTP boundary independently of the browser's route fixtures.
  const badHost=await fetch('http://127.0.0.1:8796/');assert.equal(badHost.status,403);
  for(const path of ['/staging-manifest.json','/../worker/index.js','/reviews/INDEX.md','/_headers','/not-present'])assert.equal((await fetch(ORIGIN+path)).status,404);
  assert.equal((await fetch(ORIGIN+'/',{method:'POST'})).status,405);
  const protectedAsset=join(publicRoot,'service-config.js'),originalAsset=await readFile(protectedAsset);
  try{await writeFile(protectedAsset,Buffer.concat([originalAsset,Buffer.from('\n// changed after startup\n')]));assert.equal((await fetch(ORIGIN+'/service-config.js')).status,500,'Host must reject post-verification mutation');}
  finally{await writeFile(protectedAsset,originalAsset);}
  browser=await chromium.launch();
  if(process.env.A0_FOCUS){
    assert(!realSdk,'Focused reproductions require the synthetic SDK');
    assert(['late','concurrent','appcheck'].includes(process.env.A0_FOCUS),'Unknown focus');
    await (process.env.A0_FOCUS==='late'?lateBundleCheck():process.env.A0_FOCUS==='concurrent'?concurrentAdmission():appCheckCheck());
    results.push({case:process.env.A0_FOCUS,passed:true});
  }else{
    const normal=await check();results.push({case:'normal',passed:true,...normal});
    if(!realSdk) {
      // Both dirty storage and wrong origin are negative contexts, not alternate profiles.
      for(const options of [{dirty:true},{wrongOrigin:true}]) {
        const {page,context}=await open(options);
        try{await page.waitForFunction(()=>window.PEDAGOGY_A0.bootstrapFinished);assert.equal(await page.evaluate(()=>__a0SDK.configs.length),0);assert.equal(await page.locator('#loginBtn').isDisabled(),true);}
        finally{await context.close();}
      }
      await dirtyIndexedDb();await admission();await lateBundleCheck();await concurrentAdmission();
      const expectations={
        'no-appcheck-csp':'A0 actual SDK App Check CSP host positive control',
        'no-appcheck-positive':'A0 pinned SDK App Check endpoint positive control',
        'no-appcheck-binding':'A0 App Check project/app/action/key/method boundary',
        'no-late-gate':'A0 timed-out bundle must not execute application code',
        'no-fresh-recheck':'A0 concurrent admitted profile must initialize second SDK',
        'no-sdk-init':'A0 SDK initialization positive control', 'no-fetch-guard':'A0 production fetch blocked',
        'no-ai-guard':'A0 unsupported getAiAppCheckToken', 'no-storage-guard':'A0 unsupported storeImageFile',
        'no-text-guard':'A0 cloud image rejected', 'no-profile-guard':'A0 dirty profile must stop SDK initialization',
        'no-auth-frame':'A0 staging auth frame positive control', 'no-idb-guard':'A0 existing IndexedDB must stop SDK initialization', 'early-marker':'A0 must not mark profile before asynchronous admission',
      };
      for(const [red,target]of Object.entries(expectations)) {
        let error;
        try{await check(red);}catch(e){error=e;}
        assert(error&&error.message.includes(target),'RED must fail its target: '+red+'; '+(error?.message||'passed unexpectedly'));
        results.push({case:red,target,detected:true});
      }
    }
  }
}catch(error){status=1;console.error(error.message);}
finally {
  const cleanup=await Promise.allSettled([browser?.close(),host?.close()]);
  if(cleanup.some(x=>x.status==='rejected'))status=1;
  await mkdir(join(ROOT,'test-results'),{recursive:true});
  const summary={scope:process.env.A0_FOCUS?'focused reproduction: '+process.env.A0_FOCUS:realSdk?'actual pinned SDK initialization; all backend requests blocked':'SDK fixture, real product guards/DOM/storage/serialization',complete:status===0,results,cleanup:cleanup.map(x=>x.status)};
  await writeFile(join(ROOT,'test-results',realSdk?'backend-staging-real-sdk.json':'backend-staging-fixture.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary));
}
process.exitCode=status;
