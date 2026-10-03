import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

function indexedDBFixture(){
  const databases=new Map();let failOutbox=false;
  return {set failOutbox(value){failOutbox=value;},records(name){return databases.get(name)?.records;},open(name){
    const request={};
    queueMicrotask(()=>{
      if(!databases.has(name))databases.set(name,{records:new Map(),queue:Promise.resolve()});
      const state=databases.get(name);
      const db={close(){},createObjectStore(){},transaction(_store,mode){
        const staged=[],tx={error:null,aborted:false,abort(){this.aborted=true;},objectStore(){return {
          get(key){const r={};tx.get={key,r};return r;},
          put(value){if(failOutbox&&Object.keys(value.outbox||{}).length)throw Error('injected outbox write failure');
            staged.push(['put',value.owner,structuredClone(value)]);},
          delete(key){staged.push(['delete',key]);}
        };}};
        state.queue=state.queue.then(()=>new Promise(done=>setTimeout(()=>{
          try{
            if(tx.get){tx.get.r.result=structuredClone(state.records.get(tx.get.key));tx.get.r.onsuccess?.();}
            if(tx.aborted){tx.onabort?.();done();return;}
            if(mode==='readwrite')for(const [op,key,value] of staged){
              if(op==='put')state.records.set(key,value);else state.records.delete(key);
            }
            tx.oncomplete?.();
          }catch(error){tx.error=error;tx.onerror?.();}
          done();
        },0)));
        return tx;
      }};
      request.result=db;request.onupgradeneeded?.();request.onsuccess?.();
    });
    return request;
  }};
}
const config={files:2,fileBytes:1000,totalBytes:3000,pages:2,minDimension:1,maxDimension:1000,imageBytes:1000,
  requestBytes:2000,calls:2,retries:1,problemsPerPage:2,problemsPerJob:4,problemsPerSet:500,fieldChars:1000,blocks:10,items:10};
