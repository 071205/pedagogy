// REV-2026-115: real save queue + library retry, with a held X and movable Y.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';

const red=process.env.B6_FOLDER_RED==='1';
const oldHtml=red?execFileSync('git',['show','5ef97af:index.html'],{encoding:'utf8',maxBuffer:5000000}):null;
const port=await new Promise(resolve=>{
  const socket=createServer();
  socket.listen(0,'127.0.0.1',()=>{
    const value=socket.address().port;
    socket.close(()=>resolve(value));
  });
});
const base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
let browser;
try{
  for(let i=0;i<80;i++){
    try{if((await fetch(base+'/health')).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch();
  const context=await browser.newContext();
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base)return route.abort();
    if(red&&url.pathname==='/index.html')return route.fulfill({contentType:'text/html',body:oldHtml});
    return route.continue();
  });
  const page=await context.newPage();
  async function fixture({future=true}={}){
    // A fresh document retains the real flushToCloud and clears prior save timers.
    await page.goto(base+'/index.html');
    await page.waitForFunction(()=>typeof retryLibrarySync==='function');
    await page.evaluate(async future=>{
      clearTimeout(saveTimer);saveTimer=null;
      localStorage.clear();currentUser={uid:'review-115'};authEpoch++;fbReady=true;wiping=false;
      window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,libraryCloudSchema:1,setRevisionSchema:1};
      loadSetSyncMeta(currentUser.uid);cloudSynced.clear();setWriteBase.clear();deletedIds.clear();intakeRemoteBlocked.clear();
      sets=['x','y'].map(id=>normSet({id,name:id.toUpperCase(),problems:[{
        id:'p-'+id,title:'보존할 초안',blocks:[{type:'statement',data:{text:'본문'}}]
      }]},{keepId:true,lossless:true}));
      libMeta=normLibMeta({folders:[{id:'folder-1',name:'수학',order:0}]});
      window.__original=structuredClone(sets);
      window.__remote=new Map();window.__writes=[];window.__status=[];window.__toasts=[];
      window.__failPath=null;
      window.toast=message=>__toasts.push(message);
      window.setSaveStatus=message=>__status.push(message);
      // Full paths keep the prefs transaction separate from per-set transactions.
      const ref=path=>({path,doc:id=>ref(path+'/'+id),collection:name=>ref(path+'/'+name)});
      fbDb={collection:name=>ref(name),runTransaction:async run=>{
        const writes=[];
        const result=await run({
          get:async r=>{
            if(r.path===__failPath)throw Error('fixture unavailable');
            return {exists:__remote.has(r.path),data:()=>structuredClone(__remote.get(r.path))};
          },
          set:(r,data)=>writes.push([r.path,structuredClone(data)])
        });
        for(const [path,data] of writes){__remote.set(path,data);__writes.push(path);}
        return result;
      }};
      window.__xPath='users/review-115/sets/x';
      window.__yPath='users/review-115/sets/y';
      window.__prefsPath='users/review-115/prefs/library';
      if(future){
        const doc=setToDoc(sets[0],0,{revision:3});
        doc.problems[0].intake={version:2,sources:[],future:'원격 원문 유지'};
        __remote.set(__xPath,doc);window.__future=structuredClone(doc);
      }
      localDirty=true;writeLocalNow();showLibrary();
      await flushToCloud(currentUser.uid); // The original first-save reproduction.
      __toasts=[];__status=[];__writes=[];
    },future);
  }
  async function moveY(folderId='folder-1'){
    await page.evaluate(async folderId=>{
      sets[1].folderId=folderId;localDirty=true;libMeta.syncPending=true;
      await retryLibrarySync();
    },folderId);
  }
  const result=()=>page.evaluate(()=>({
    x:__remote.get(__xPath),y:__remote.get(__yPath),prefs:__remote.get(__prefsPath),
    future:window.__future,original:__original,local:sets,disk:JSON.parse(localStorage.getItem(setsKey())),
    pending:libMeta.syncPending,toasts:__toasts,status:__status,writes:__writes,
    retry:$('#folderBar').textContent.includes('폴더 동기화 재시도'),
    conflicts:[...readSetConflicts(currentUser.uid).keys()],readonly:intakeSetReadOnly(sets[0])
  }));
  const failures=[];
  let checks=0;
  async function check(name,run){
    checks++;
    try{await run();console.log('PASS',name);}
    catch(error){failures.push(name+': '+error.message);console.log('FAIL',name,error.message);}
  }
  function assertMoved(r,folderId='folder-1'){
    assert.equal(r.y.folderId,folderId,'Y folder must actually reach the server');
    assert.equal(r.disk[1].folderId,folderId,'Y folder must persist locally');
    assert.equal(r.pending,false,'successful Y move must clear pending');
    assert.equal(r.retry,false,'successful Y move must remove retry button');
    assert.deepEqual(r.toasts,[],'successful Y move must not emit a failure');
  }
  await check('115 empty-server control saves folder without a false failure',async()=>{
    await fixture({future:false});await moveY();assertMoved(await result());
  });
  await check('115 held X allows Y folder move without a false failure',async()=>{
    await fixture();await moveY();const r=await result();assertMoved(r);
    assert.deepEqual(r.x,r.future);assert.deepEqual(r.local[0],r.original[0]);
    assert.deepEqual(r.disk[0],r.original[0]);assert.deepEqual(r.conflicts,[]);assert.equal(r.readonly,true);
    assert.ok(r.status.at(-1).includes('업데이트 필요 · 계정 저장 보류'));
    assert.deepEqual(r.writes,['users/review-115/prefs/library','users/review-115/sets/y']);
  });
  await check('115 held X allows repeated folder moves and direct save success',async()=>{
    await fixture();await moveY();await moveY('');const r=await result();assertMoved(r,'');
    const ok=await page.evaluate(async()=>{sets[1].header='다음 수정';localDirty=true;return await flushToCloud(currentUser.uid);});
    assert.equal(ok,true,'eligible Y ACK must return true despite held X');
    assert.deepEqual((await result()).x,r.future);
  });
  await check('115 folder rename succeeds with held X and no dirty eligible set',async()=>{
    await fixture();
    await page.evaluate(async()=>{libMeta.folders[0].name='수학 개정';libMeta.syncPending=true;await retryLibrarySync();});
    const r=await result();assert.equal(r.prefs.folders[0].name,'수학 개정');
    assert.equal(r.pending,false);assert.equal(r.retry,false);assert.deepEqual(r.toasts,[]);assert.deepEqual(r.x,r.future);
    assert.ok(r.status.at(-1).includes('업데이트 필요 · 계정 저장 보류'));
  });
  await check('115 held X itself cannot open the folder move dialog',async()=>{
    await fixture();
    const r=await page.evaluate(()=>{openFolderMove(['x']);return {ids:movingSetIds,open:$('#folderMoveDialog').open};});
    assert.deepEqual(r,{ids:[],open:false});assert.deepEqual((await result()).x,(await result()).future);
  });
  await check('115 real Y transaction failure retains pending and failure notice',async()=>{
    await fixture();await page.evaluate(()=>{__failPath=__yPath;});await moveY();const r=await result();
    assert.notEqual(r.y.folderId,'folder-1');assert.equal(r.pending,true);assert.equal(r.retry,true);
    assert.ok(r.toasts.includes('폴더 소속 저장 실패 · 다시 시도해 주세요'));
  });
  await check('115 real prefs transaction failure retains pending and failure notice',async()=>{
    await fixture();await page.evaluate(()=>{__failPath=__prefsPath;});await moveY();const r=await result();
    assert.equal(r.pending,true);assert.equal(r.retry,true);assert.equal(r.prefs,undefined);
    assert.ok(r.toasts.includes('폴더 동기화 실패 · 다시 시도해 주세요'));
  });
  await check('115 local quota failure does not become a successful folder save',async()=>{
    await fixture();
    await page.evaluate(()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(key===setsKey())throw new DOMException('fixture quota','QuotaExceededError');
        return original.call(this,key,value);
      };
    });
    await moveY();const r=await result();assert.equal(r.y.folderId,'folder-1');
    assert.notEqual(r.disk[1].folderId,'folder-1');assert.equal(r.pending,true);assert.equal(r.retry,true);
    assert.ok(r.status.includes('⚠ 로컬 저장 실패'));assert.deepEqual(r.x,r.future);
  });
  if(red){
    assert.equal(failures.length,2);
    assert.ok(failures.every(f=>/^115 held X allows/.test(f)&&f.includes('successful Y move must clear pending')));
    console.log('RED 115: Y server/local ACK succeeded but old code falsely kept folder retry pending (2 checks)');
  }else{
    assert.deepEqual(failures,[]);console.log(`PASS ${checks} REV-115 reproduction/boundary checks`);
  }
}finally{await browser?.close();server.kill();}
