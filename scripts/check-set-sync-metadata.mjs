/* R4/B2 owner별 문제집 동기화 기준 메타데이터를 진짜 브라우저에서 확인한다.
 * 계약: docs/STORAGE-CONTRACT.md §2-2 · 스키마/Rules 변경 없음.
 * 깨보기: SET_SYNC_META_RED=1 이면 B2 직전 fdcf622의 index.html을 서빙한다.
 */
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const BASE_COMMIT='fdcf622';
const base='http://127.0.0.1:18885';
const server=spawn('python3',['serve.py','--port','18885'],{stdio:'ignore'});
const EXPECTED_CHECKS=9;
let browser, harnessFailure=null, checksRun=0;
const failures=[];

async function open(){
  const p=await browser.newPage({viewport:{width:1280,height:900},locale:'ko-KR'});
  p.setDefaultTimeout(8000);
  await p.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(process.env.SET_SYNC_META_RED==='1' && u.pathname==='/index.html')
      return r.fulfill({contentType:'text/html',body:execFileSync('git',['show',BASE_COMMIT+':index.html'])});
    return u.origin===base?r.continue():r.abort();
  });
  await p.goto(base+'/index.html');
  await p.waitForFunction(()=>typeof writeCloudSnapshot==='function' && typeof setToDoc==='function');
  return p;
}

async function stub(p,{owner='owner-a',chars=10,commitFails=false}={}){
  return p.evaluate(({owner,chars,commitFails})=>{
    localStorage.clear();
    // B2의 구 batch/무 revision 호환 계약은 운영 플래그가 1로 전환돼도 계속 검증한다.
    window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,setRevisionSchema:0};
    wiping=false; fbReady=true; currentUser={uid:owner}; authEpoch++;
    cloudSynced.clear(); deletedIds.clear(); setsOversizeKey='';
    if(typeof loadSetSyncMeta==='function') loadSetSyncMeta(owner);
    localDirty=true;
    window.__batched=[]; window.__commits=0; window.__toasts=[];
    window.toast=m=>window.__toasts.push(String(m));
    window.setSaveStatus=()=>{};
    window.flushToCloud=async()=>{};
    const col=()=>({
      doc:id=>({__id:String(id),collection:col}),
      onSnapshot(...args){
        window.__watchOptions=typeof args[0]==='object'?args[0]:null;
        window.__watchSnapshot=typeof args[0]==='function'?args[0]:args[1];
        return ()=>{};
      }
    });
    fbDb={collection:col,batch:()=>({
      set(ref){ window.__batched.push(ref.__id); },
      async commit(){ window.__commits++; if(commitFails) throw new Error('injected commit failure'); }
    })};
    sets=[{id:'set-a',name:'기준 문제집',header:'',lineColor:'indigo',subject:'math',
      problems:[{id:'p-a',title:'',desc:'',answer:'',answerImg:'',numLabel:'',paired:false,
        blocks:[{type:'statement',data:{text:'가'.repeat(chars)}}]}]}];
  },{owner,chars,commitFails});
}

async function check(name,run){
  let p;
  try{ p=await open(); }
  catch(e){ throw new Error(`${name} 페이지 준비 실패 — ${e.message}`); }
  try{ checksRun++; await run(p); console.log('PASS',name); }
  catch(e){
    if(e?.code!=='ERR_ASSERTION') throw new Error(`${name} 실행 실패 — ${e.message}`);
    failures.push(name); console.error('FAIL',name,'—',e.message);
  }finally{ if(p) await p.close(); }
}

