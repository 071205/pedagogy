/* R4/B3 문제집 revision/CAS 상태기계를 실제 브라우저에서 확인한다.
 * 운영 Firebase에는 연결하지 않으며 메모리 transaction 경계를 쓴다.
 * SET_REVISION_RED=1이면 B3 직전 4ea6fa7의 index.html을 서빙한다.
 */
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const BASE_COMMIT='4ea6fa7';
const base='http://127.0.0.1:18886';
const server=spawn('python3',['serve.py','--port','18886'],{stdio:'ignore'});
const EXPECTED_CHECKS=16;
let browser, harnessFailure=null, checksRun=0;
const failures=[];

async function open(){
  const p=await browser.newPage({viewport:{width:1280,height:900},locale:'ko-KR'});
  p.setDefaultTimeout(8000);
  await p.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(process.env.SET_REVISION_RED==='1'&&u.pathname==='/index.html')
      return r.fulfill({contentType:'text/html',body:execFileSync('git',['show',BASE_COMMIT+':index.html'])});
    return u.origin===base?r.continue():r.abort();
  });
  await p.goto(base+'/index.html');
  await p.waitForFunction(()=>typeof writeCloudSnapshot==='function'&&typeof setToDoc==='function');
  return p;
}

async function stub(p,{schema=1,owner='owner-a'}={}){
  return p.evaluate(({schema,owner})=>{
    localStorage.clear(); wiping=false; fbReady=true; currentUser={uid:owner}; authEpoch++;
    window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,
      libraryCloudSchema:1,setRevisionSchema:schema};
    cloudSynced.clear(); deletedIds.clear(); setsOversizeKey='';
    if(typeof setsBadShapeKey!=='undefined') setsBadShapeKey='';
    cloudSaveQueue=Promise.resolve();
    if(typeof loadSetSyncMeta==='function') loadSetSyncMeta(owner);
    if(typeof setWriteBase!=='undefined') setWriteBase.clear();
    localDirty=true; window.__remote=new Map(); window.__txCalls=0; window.__txSets=0;
    window.__batchCommits=0; window.__requeues=0; window.__toasts=[]; window.__status=[];
    window.toast=m=>window.__toasts.push(String(m));
    window.setSaveStatus=m=>window.__status.push(String(m));
    window.flushToCloud=async()=>{ window.__requeues++; };
    const clone=v=>JSON.parse(JSON.stringify(v));
    const col=()=>({
      onSnapshot(...args){window.__watchOptions=typeof args[0]==='object'?args[0]:null;
        window.__watchSnapshot=typeof args[0]==='function'?args[0]:args[1];return ()=>{};},
      doc:id=>({
      __id:String(id),collection:col,
      async set(data){ window.__remote.set(String(id),clone(data)); }
    })});
    fbDb={
      collection:col,
      batch:()=>{const writes=[];return {
        set:(ref,data)=>writes.push([ref.__id,clone(data)]),
        async commit(){window.__batchCommits++;writes.forEach(([id,d])=>window.__remote.set(id,d));}
      };},
      runTransaction:async run=>{
        window.__txCalls++;const writes=[];
        const tx={
          get:async ref=>{const data=window.__remote.get(ref.__id);return {
            exists:data!==undefined,data:()=>clone(data)
          };},
          set:(ref,data)=>{window.__txSets++;writes.push([ref.__id,clone(data)]);}
        };
        const result=await run(tx);writes.forEach(([id,d])=>window.__remote.set(id,d));return result;
      }
    };
    sets=[{id:'set-a',name:'로컬',header:'',lineColor:'indigo',subject:'math',problems:[]}];
  },{schema,owner});
}

async function check(name,run){
  let p;
  try{p=await open();}
  catch(e){throw new Error(`${name} 페이지 준비 실패 — ${e.message}`);}
  try{checksRun++;await run(p);console.log('PASS',name);}
  catch(e){
    if(e?.code!=='ERR_ASSERTION')throw new Error(`${name} 실행 실패 — ${e.message}`);
    failures.push(name);console.error('FAIL',name,'—',e.message);
  }finally{if(p)await p.close();}
}