const renderer={count:async()=>1,page:async()=>({imageBase64:'aGVsbG8=',mimeType:'image/png',width:200,height:200,bytes:5})};
const file=()=>new File(['raw'],'fixture.png',{type:'image/png'});
function fixture(baseline=false){
  const indexedDB=indexedDBFixture(),env={structuredClone,crypto,File,Blob,TextEncoder,Uint8Array,
    AbortController,DOMException,URL,atob,indexedDB,
    navigator:{locks:{request:async(_key,run)=>run()},storage:{persisted:async()=>true}},
    setTimeout,clearTimeout,Date,PedagogyNormalize:{normProblem:value=>value}};
  let onMessage;
  const ORIGIN='https://pedagogy.fixture';
  env.self={location:{origin:ORIGIN},addEventListener(type,listener){if(type==='message')onMessage=listener;}};
  vm.createContext(env);
  vm.runInContext(readFileSync('pedagogy-intake-contract.js','utf8'),env);
  const intake=baseline?execFileSync('git',['show','d4762f6:pedagogy-intake.js'],{encoding:'utf8'})
    :readFileSync('pedagogy-intake.js','utf8');
  vm.runInContext(intake,env);
  if(!baseline)vm.runInContext(readFileSync('pedagogy-intake-sw.js','utf8'),env);
  let calls=0;
  function outbox(fixtureOptions={},{origin=ORIGIN,source={id:'client-1'}}={}){return {async send(request,meta){
    calls++;
    let message,work;
    onMessage({origin,source,data:{type:'PM_B7_FIXTURE_SEND',request,...meta,fixture:fixtureOptions},
      ports:[{postMessage(value){message=value;},close(){}}],waitUntil(p){work=p;}});
    await work;
    if(!message){const error=Error('injected lost delivery');error.ambiguous=true;throw error;}
    if(!message.ok){const error=Error(message.error);error.ambiguous=true;throw error;}
    return message.reply;
  }};}
  return {env,indexedDB,outbox,get calls(){return calls;}};
}
function library(){
  let sets=[];
  return {get sets(){return sets;},snapshot:()=>({sets,conflicts:[],recovery:[],deleted:[],unknown:false,cloudReady:true,online:true}),
    exclusive:run=>run(),commit:async next=>{sets=next;return true;},cloud:()=> 'pending'};
}
function client(f,session,lib,outbox){
  return f.env.PedagogyIntake.create({config,renderer,session,library:lib,outbox,dbName:'b7-fixture'});
}
async function main(baseline=false){
  const f=fixture(baseline),state={owner:'A',epoch:1},session=()=>({...state}),lib=library();
  const c=client(f,session,lib,f.outbox());
  const {jobId}=await c.createJob([file()]);
  if(baseline){
    await assert.rejects(c.run(jobId),/C1~C3/);
    assert.equal(typeof c.recoverOutbox,'undefined');
    console.log('RED d4762f6: outbox 전송·복구 API 없음');return;
  }
  await c.run(jobId);
  let job=await c.readJob(jobId);
  assert.equal(job.pages[0].state,'success');assert.equal(job.drafts.length,1);
  assert.equal(Object.keys(f.indexedDB.records('b7-fixture').get('A').outbox).length,0);
  const plan={draftVersion:job.draftVersion,destinations:[{id:'one',name:'한 권',items:[{draftId:job.drafts[0].id,placementId:'p1'}]}]};
  const first=await c.adopt(jobId,plan),again=await c.adopt(jobId,plan);
  assert.equal(first.adoption.id,again.adoption.id);assert.equal(lib.sets.length,1);
  assert.equal((await c.recoverOutbox(jobId)).length,0);assert.equal((await c.readJob(jobId)).drafts.length,1);
  console.log('PASS SW 저장→페이지 전달→원자적 소비·중복 채택 없음');

  const lost=client(f,session,lib,f.outbox({dropDelivery:true}));
  const lostId=(await lost.createJob([file()])).jobId;
  await lost.run(lostId);
  assert.equal((await lost.readJob(lostId)).pages[0].state,'locked');
  assert.equal(Object.keys(f.indexedDB.records('b7-fixture').get('A').outbox).length,1);
  const count=f.calls;
  state.owner='B';state.epoch++;
  assert.deepEqual(await lost.recoverOutbox(lostId),[]);
  const other=client(f,session,lib,f.outbox());
  assert.deepEqual(await other.recoverOutbox(),[]);
  state.owner='A';state.epoch++;
  const next=client(f,session,lib,f.outbox());
  assert.equal((await next.recoverOutbox()).length,1);
  await next.run(lostId);
  assert.equal((await next.readJob(lostId)).pages[0].state,'success');
  assert.equal(f.calls,count);
  console.log('PASS 전달 유실 뒤 재실행 복구·다른 owner 비노출·자동 재호출 없음');

  f.indexedDB.failOutbox=true;
  const failed=client(f,session,lib,f.outbox()),failedId=(await failed.createJob([file()])).jobId;
  await failed.run(failedId);
  job=await failed.readJob(failedId);
  assert.equal(job.pages[0].state,'locked');assert.equal(job.drafts.length,0);
  f.indexedDB.failOutbox=false;
  assert.deepEqual(await failed.recoverOutbox(failedId),[]);
  console.log('PASS outbox 쓰기 실패 시 응답 성공 표시 없음');

  const switching=client(f,session,lib,f.outbox({delayMs:100}));
  const switchingId=(await switching.createJob([file()])).jobId;
  const switched=switching.run(switchingId).catch(()=>{});
  for(let i=0;i<200&&(await switching.readJob(switchingId)).pages[0].state!=='processing';i++)
    await new Promise(r=>setTimeout(r,2));
  state.owner='B';state.epoch++;
  await switched;
  assert.deepEqual(await client(f,session,lib,f.outbox()).recoverOutbox(),[]);
  state.owner='A';state.epoch++;
  const returned=client(f,session,lib,f.outbox());
  assert.equal((await returned.recoverOutbox(switchingId)).length,1);
  assert.equal((await returned.readJob(switchingId)).pages[0].state,'success');
  console.log('PASS 응답 대기 중 계정 전환은 이전 owner에만 보존');

  const restarting=client(f,session,lib,f.outbox({delayMs:100}));
  const restartId=(await restarting.createJob([file()])).jobId;
  const inFlight=restarting.run(restartId);
  for(let i=0;i<200&&(await restarting.readJob(restartId)).pages[0].state!=='processing';i++)
    await new Promise(r=>setTimeout(r,2));
  // A new page can mark an ambiguous processing attempt locked while the SW
  // is still finishing its durable write. That write must remain recoverable.
  f.indexedDB.records('b7-fixture').get('A').jobs[restartId].pages[0].state='locked';
  await inFlight;
  assert.equal((await restarting.readJob(restartId)).pages[0].state,'success');
  console.log('PASS 재실행 잠금과 교차한 늦은 SW 보존도 복구');

  const deletion=client(f,session,lib,f.outbox({delayMs:100}));
  const deleteId=(await deletion.createJob([file()])).jobId;
  const sourceId=(await deletion.readJob(deleteId)).sources[0];
  const pending=deletion.run(deleteId).catch(()=>{});
  for(let i=0;i<200&&(await deletion.readJob(deleteId)).pages[0].state!=='processing';i++)
    await new Promise(r=>setTimeout(r,2));
  const impact=await deletion.impact(sourceId);
  await deletion.deleteSource(sourceId,{ticket:impact.ticket,confirmed:true});
  await pending;
  const root=f.indexedDB.records('b7-fixture').get('A');
  assert.equal(root.sources[sourceId].state,'deleted');
  assert.equal(Object.values(root.outbox||{}).some(x=>x.sourceId===sourceId),false);
  assert.equal(root.jobs[deleteId].drafts.length,0);
  console.log('PASS 원문 삭제 세대 변경 중 늦은 SW 응답 폐기');

  const account=client(f,session,lib,f.outbox({delayMs:100}));
  const accountId=(await account.createJob([file()])).jobId;
  const accountPending=account.run(accountId).catch(()=>{});
  for(let i=0;i<200&&(await account.readJob(accountId)).pages[0].state!=='processing';i++)
    await new Promise(r=>setTimeout(r,2));
  await account.purge();await accountPending;
  const fenced=f.indexedDB.records('b7-fixture').get('A');
  assert.equal(fenced.deleted,true);assert.deepEqual(fenced.outbox,{});
  console.log('PASS 계정 삭제 fence 뒤 늦은 SW 응답 폐기');

  // 다른 출처가 보낸 메시지는 무시한다 — 보존도 답도 하지 않는다(SonarCloud 보안 지적 · 출처 확인 깨보기)
  state.owner='C';state.epoch++;
  const foreign=client(f,session,lib,f.outbox({}, {origin:'https://evil.example'}));
  const foreignId=(await foreign.createJob([file()])).jobId;
  await foreign.run(foreignId);
  const foreignRoot=f.indexedDB.records('b7-fixture').get('C');
  assert.equal(Object.keys(foreignRoot.outbox||{}).length,0,'다른 출처 메시지를 보존했다');
  assert.equal(foreignRoot.jobs[foreignId].drafts.length,0,'다른 출처 메시지로 초안이 생겼다');
  console.log('PASS 다른 출처가 보낸 메시지는 보존·응답하지 않음');
}
await main(process.env.B7_RED==='1');
