// REV-2026-114: exercise the real per-document CAS writer and server subscription.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
const red=process.env.B6_REMOTE_RED==='1';
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
    if(red&&url.pathname==='/index.html')return route.fulfill({
      contentType:'text/html',
      body:execFileSync('git',['show','d7ad822:index.html'],{encoding:'utf8',maxBuffer:5000000})
    });
    return route.continue();
  });
  const page=await context.newPage();
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>typeof writeCloudSnapshot==='function');
  async function fixture({order=['x','y'],future=false,malformed=false}={}){
    await page.evaluate(({order,future,malformed})=>{
      clearTimeout(saveTimer);saveTimer=null;
      localStorage.clear();currentUser={uid:'review-114'};authEpoch++;fbReady=true;wiping=false;
      window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,libraryCloudSchema:1,setRevisionSchema:1};
      loadSetSyncMeta(currentUser.uid);cloudSynced.clear();setWriteBase.clear();deletedIds.clear();
      if(typeof intakeRemoteBlocked!=='undefined')intakeRemoteBlocked.clear();
      sets=order.map(id=>normSet({id,name:id.toUpperCase(),header:'로컬 초안',problems:[{
        id:'p-'+id,title:'직접 수정',blocks:[{type:'statement',data:{text:'보존할 본문'}}]
      }]},{keepId:true,lossless:true}));
      window.__original=structuredClone(sets);
      window.__remote=new Map();window.__writes=[];window.__status=[];window.__toasts=[];window.__requeues=0;
      window.toast=message=>__toasts.push(message);
      window.setSaveStatus=message=>__status.push(message);
      window.flushToCloud=async()=>{__requeues++;};
      window.__snapshot=(metadata={fromCache:false,hasPendingWrites:false})=>({
        metadata,docs:[...__remote.values()].map(data=>({data:()=>structuredClone(data)})),
        docChanges:()=>[...__remote.values()].map(data=>({type:'modified',doc:{data:()=>structuredClone(data)}}))
      });
      const collection=()=>({doc:id=>({id,collection}),get:async()=>__snapshot(),onSnapshot:(_options,fn)=>{window.__watch=fn;return ()=>{};}});
      window.loadLibraryPrefs=async()=>{};
      fbDb={collection,runTransaction:async run=>{
        const writes=[];
        const result=await run({
          get:async ref=>({exists:__remote.has(ref.id),data:()=>structuredClone(__remote.get(ref.id))}),
          set:(ref,data)=>writes.push([ref.id,structuredClone(data)])
        });
        for(const [id,data] of writes){__remote.set(id,data);__writes.push(id);}
        return result;
      }};
      if(future){
        const x=sets.find(s=>s.id==='x');
        const doc=setToDoc(x,order.indexOf('x'),{revision:3});
        doc.problems[0].intake=malformed
          ?{version:1,sources:[{sourceId:'bad-id',pages:[1]}]}
          :{version:2,sources:[],future:'원격 원문 유지'};
        __remote.set('x',doc);window.__future=structuredClone(doc);
      }
      localDirty=true;writeLocalNow();showLibrary();
    },{order,future,malformed});
  }
  const result=()=>page.evaluate(()=>({
    remote:[...__remote.entries()],writes:__writes,status:__status,toasts:__toasts,requeues:__requeues,
    local:sets,disk:JSON.parse(localStorage.getItem(setsKey())),
    conflicts:[...readSetConflicts(currentUser.uid).keys()],original:__original,future:window.__future
  }));
  const checks=[],failures=[];
  async function check(name,run){
    checks.push(name);
    try{await run();console.log('PASS',name);}
    catch(error){failures.push(name+': '+error.message);console.log('FAIL',name,error.message);}
  }
  async function saveThree(){
    await page.evaluate(async()=>{
      for(let i=0;i<3;i++)await writeCloudSnapshot(currentUser.uid,sessionContext());
      idleSaveStatus(currentUser.uid);renderLibrary();
    });
  }
  await check('114 empty-server control saves X and Y across three passes',async()=>{
    await fixture();await saveThree();const r=await result();
    assert.deepEqual(r.remote.map(([id])=>id),['x','y']);assert.equal(r.status.at(-1),'');
    assert.equal(r.requeues,0);assert.deepEqual(r.local,r.original);
  });
  for(const order of [['x','y'],['y','x']]){
    const position=order[0]==='x'?'first':'last';
    await check(`114 future remote ${position} holds only X and saves Y`,async()=>{
      await fixture({order,future:true});await saveThree();const r=await result();
      assert.ok(r.remote.some(([id])=>id==='y'),'Y must be saved');
      assert.deepEqual(r.remote.find(([id])=>id==='x')[1],r.future);
      assert.deepEqual(r.local,r.original);assert.deepEqual(r.disk,r.original);
      assert.deepEqual(r.conflicts,[]);assert.deepEqual(r.writes,['y']);
      assert.equal(r.requeues,0,'blocked X must not automatically requeue');
      assert.ok(r.status.at(-1).includes('업데이트 필요')&&r.status.at(-1).includes('계정 저장 보류'),'specific update hold required');
      assert.ok(!r.status.includes('⚠ 저장 실패'));assert.ok(!r.toasts.some(t=>t.includes('클라우드 저장에 실패')));
      assert.ok((await page.locator('#setGrid').innerText()).includes('업데이트 필요 · 계정 저장 보류'));
      const deletion=await page.evaluate(async()=>{
        let confirms=0;window.confirm=()=>{confirms++;return false;};
        libPicked.clear();libPicked.add('x');await $('#selDeleteBtn').onclick();
        return {confirms,local:sets};
      });
      assert.equal(deletion.confirms,0,'read-only X must be excluded from bulk deletion');
      assert.deepEqual(deletion.local,r.original);
    });
  }
  await check('114 malformed remote intake also isolates its document',async()=>{
    await fixture({future:true,malformed:true});await saveThree();const r=await result();
    assert.ok(r.remote.some(([id])=>id==='y'),'Y must be saved');
    assert.deepEqual(r.remote.find(([id])=>id==='x')[1],r.future);assert.equal(r.requeues,0);assert.deepEqual(r.conflicts,[]);
  });
  await check('114 server watch keeps dirty local draft and exposes update hold',async()=>{
    await fixture({future:true});
    await page.evaluate(()=>{showEditor('x');watchCloud();__watch(__snapshot());});
    const before=await result();assert.deepEqual(before.local,before.original);
    assert.ok((await page.locator('#setGrid').innerText()).includes('업데이트 필요 · 계정 저장 보류'));
    assert.equal(await page.locator('#editorView').evaluate(el=>el.style.display),'none');
    assert.equal(await page.evaluate(()=>intakeSnapshot().unknown),true);
    await saveThree();const r=await result();assert.deepEqual(r.writes,['y']);assert.deepEqual(r.conflicts,[]);assert.equal(r.requeues,0);
  });
  await check('114 first server read rebuilds hold while preserving a dirty cached draft',async()=>{
    await fixture({future:true});
    await page.evaluate(async()=>{await loadSets();clearTimeout(saveTimer);saveTimer=null;renderLibrary();});
    const before=await result();assert.deepEqual(before.local,before.original);
    assert.ok((await page.locator('#setGrid').innerText()).includes('업데이트 필요 · 계정 저장 보류'));
    await saveThree();const r=await result();assert.deepEqual(r.writes,['y']);assert.equal(r.requeues,0);
  });
  await check('114 cache/pending cannot release hold; compatible server ACK can',async()=>{
    await fixture({future:true});await saveThree();
    const r=await page.evaluate(async()=>{
      watchCloud();
      __remote.set('x',setToDoc(sets.find(s=>s.id==='x'),0,{revision:4}));
      __watch(__snapshot({fromCache:true,hasPendingWrites:false}));
      const cacheBlocked=intakeSetReadOnly(sets.find(s=>s.id==='x'));
      __watch(__snapshot({fromCache:false,hasPendingWrites:true}));
      const pendingBlocked=intakeSetReadOnly(sets.find(s=>s.id==='x'));
      __watch(__snapshot());
      const serverBlocked=intakeSetReadOnly(sets.find(s=>s.id==='x'));
      await writeCloudSnapshot(currentUser.uid,sessionContext());idleSaveStatus(currentUser.uid);
      return {cacheBlocked,pendingBlocked,serverBlocked,status:__status.at(-1),conflicts:[...readSetConflicts(currentUser.uid).keys()]};
    });
    assert.deepEqual(r,{cacheBlocked:true,pendingBlocked:true,serverBlocked:false,status:'',conflicts:[]});
  });
  await check('114 clean local adopts opaque server read-only without a conflict copy',async()=>{
    await fixture({future:true});
    await page.evaluate(()=>{const x=sets.find(s=>s.id==='x');cloudSynced.set('x',cloudSyncEntry(x,0));watchCloud();__watch(__snapshot());});
    const r=await result();assert.equal(r.local[0].problems[0].intake.version,2);assert.deepEqual(r.conflicts,[]);
    await saveThree();assert.equal((await result()).requeues,0);
  });
  await check('114 known incompatible local is excluded from automatic rescheduling',async()=>{
    await fixture();
    await page.evaluate(()=>{sets[0].problems[0].intake={version:2,sources:[]};localDirty=true;});
    await saveThree();const r=await result();assert.deepEqual(r.writes,['y']);assert.equal(r.requeues,0);
  });
  await check('114 owner change cannot carry X hold into another account',async()=>{
    await fixture({future:true});await saveThree();
    await page.evaluate(()=>{
      currentUser={uid:'other-114'};authEpoch++;__remote.clear();__writes=[];
      sets=structuredClone(__original);cloudSynced.clear();setWriteBase.clear();loadSetSyncMeta(currentUser.uid);localDirty=true;readLocalSets();
    });
    await saveThree();const r=await result();assert.deepEqual(r.writes,['x','y']);assert.equal(r.status.at(-1),'');
  });
  await check('114 unexpected Firestore errors retain the generic failure path',async()=>{
    await fixture();
    await page.evaluate(()=>{fbDb.runTransaction=async()=>{throw Error('fixture unavailable');};});
    await saveThree();const r=await result();assert.deepEqual(r.writes,[]);assert.ok(r.status.includes('⚠ 저장 실패'));
  });
  if(red){
    assert.ok(failures.some(f=>f.startsWith('114 future remote first')&&f.includes('Y must be saved')));
    assert.ok(failures.some(f=>f.startsWith('114 future remote last')&&f.includes('specific update hold required')));
    assert.ok(!failures.some(f=>f.startsWith('114 empty-server control')));
    console.log(`RED 114: old per-document failure handling detected (${failures.length} failed checks)`);
  }else{
    assert.deepEqual(failures,[]);console.log(`PASS ${checks.length} REV-114 reproduction/boundary checks`);
  }
}finally{await browser?.close();server.kill();}
