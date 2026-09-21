// 실제 제품 함수 + 모의 외부 경계. 작업 디렉터리를 과거 사본으로 바꾸면 red 검증 가능.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const src=fs.readFileSync('index.html','utf8');
const {createWorker,DailyQuota}=await import(pathToFileURL(path.resolve('worker/index.js')));
function fn(name){let start=src.indexOf('function '+name+'(');assert.ok(start>=0,name);
  if(src.slice(start-6,start)==='async ')start-=6;
  return src.slice(start,src.indexOf('\n}',start)+2);}
const productSession=`let authEpoch=0;\n${fn('sessionContext')}\n${fn('sessionMatches')}`;
function context(code){const c=vm.createContext({URL,console:{log(){},warn(){},error(){}},setTimeout:()=>0,clearTimeout(){}});
  vm.runInContext(code+'\n'+productSession,c);return c;}
class Storage {
  data=new Map();alarm=null;
  async get(k){return structuredClone(this.data.get(k));}
  async put(k,v){this.data.set(k,structuredClone(v));}
  async getAlarm(){return this.alarm;}
  async setAlarm(v){this.alarm=v;}
  async deleteAll(){this.data.clear();}
  async transaction(fn){return fn(this);}
}
function workerFixture(){const buckets=new Map();let calls=0;
  const env={ALLOWED_ORIGINS:'https://app.example',DAILY_LIMIT:'1',ANTHROPIC_KEY:'fixture',
    QUOTA:{idFromName:n=>n,get(n){if(!buckets.has(n))buckets.set(n,new DailyQuota({storage:new Storage()}));
      return {fetch:(u,o)=>buckets.get(n).fetch(new Request(u,o))};}}};
  const worker=createWorker({verifyToken:async()=>({uid:'fixture',claims:{}}),generateProblems:async()=>{calls++;return [];}});
  const request=(method,extra={})=>new Request('https://worker.example/ai',{method,
    headers:{Origin:'https://app.example',Authorization:'Bearer fixture','Content-Type':'application/json'},
    ...(method==='POST'?{body:JSON.stringify({imageBase64:'YQ==',mimeType:'image/png',...extra})}:{})});
  return {env,worker,request,calls:()=>calls};
}
test('031: DELETE cannot reset actual DailyQuota; alarm still clears retained data',async()=>{
  const f=workerFixture(),statuses=[];
  for(const method of ['POST','POST','DELETE','POST']) statuses.push((await f.worker.fetch(f.request(method),f.env)).status);
  assert.deepEqual(statuses,[200,429,403,429]);assert.equal(f.calls(),1);
  const storage=new Storage();await storage.put('quota',{used:1});
  await new DailyQuota({storage}).alarm();assert.equal(await storage.get('quota'),undefined);
});
test('037: actual bytes bounded without Content-Length, before provider/quota',async()=>{
  const f=workerFixture();const req=f.request('POST',{unused:'a'.repeat(8*1024*1024+1)});
  assert.equal(req.headers.get('content-length'),null);
  assert.equal((await f.worker.fetch(req,f.env)).status,413);assert.equal(f.calls(),0);
  assert.equal((await f.worker.fetch(f.request('POST'),f.env)).status,200);
});
for(const aba of [false,true]) test('032: stale load discarded '+(aba?'A-B-A':'A-B'),async()=>{
  const c=context(`let currentUser={uid:'A'},sets=[],cloudSynced,localStamps={},writes=[],release;
    const gate=new Promise(r=>release=r);const SETS_COL=()=>({get:()=>gate});
    const localSetsWorthMerging=x=>x,readLocalSets=()=>[],mergeSets=x=>x,shouldUseCloudResult=()=>true;
    const docToSet=x=>x,cloudSyncEntry=x=>x,writeLocalNow=()=>writes.push(currentUser.uid);
    const isCloudSynced=()=>true,saveSets=()=>{},watchCloud=()=>{},toast=()=>{},loadSetsLocal=()=>{};
    const loadLibraryPrefs=async()=>{};`);
  /* ⚠️ **`loadSets` 가 부르는 것을 가짜로 넣지 말고 진짜를 함께 올린다.** `withTimeout` 을
     빼먹었더니 vm 에서 ReferenceError → `catch` 가 삼키고 **대체 경로로 흘러** 이 검사가
     엉뚱한 곳에서 터졌다(`REV-2026-064` 를 고치다 실제로 그랬다). 상한값도 소스에서
     읽어 온다 — 여기에 숫자를 적어 두면 제품과 갈라진다. */
  const cloudMs=/const CLOUD_READ_MS\s*=\s*(\d+)/.exec(src);
  assert.ok(cloudMs,'index.html 에서 CLOUD_READ_MS 를 찾지 못했습니다');
  vm.runInContext(`const CLOUD_READ_MS=${cloudMs[1]};`,c);
  vm.runInContext(fn('withTimeout'),c);
  vm.runInContext(fn('loadSets'),c);const pending=vm.runInContext('loadSets()',c);
  vm.runInContext(`authEpoch+=${aba?2:1};currentUser={uid:'${aba?'A':'B'}'};
    release({docs:[{data:()=>({id:'A-only'})}]})`,c);
  await pending;assert.equal(vm.runInContext('writes.length',c),0);
});
test('033: ack uses sent snapshot and schedules unsent revision',async()=>{
  const c=context(`let currentUser={uid:'A'},sets=[{id:'s',name:'v1'}],cloudSynced=new Map(),wiping=false;
    let sent=[],release,retries=0;const gate=new Promise(r=>release=r);
    const flushLocal=()=>true,setSaveStatus=()=>{},toast=()=>{};
    const cloudSyncEntry=s=>({json:JSON.stringify(s)}),isCloudSynced=s=>cloudSynced.get(s.id)?.json===JSON.stringify(s);
    const setToDoc=s=>JSON.parse(JSON.stringify(s)),SETS_COL=()=>({doc:id=>id});
    const rememberSetSyncMeta=()=>true,setSyncMetaEntry=()=>({});
    const fbDb={batch:()=>({set:(id,d)=>sent.push(d),commit:()=>gate})};
    const hasUnsavedCloudWork=()=>true;let localDirty=false;
    let setsOversizeKey="";const CLOUD_DOC_MAX=900*1024;`);
  const modern=src.includes('function writeCloudSnapshot(');
  if(modern) vm.runInContext(fn('docBytes'),c);   // 크기 방어가 쓰는 진짜 함수
  vm.runInContext(modern?'const flushToCloud=()=>{retries++;};\n'+fn('writeCloudSnapshot'):fn('flushToCloud'),c);
  const pending=vm.runInContext(modern?"writeCloudSnapshot('A',sessionContext())":"flushToCloud('A')",c);
  vm.runInContext("sets[0].name='v2';release()",c);await pending;
  assert.equal(vm.runInContext('sent[0].name',c),'v1');
  assert.equal(vm.runInContext('isCloudSynced(sets[0])',c),false);
  assert.equal(vm.runInContext('retries',c),1);
});
test('034: restoring image URL does not delete remote bytes',async()=>{
  const c=context(`let currentUser={uid:'A'},fbReady=true,sets=[{problems:[]}],deleted=[];
    const isStorageUrl=()=>true,storagePathsOf=()=>[];
    const fbStorage={refFromURL:u=>({delete:async()=>{deleted.push(u)}})};`);
  vm.runInContext(fn('releaseImage'),c);
  vm.runInContext("releaseImage('fixture');sets=[{problems:[{answerImg:'fixture'}]}]",c);
  await Promise.resolve();await Promise.resolve();assert.equal(vm.runInContext('deleted.length',c),0);
  assert.doesNotMatch(fn('deleteAllSets'),/await wipeStorageImages/,'backup-capable deletion preserves assets');
  assert.match(fn('deleteAccountEverything'),/await wipeStorageImages/,'permanent deletion still removes assets');
});
test('041: an upload that never attached is deleted, attached history remains',async()=>{
  const c=context(`let currentUser={uid:'A'},fbReady=true,deleted=[];
    const isStorageUrl=u=>u.startsWith('storage:'),fbStorage={refFromURL:u=>({delete:async()=>deleted.push(u)})};`);
  vm.runInContext(fn('releaseImage'),c);
  vm.runInContext("releaseImage('storage:history');releaseImage('storage:orphan',{attached:false})",c);
  await Promise.resolve();await Promise.resolve();
  assert.equal(vm.runInContext('JSON.stringify(deleted)',c),'["storage:orphan"]');
});
test('042: keepId, bounds, and lossless are independent',()=>{
  /* ⚠️ **진짜 모듈을 통째로 올린다.** 예전에는 index.html 에서 세 함수를 문자열로 떼어
     내고 `safeUrl`·`BLOCK_TYPES`·`SET_NAME_MAX` 를 **가짜로** 넣었다 — 그러면 상수가
     갈라져도 이 검사는 모른다(`REV-2026-040` 이 바로 그 방식 때문이었다).
     정규화를 별도 파일로 떼어 낸 뒤로는 그럴 이유가 없다: 진짜 상수·진짜 safeUrl 로 돈다. */
  const c=context('const window={};');
  vm.runInContext(fs.readFileSync('pedagogy-normalize.js','utf8'),c);
  vm.runInContext('const {normSet}=window.PedagogyNormalize;',c);
  assert.equal(vm.runInContext("window.PedagogyNormalize.safeUrl('https://storage.googleapis.com/pedagogy-test/image.png')",c),
    'https://storage.googleapis.com/pedagogy-test/image.png');
  vm.runInContext(`const many={id:'same',name:'n'.repeat(201),header:'h'.repeat(201),problems:Array.from({length:12},(_,i)=>({id:'q'+i,blocks:Array.from({length:51},()=>({type:'statement',data:{text:'x'.repeat(20001)}}))}))}`,c);
  assert.equal(vm.runInContext('normSet(many,{keepId:true,maxProblems:10}).problems.length',c),10);
  assert.equal(vm.runInContext('normSet(many,{keepId:1,maxProblems:10}).problems.length',c),10);
  assert.equal(vm.runInContext('normSet(many,{keepId:true,lossless:true}).problems.length',c),12);
  assert.equal(vm.runInContext('normSet(many,{keepId:true,lossless:true}).problems[0].blocks.length',c),51);
  assert.equal(vm.runInContext('normSet(many,{keepId:true,lossless:true}).problems[0].blocks[0].data.text.length',c),20001);
});
test('038: failed local writes retain dirty and close warning, retry clears them',()=>{
  const c=context(`let currentUser=null,localDirty=true,localTimer=0,wiping=false,sets=[{id:'unsaved'}],quotaWarned=false;
    const pendingLocalByOwner=new Map(),setsKey=()=> 'guest',setSaveStatus=()=>{},toast=()=>{};
    let broken=true,attempts=0;const localStorage={setItem:()=>{attempts++;if(broken)throw Error('fixture quota')}};`);
  vm.runInContext(fn('writeLocalNow')+'\n'+fn('flushLocal')+'\n'+fn('hasUnsavedCloudWork'),c);
  assert.equal(vm.runInContext('flushLocal()',c),false);
  assert.equal(vm.runInContext('localDirty && hasUnsavedCloudWork()',c),true);
  assert.equal(vm.runInContext('flushLocal()',c),false);assert.equal(vm.runInContext('attempts',c),2);
  assert.equal(vm.runInContext('broken=false;flushLocal()',c),true);
  assert.equal(vm.runInContext('localDirty || hasUnsavedCloudWork()',c),false);
});