try{
  for(let i=0;i<80;i++){
    try{if((await fetch(base+'/health')).ok)break;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  browser=await chromium.launch();

  await check('플래그 0은 구 batch 문서 모양을 유지한다',async p=>{
    await stub(p,{schema:0});
    const r=await p.evaluate(async()=>{
      const available=typeof setRevisionEnabled==='function';
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const doc=window.__remote.get('set-a');
      return {available,ok,revision:doc?.revision,tx:window.__txCalls,batch:window.__batchCommits};
    });
    assert.equal(r.available,true);assert.equal(r.ok,true);assert.equal(r.revision,undefined);
    assert.equal(r.tx,0);assert.equal(r.batch,1);
  });

  await check('신규 문서는 transaction으로 revision 1을 만든다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof writeSetDocRevision==='function';if(!available)return {available};
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const doc=window.__remote.get('set-a'),meta=JSON.parse(localStorage.getItem('PM_SET_SYNC_META_V1:owner-a'));
      return {available,ok,revision:doc?.revision,meta:meta?.entries?.[0]?.revision,
        tx:window.__txCalls,sets:window.__txSets};
    });
    assert.equal(r.available,true);assert.equal(r.ok,true);assert.equal(r.revision,1);
    assert.equal(r.meta,1);assert.equal(r.tx,1);assert.equal(r.sets,1);
  });

  await check('ACK 뒤 사라진 문서는 신규로 되살리지 않고 충돌 처리한다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof writeSetDocRevision==='function';if(!available)return {available};
      const old=setToDoc({...sets[0],name:'삭제 전 기준'},0);old.revision=3;
      setWriteBase.set('set-a',setWriteBaseEntryFromDoc(old));
      sets[0].name='내 초안';
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      return {available,ok,exists:window.__remote.has('set-a'),local:sets[0].name,
        requeues:window.__requeues,status:window.__status.at(-1),toasts:window.__toasts};
    });
    assert.equal(r.available,true);assert.equal(r.ok,false);assert.equal(r.exists,false);
    assert.equal(r.local,'내 초안');assert.equal(r.requeues,0);assert.match(r.status,/충돌/);
    assert.ok(r.toasts.some(x=>x.includes('초안은 보존')));
  });

  await check('정규화 동등 서버의 no-write ACK는 다음 수정의 유효한 CAS 기준이 된다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof setWriteBaseEntryFromDoc==='function';if(!available)return {available};
      sets[0].problems=[{id:'q',title:'',desc:'',answer:'',answerImg:'',numLabel:'',paired:false,
        blocks:[{type:'statement',data:{text:'first'}}]}];
      const canonical=setToDoc(docToSet(setToDoc(sets[0],0)),0);canonical.revision=1;
      window.__remote.set('set-a',canonical);
      const first=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const baseMatches=setWriteBaseMatchesDoc(setWriteBase.get('set-a'),window.__remote.get('set-a'));
      sets[0].problems[0].blocks[0].data.text='second';
      const second=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const doc=window.__remote.get('set-a');
      return {available,first,baseMatches,firstWrites:window.__txSets,second,revision:doc.revision,
        text:doc.problems[0].blocks[0].data.text,status:window.__status.at(-1)};
    });
    assert.equal(r.available,true);assert.equal(r.first,true);assert.equal(r.baseMatches,true);
    assert.equal(r.firstWrites,1,'첫 ACK 자체는 쓰지 않고 두 번째 수정만 써야 한다');
    assert.equal(r.second,true);assert.equal(r.revision,2);assert.equal(r.text,'second');
    assert.doesNotMatch(r.status||'',/충돌/);
  });

  await check('검증된 구 문서 base는 수정본으로 revision 1 승격한다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof setWriteBaseEntryFromDoc==='function';if(!available)return {available};
      const server=setToDoc({...sets[0],name:'서버 구본'},0);window.__remote.set('set-a',server);
      cloudSynced.set('set-a',cloudSyncEntry(docToSet(server),0));
      setWriteBase.set('set-a',setWriteBaseEntryFromDoc(server));
      sets[0].name='승격 수정본';
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const doc=window.__remote.get('set-a');return {available,ok,name:doc.name,revision:doc.revision};
    });
    assert.equal(r.available,true);assert.equal(r.ok,true);
    assert.equal(r.name,'승격 수정본');assert.equal(r.revision,1);
  });

  await check('revision 수정과 재정렬은 정확히 +1한다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof writeSetDocRevision==='function';if(!available)return {available};
      const server=setToDoc({...sets[0],name:'기준'},0);server.revision=4;
      window.__remote.set('set-a',server);setWriteBase.set('set-a',setWriteBaseEntryFromDoc(server));
      const target=setToDoc({...sets[0],name:'수정'},3);
      const result=await writeSetDocRevision(currentUser.uid,target,sessionContext());
      return {available,revision:result.doc.revision,order:window.__remote.get('set-a').order};
    });
    assert.equal(r.available,true);assert.equal(r.revision,5);assert.equal(r.order,3);
  });

  await check('이미 반영된 같은 내용은 쓰지 않고 현재 revision을 ACK한다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof writeSetDocRevision==='function';if(!available)return {available};
      const server=setToDoc(sets[0],0);server.revision=7;window.__remote.set('set-a',server);
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const meta=JSON.parse(localStorage.getItem('PM_SET_SYNC_META_V1:owner-a'));
      return {available,ok,revision:meta?.entries?.[0]?.revision,txSets:window.__txSets};
    });
    assert.equal(r.available,true);assert.equal(r.ok,true);assert.equal(r.revision,7);assert.equal(r.txSets,0);
  });

  await check('stale base 충돌은 서버와 로컬 초안을 모두 보존하고 재귀 재시도하지 않는다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof writeSetDocRevision==='function';if(!available)return {available};
      const old=setToDoc({...sets[0],name:'옛 기준'},0);old.revision=2;
      const remote={...old,name:'다른 기기',revision:3};window.__remote.set('set-a',remote);
      cloudSynced.set('set-a',cloudSyncEntry(docToSet(old),0));
      setWriteBase.set('set-a',setWriteBaseEntryFromDoc(old));sets[0].name='내 초안';
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      return {available,ok,remote:window.__remote.get('set-a').name,local:sets[0].name,
        requeues:window.__requeues,status:window.__status.at(-1),toasts:window.__toasts};
    });
    assert.equal(r.available,true);assert.equal(r.ok,false);assert.equal(r.remote,'다른 기기');
    assert.equal(r.local,'내 초안');assert.equal(r.requeues,0);assert.match(r.status,/충돌/);
    assert.ok(r.toasts.some(x=>x.includes('초안은 보존')));
  });

  await check('새로고침된 dirty 초안은 영속 base만으로 덮어쓰지 않는다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof setWriteBaseEntryFromDoc==='function';if(!available)return {available};
      const server=setToDoc({...sets[0],name:'서버 기준'},0);server.revision=2;
      window.__remote.set('set-a',server);cloudSynced.set('set-a',cloudSyncEntry(docToSet(server),0));
      rememberSetSyncMeta(currentUser.uid,[{id:'set-a',entry:setSyncMetaEntry(server,0,2)}]);
      sets[0].name='재로드된 초안';loadSetSyncMeta(currentUser.uid);
      const runtimeBase=setWriteBase.size,ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      return {available,runtimeBase,ok,remote:window.__remote.get('set-a').name,local:sets[0].name};
    });
    assert.equal(r.available,true);assert.equal(r.runtimeBase,0);assert.equal(r.ok,false);
    assert.equal(r.remote,'서버 기준');assert.equal(r.local,'재로드된 초안');
  });

  await check('혼합 저장은 성공 문서만 ACK하고 충돌 문서는 남긴다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof writeSetDocRevision==='function';if(!available)return {available};
      sets=[{id:'ok',name:'ok-local',header:'',lineColor:'indigo',subject:'math',problems:[]},
        {id:'conflict',name:'mine',header:'',lineColor:'indigo',subject:'math',problems:[]}];
      const okBase=setToDoc({...sets[0],name:'ok-base'},0);okBase.revision=1;
      const stale=setToDoc({...sets[1],name:'old'},1);stale.revision=1;
      const changed={...stale,name:'remote',revision:2};
      window.__remote.set('ok',okBase);window.__remote.set('conflict',changed);
      cloudSynced.set('ok',cloudSyncEntry(docToSet(okBase),0));
      cloudSynced.set('conflict',cloudSyncEntry(docToSet(stale),1));
      setWriteBase.set('ok',setWriteBaseEntryFromDoc(okBase));
      setWriteBase.set('conflict',setWriteBaseEntryFromDoc(stale));
      const ok=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const meta=JSON.parse(localStorage.getItem('PM_SET_SYNC_META_V1:owner-a'));
      return {available,ok,good:window.__remote.get('ok'),bad:window.__remote.get('conflict'),
        revisions:Object.fromEntries((meta?.entries||[]).map(e=>[e.id,e.revision]))};
    });
    assert.equal(r.available,true);assert.equal(r.ok,false);assert.equal(r.good.name,'ok-local');
    assert.equal(r.good.revision,2);assert.equal(r.bad.name,'remote');assert.equal(r.bad.revision,2);
    assert.equal(r.revisions.ok,2);assert.equal(r.revisions.conflict,undefined);
  });

  await check('tombstone과 같은 세션 Undo 복원도 각각 +1한다',async p=>{
    await stub(p);
    const r=await p.evaluate(async()=>{
      const available=typeof writeSetDocRevision==='function';if(!available)return {available};
      const removed=JSON.parse(JSON.stringify(sets[0]));
      const server=setToDoc(removed,0);server.revision=2;window.__remote.set('set-a',server);
      cloudSynced.set('set-a',cloudSyncEntry(removed,0));setWriteBase.set('set-a',setWriteBaseEntryFromDoc(server));
      sets=[];await deleteSetEverywhere(removed);const tomb=window.__remote.get('set-a');
      sets=[removed];const restored=await writeCloudSnapshot(currentUser.uid,sessionContext());
      const doc=window.__remote.get('set-a');return {available,tombRevision:tomb.revision,tombDeleted:tomb.deleted,
        restored,revision:doc.revision,deleted:doc.deleted};
    });
    assert.equal(r.available,true);assert.equal(r.tombRevision,3);assert.equal(r.tombDeleted,true);
    assert.equal(r.restored,true);assert.equal(r.revision,4);assert.equal(r.deleted,false);
  });

  await check('revision 초기 병합은 updatedAt 대신 divergent 로컬 초안을 보존한다',async p=>{
    await stub(p);
    const r=await p.evaluate(()=>{
      const available=typeof mergeSetsWithRevision==='function';if(!available)return {available};
      const local={...sets[0],name:'오프라인 초안'};
      const remote=setToDoc({...sets[0],name:'서버 변경'},0);remote.revision=3;remote.updatedAt=9999999999999;
      const tomb={...setToDoc({...sets[0],id:'deleted',name:'',problems:[]},1),deleted:true,revision:4};
      const localDeleted={...sets[0],id:'deleted',name:'삭제와 겹친 초안'};
      const merged=mergeSetsWithRevision([remote,tomb],[local,localDeleted]);
      return {available,names:Object.fromEntries(merged.map(s=>[s.id,s.name]))};
    });
    assert.equal(r.available,true);assert.equal(r.names['set-a'],'오프라인 초안');
    assert.equal(r.names.deleted,'삭제와 겹친 초안');
  });

  await check('revision 초기 병합은 clean 로컬 캐시에 전진한 서버본과 tombstone을 적용한다',async p=>{
    await stub(p);
    const r=await p.evaluate(()=>{
      const available=typeof mergeSetsWithRevision==='function';if(!available)return {available};
      sets=[{...sets[0],name:'기준'},
        {id:'deleted',name:'삭제 전 기준',header:'',lineColor:'indigo',subject:'math',problems:[]}];
      const baseA=setToDoc(sets[0],0);baseA.revision=1;
      const baseDeleted=setToDoc(sets[1],1);baseDeleted.revision=4;
      rememberSetSyncMeta(currentUser.uid,[
        {id:'set-a',entry:setSyncMetaEntry(sets[0],0,1)},
        {id:'deleted',entry:setSyncMetaEntry(sets[1],1,4)}
      ]);
      const remote={...baseA,name:'다른 기기 최신',revision:2};
      const tomb={...baseDeleted,name:'',problems:[],deleted:true,revision:5};
      const merged=mergeSetsWithRevision([remote,tomb],sets);
      return {available,ids:merged.map(s=>s.id),name:merged.find(s=>s.id==='set-a')?.name};
    });
    assert.equal(r.available,true);assert.deepEqual(r.ids,['set-a']);
    assert.equal(r.name,'다른 기기 최신');
  });

  await check('listener의 새 revision은 dirty 로컬을 덮지 않고 서버 관측만 갱신한다',async p=>{
    await stub(p);
    const r=await p.evaluate(()=>{
      const available=typeof setWriteBaseEntryFromDoc==='function';if(!available)return {available};
      const base=setToDoc({...sets[0],name:'기준'},0);base.revision=1;
      cloudSynced.set('set-a',cloudSyncEntry(docToSet(base),0));
      setWriteBase.set('set-a',setWriteBaseEntryFromDoc(base));sets[0].name='내 초안';
      watchCloud();
      const remote={...base,name:'다른 기기',revision:2,updatedAt:Date.now()+10000};
      const q={data:()=>remote};window.__watchSnapshot({
        metadata:{hasPendingWrites:false,fromCache:false},docs:[q],docChanges:()=>[{doc:q}]
      });
      const observed=cloudSynced.get('set-a');
      return {available,local:sets[0].name,observedRemote:observed?.json===setJSON(docToSet(remote)),
        writeBaseRevision:setWriteBase.get('set-a')?.revision};
    });
    assert.equal(r.available,true);assert.equal(r.local,'내 초안');
    assert.equal(r.observedRemote,true);assert.equal(r.writeBaseRevision,1);
  });

  await check('fallback 뒤 listener는 영속 ACK와 같은 clean 로컬에 새 revision을 적용한다',async p=>{
    await stub(p);
    const r=await p.evaluate(()=>{
      const available=typeof setWriteBaseEntryFromDoc==='function';if(!available)return {available};
      sets[0].name='기준';
      const base=setToDoc(sets[0],0);base.revision=1;
      rememberSetSyncMeta(currentUser.uid,[{id:'set-a',entry:setSyncMetaEntry(sets[0],0,1),
        writeEntry:setWriteBaseEntryFromDoc(base)}]);
      loadSetSyncMeta(currentUser.uid);cloudSynced.clear();watchCloud();
      const remote={...base,name:'서버 최신',revision:2};const q={data:()=>remote};
      window.__watchSnapshot({metadata:{hasPendingWrites:false,fromCache:false},docs:[q],docChanges:()=>[{doc:q}]});
      return {available,name:sets[0].name,synced:isCloudSynced(sets[0],0),
        writeBase:setWriteBase.get('set-a')?.revision};
    });
    assert.equal(r.available,true);assert.equal(r.name,'서버 최신');
    assert.equal(r.synced,true);assert.equal(r.writeBase,2);
  });

  await check('listener 혼합 snapshot의 앞선 삭제가 뒤 clean 문서를 거짓 충돌로 만들지 않는다',async p=>{
    await stub(p);
    const r=await p.evaluate(()=>{
      const available=typeof setWriteBaseEntryFromDoc==='function';if(!available)return {available};
      sets=[{id:'a',name:'old a',header:'',lineColor:'indigo',subject:'math',problems:[]},
        {id:'b',name:'old b',header:'',lineColor:'indigo',subject:'math',problems:[]}];
      const a=setToDoc(sets[0],0);a.revision=1;const b=setToDoc(sets[1],1);b.revision=1;
      cloudSynced.set('a',cloudSyncEntry(sets[0],0));cloudSynced.set('b',cloudSyncEntry(sets[1],1));
      rememberSetSyncMeta(currentUser.uid,[
        {id:'a',entry:setSyncMetaEntry(sets[0],0,1),writeEntry:setWriteBaseEntryFromDoc(a)},
        {id:'b',entry:setSyncMetaEntry(sets[1],1,1),writeEntry:setWriteBaseEntryFromDoc(b)}
      ]);
      watchCloud();
      const tomb={...a,name:'',problems:[],deleted:true,revision:2};
      const remoteB={...b,name:'new b',order:0,revision:2};
      const qa={data:()=>tomb},qbOld={data:()=>b},qbNew={data:()=>remoteB};
      window.__watchSnapshot({metadata:{hasPendingWrites:false,fromCache:false},docs:[qa,qbOld],
        docChanges:()=>[{doc:qa}]});
      window.__watchSnapshot({metadata:{hasPendingWrites:false,fromCache:false},docs:[qa,qbNew],
        docChanges:()=>[{doc:qbNew}]});
      return {available,ids:sets.map(s=>s.id),name:sets[0]?.name,synced:isCloudSynced(sets[0],0),
        writeBase:setWriteBase.get('b')?.revision};
    });
    assert.equal(r.available,true);assert.deepEqual(r.ids,['b']);assert.equal(r.name,'new b');
    assert.equal(r.synced,true);assert.equal(r.writeBase,2);
  });
}catch(e){harnessFailure=e;console.error('FAIL 하네스 —',e.message);}
finally{if(browser)await browser.close();server.kill();}

if(harnessFailure)process.exit(1);
if(process.env.SET_REVISION_RED==='1'){
  if(checksRun!==EXPECTED_CHECKS){console.error(`깨보기 실패 — ${EXPECTED_CHECKS}건 중 ${checksRun}건만 실행됐다.`);process.exit(1);}
  if(failures.length){console.log(`깨보기 OK — B3 전 ${BASE_COMMIT}에서 ${failures.length}건 실패`);process.exit(0);}
  console.error('깨보기 실패 — B3 전 코드인데도 전부 통과했다.');process.exit(1);
}
if(failures.length){console.error('실패:',failures.join(', '));process.exit(1);}
if(checksRun!==EXPECTED_CHECKS){console.error(`실패: ${EXPECTED_CHECKS}건 중 ${checksRun}건만 실행됐다.`);process.exit(1);}
console.log(`문제집 revision/CAS 통과 — ${EXPECTED_CHECKS}건`);