try{
  for(let i=0;i<80;i++){
    try{ if((await fetch(base+'/health')).ok) break; }catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  browser=await chromium.launch();

  await check('성공한 ACK만 owner 키에 저장한다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const raw=localStorage.getItem('PM_SET_SYNC_META_V1:owner-a');
      const meta=raw?JSON.parse(raw):null;
      return {ok,batched:window.__batched,meta,docHasRevision:Object.hasOwn(setToDoc(sets[0],0),'revision')};
    });
    assert.equal(r.ok,true); assert.deepEqual(r.batched,['set-a']);
    assert.equal(r.meta?.v,1); assert.equal(r.meta?.entries?.length,1);
    assert.equal(r.meta.entries[0].id,'set-a'); assert.equal(r.meta.entries[0].revision,null);
    assert.equal(r.meta.entries[0].order,0);
    assert.match(r.meta.entries[0].contentHash,/^v1:[0-9a-z]+:[0-9a-f]{32}$/);
    assert.equal(r.docHasRevision,false,'B2에서 Firestore 스키마를 바꾸면 안 된다');
  });

  await check('새로고침 뒤 hash와 order가 맞을 때만 기준을 돌려준다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof loadSetSyncMeta==='function'&&typeof setSyncBaseFor==='function';
      if(!available) return {available};
      await writeCloudSnapshot(currentUser.uid,sessionContext());
      setSyncBase=new Map(); loadSetSyncMeta(currentUser.uid);
      const exact=setSyncBaseFor(sets[0],0);
      sets[0].name='로컬에서 바꿈';
      const changed=setSyncBaseFor(sets[0],0);
      sets[0].name='기준 문제집';
      const reordered=setSyncBaseFor(sets[0],1);
      return {available,exact:!!exact,changed:!!changed,reordered:!!reordered};
    });
    assert.equal(r.available,true); assert.equal(r.exact,true);
    assert.equal(r.changed,false); assert.equal(r.reordered,false);
  });

  await check('크기 초과로 빠진 문제집은 ACK하지 않는다',async p=>{
    await stub(p,{chars:330000});
    const r=await p.evaluate(async()=>{
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const raw=localStorage.getItem('PM_SET_SYNC_META_V1:owner-a');
      return {ok,batched:window.__batched,entries:raw?(JSON.parse(raw).entries||[]):[]};
    });
    assert.equal(r.ok,false); assert.deepEqual(r.batched,[]); assert.deepEqual(r.entries,[]);
  });

  await check('다른 원격본 관측은 기준을 전진시키지 않고 채택 뒤에만 전진한다',async p=>{
    await stub(p);
    const r=await p.evaluate(()=>{
      const available=typeof reconcileSetSyncMeta==='function'&&typeof setSyncMetaEntry==='function';
      if(!available) return {available};
      const original=JSON.parse(JSON.stringify(sets[0]));
      rememberSetSyncMeta(currentUser.uid,[{id:original.id,entry:setSyncMetaEntry(original,0,3)}]);
      sets[0].name='로컬 변경';
      const remote=setToDoc({...original,name:'서버 변경'},0); remote.revision=4;
      reconcileSetSyncMeta(currentUser.uid,[remote],sets);
      const afterObserve=setSyncBase.get(original.id);
      const divergentBase=setSyncBaseFor(sets[0],0);
      sets[0]=docToSet(remote);
      reconcileSetSyncMeta(currentUser.uid,[remote],sets);
      const afterAccept=setSyncBase.get(original.id);
      return {available,observedRevision:afterObserve?.revision,divergentBase:!!divergentBase,
        acceptedRevision:afterAccept?.revision,acceptedBase:!!setSyncBaseFor(sets[0],0)};
    });
    assert.equal(r.available,true); assert.equal(r.observedRevision,3);
    assert.equal(r.divergentBase,false); assert.equal(r.acceptedRevision,4); assert.equal(r.acceptedBase,true);
  });

  await check('owner 전환과 삭제가 메타데이터 칸을 분리한다',async p=>{
    await stub(p);
    const r=await p.evaluate(()=>{
      const available=typeof loadSetSyncMeta==='function'&&typeof accountLocalKeys==='function';
      if(!available) return {available};
      rememberSetSyncMeta('owner-a',[{id:sets[0].id,entry:setSyncMetaEntry(sets[0],0,2)}]);
      currentUser={uid:'owner-b'}; authEpoch++; loadSetSyncMeta('owner-b');
      const bStartsEmpty=setSyncBase.size===0;
      rememberSetSyncMeta('owner-b',[{id:sets[0].id,entry:setSyncMetaEntry(sets[0],0,7)}]);
      currentUser={uid:'owner-a'}; authEpoch++; loadSetSyncMeta('owner-a');
      const aRevision=setSyncBase.get(sets[0].id)?.revision;
      const keys=accountLocalKeys(); clearLocalKeys(keys,{keepBackup:false}); setSyncBase.clear();
      const aGone=localStorage.getItem('PM_SET_SYNC_META_V1:owner-a')===null;
      const bKept=localStorage.getItem('PM_SET_SYNC_META_V1:owner-b')!==null;
      currentUser=null; loadSetSyncMeta(null);
      const guestWrite=rememberSetSyncMeta(null,[{id:sets[0].id,entry:setSyncMetaEntry(sets[0],0,1)}]);
      return {available,bStartsEmpty,aRevision,aGone,bKept,guestWrite,
        guestKey:localStorage.getItem('PM_SET_SYNC_META_V1:guest')};
    });
    assert.equal(r.available,true); assert.equal(r.bStartsEmpty,true); assert.equal(r.aRevision,2);
    assert.equal(r.aGone,true); assert.equal(r.bKept,true); assert.equal(r.guestWrite,false); assert.equal(r.guestKey,null);
  });

  await check('실패한 cloud commit은 ACK를 남기지 않는다',async p=>{
    await stub(p,{commitFails:true});
    const r=await p.evaluate(async()=>{
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      return {ok,meta:localStorage.getItem('PM_SET_SYNC_META_V1:owner-a')};
    });
    assert.equal(r.ok,false); assert.equal(r.meta,null);
  });

  await check('pending·cache snapshot은 ACK가 아니고 서버 확정만 기준을 만든다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof watchCloud==='function'&&typeof reconcileSetSyncMeta==='function';
      if(!available) return {available};
      watchCloud();
      const doc=setToDoc(sets[0],0);
      const queryDoc={data:()=>doc};
      const snapshot=metadata=>({metadata,docs:[queryDoc],docChanges:()=>[{doc:queryDoc}]});
      fbDb.batch=()=>({
        set(){},
        async commit(){
          window.__watchSnapshot(snapshot({hasPendingWrites:true,fromCache:false}));
          const e=new Error('PERMISSION_DENIED'); e.code='permission-denied'; throw e;
        }
      });
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const afterPending=localStorage.getItem('PM_SET_SYNC_META_V1:owner-a');
      const pendingSynced=cloudSynced.has('set-a');
      window.__watchSnapshot(snapshot({hasPendingWrites:false,fromCache:true}));
      const afterCache=localStorage.getItem('PM_SET_SYNC_META_V1:owner-a');
      const cacheSynced=cloudSynced.has('set-a');
      window.__watchSnapshot(snapshot({hasPendingWrites:false,fromCache:false}));
      const afterServer=localStorage.getItem('PM_SET_SYNC_META_V1:owner-a');
      const serverSynced=cloudSynced.has('set-a');
      return {available,ok,afterPending,afterCache,afterServer,pendingSynced,cacheSynced,serverSynced};
    });
    assert.equal(r.available,true); assert.equal(r.ok,false);
    assert.equal(r.afterPending,null,'실패할 수도 있는 로컬 지연 보상 snapshot을 ACK하면 안 된다');
    assert.equal(r.pendingSynced,false,'pending snapshot이 cloudSynced를 전진시키면 안 된다');
    assert.equal(r.afterCache,null,'cache snapshot을 서버 ACK로 취급하면 안 된다');
    assert.equal(r.cacheSynced,false,'cache snapshot이 cloudSynced를 전진시키면 안 된다');
    assert.ok(r.afterServer,'서버 확정 snapshot은 동일 로컬본의 기준을 만들어야 한다');
    assert.equal(r.serverSynced,true);
  });

  await check('초기 cache read는 서버 ACK 대신 로컬본으로 이어간다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof isServerAcknowledgedSnapshot==='function';
      if(!available) return {available};
      const doc=setToDoc(sets[0],0), queryDoc={data:()=>doc};
      const setCol={
        get:async()=>({metadata:{hasPendingWrites:false,fromCache:true},docs:[queryDoc]}),
        onSnapshot(){ return ()=>{}; },
        doc:id=>({__id:String(id)})
      };
      fbDb={collection:()=>({doc:()=>({collection:()=>setCol})})};
      cloudSynced.clear(); setSyncBase.clear();
      window.__localLoads=0;
      window.loadSetsLocal=()=>{ window.__localLoads++; };
      window.loadLibraryPrefs=async()=>{};
      await loadSets();
      return {available,localLoads:window.__localLoads,synced:cloudSynced.has('set-a'),
        meta:localStorage.getItem('PM_SET_SYNC_META_V1:owner-a')};
    });
    assert.equal(r.available,true); assert.equal(r.localLoads,1);
    assert.equal(r.synced,false); assert.equal(r.meta,null);
  });

  await check('보류 snapshot의 다른 원격 변경을 다음 서버 확정 때 복구한다',async p=>{
    await stub(p);
    const r=await p.evaluate(()=>{
      const available=typeof isServerAcknowledgedSnapshot==='function';
      if(!available) return {available};
      sets.push({id:'set-b',name:'옛 B',header:'',lineColor:'indigo',subject:'math',problems:[]});
      watchCloud();
      const a=setToDoc(sets[0],0);
      const remoteB=setToDoc({...sets[1],name:'원격 새 B'},1);
      const qa={data:()=>a}, qb={data:()=>remoteB};
      window.__watchSnapshot({
        metadata:{hasPendingWrites:true,fromCache:false},docs:[qa,qb],
        docChanges:()=>[{doc:qa},{doc:qb}]
      });
      const afterPending=sets.find(s=>s.id==='set-b')?.name;
      /* includeMetadataChanges로 오는 서버 확정 event는 metadata만 바뀌어 delta가 비어 있다. */
      window.__watchSnapshot({
        metadata:{hasPendingWrites:false,fromCache:false},docs:[qa,qb],docChanges:()=>[]
      });
      return {available,options:window.__watchOptions,afterPending,
        afterConfirmed:sets.find(s=>s.id==='set-b')?.name};
    });
    assert.equal(r.available,true);
    assert.equal(r.options?.includeMetadataChanges,true,'서버 확정 metadata event를 구독해야 한다');
    assert.equal(r.afterPending,'옛 B');
    assert.equal(r.afterConfirmed,'원격 새 B');
  });
}catch(e){ harnessFailure=e; console.error('FAIL 하네스 —',e.message); }
finally{ if(browser) await browser.close(); server.kill(); }

if(harnessFailure) process.exit(1);
if(process.env.SET_SYNC_META_RED==='1'){
  if(checksRun!==EXPECTED_CHECKS){ console.error(`깨보기 실패 — ${EXPECTED_CHECKS}건 중 ${checksRun}건만 실행됐다.`); process.exit(1); }
  if(failures.length){ console.log(`깨보기 OK — B2 전 ${BASE_COMMIT}에서 ${failures.length}건 실패`); process.exit(0); }
  console.error('깨보기 실패 — B2 전 코드인데도 전부 통과했다.'); process.exit(1);
}
if(failures.length){ console.error('실패:',failures.join(', ')); process.exit(1); }
if(checksRun!==EXPECTED_CHECKS){ console.error(`실패: ${EXPECTED_CHECKS}건 중 ${checksRun}건만 실행됐다.`); process.exit(1); }
console.log(`owner별 동기화 기준 메타데이터 통과 — ${EXPECTED_CHECKS}건`);