test('032: repeated auth notification preserves edits; switching flushes old owner',async()=>{
  const c=context(`let currentUser={uid:'A'},sets=[{id:'work'}],currentSetId='work',currentQId='q';
    let localDirty=true,localTimer=0,histTimer=0,saveTimer=0,setsUnsub=null,prefsUnsub=null,prefsSaveTimer=null;
    let mocksUnsub=null,mockCloudTimer=null,mocks=[],mocksLoaded=false,mockOpenId="",mockMigrateAsked=false,mockWriteWarned=false;
    let pendingConsent=null; const recordConsent=()=>{};
    let mockCloudSynced=new Map(),mockDeletedIds=new Map(),mockCloudWarned=false;
    let libFolderFilter="",libPicking=false,uiLangPref="system";
    const libPicked=new Set(),readLibMeta=()=>{},applyUiLang=()=>{};
    let cloudSynced=new Map(),setSyncBase=new Map(),deletedIds=new Map(),pendingLocalByOwner=new Map(),writes=[];
    let authInitialized=true,prevUid='A',localStamps={},lastSnapshot=null,undoStack=[],redoStack=[];
    const flushLocal=()=>{writes.push(currentUser?.uid);return true;},setsKey=()=>currentUser?.uid,flushOpenMock=()=>{};
    const migrateSharedLocalCache=()=>{},migrateSharedAuxKeys=()=>{},loadLastQ=()=>{},readStamps=()=>({}),loadSetSyncMeta=()=>{};
    const $=()=>({style:{}}),updatePlanBadge=()=>{},inAppBrowserName=()=>null,showInAppNotice=()=>{};
    const bootLibrary=async()=>{},loadSets=async()=>{},showLibraryLoading=()=>{},snapshot=()=>'',updateHistButtons=()=>{},showLibrary=()=>{};`);
  const start=src.indexOf('const onAuth=async (user)=>{');
  vm.runInContext(src.slice(start,src.indexOf('\n};',start)+3),c);
  await vm.runInContext("onAuth({uid:'A'})",c);
  assert.equal(vm.runInContext("sets[0].id",c),'work');
  await vm.runInContext("onAuth({uid:'B'})",c);
  assert.equal(vm.runInContext('writes.join()',c),'A');
  assert.equal(vm.runInContext('localDirty',c),false);
  await vm.runInContext('onAuth(null)',c);
  vm.runInContext("sets=[{id:'guest-work'}]",c);await vm.runInContext('onAuth(null)',c);
  assert.equal(vm.runInContext('sets[0].id',c),'guest-work');
});

test('033: overlapping saves serialize and eventually acknowledge latest content',async()=>{
  const c=context(`let currentUser={uid:'A'},sets=[{id:'s',name:'v1'}],cloudSynced=new Map(),wiping=false,localDirty=false;
    let sent=[],gates=[],cloudSaveQueue=Promise.resolve();
    const flushLocal=()=>true,setSaveStatus=()=>{},toast=()=>{},hasUnsavedCloudWork=()=>false;
    const cloudSyncEntry=s=>({json:JSON.stringify(s)}),isCloudSynced=s=>cloudSynced.get(s.id)?.json===JSON.stringify(s);
    const setToDoc=s=>JSON.parse(JSON.stringify(s)),SETS_COL=()=>({doc:id=>id});
    const rememberSetSyncMeta=()=>true,setSyncMetaEntry=()=>({});
    const fbDb={batch:()=>({set:(id,d)=>sent.push(d),commit:()=>new Promise(r=>gates.push(r))})};
    let setsOversizeKey="";const CLOUD_DOC_MAX=900*1024;`);
  vm.runInContext(fn('docBytes'),c);              // 크기 방어가 쓰는 진짜 함수
  vm.runInContext(fn('flushToCloud')+'\n'+fn('writeCloudSnapshot'),c);
  const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
  const first=vm.runInContext("flushToCloud('A')",c);await tick();
  vm.runInContext("sets[0].name='v2';flushToCloud('A')",c);await tick();
  assert.equal(vm.runInContext('sent.length',c),1);
  vm.runInContext('gates.shift()()',c);await first;await tick();
  assert.equal(vm.runInContext('sent[1].name',c),'v2');
  assert.equal(vm.runInContext('isCloudSynced(sets[0])',c),false);
  vm.runInContext('gates.shift()()',c);await tick();
  assert.equal(vm.runInContext('isCloudSynced(sets[0])',c),true);
});
