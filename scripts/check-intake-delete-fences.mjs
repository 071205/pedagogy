import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

// A small asynchronous IDB fixture keeps these two races runnable without a
// network listener, browser, Firebase, or an AI service.
function indexedDBFixture(){
  const databases=new Map();
  return {open(name){
    const request={};
    queueMicrotask(()=>{
      if(!databases.has(name)){
        databases.set(name,{records:new Map(),queue:Promise.resolve()});
        request.result={createObjectStore(){}};
        request.onupgradeneeded?.();
      }
      const db=databases.get(name);
      request.result={createObjectStore(){},transaction(_name,mode){
        const staged=[],tx={error:null,aborted:false,abort(){this.aborted=true;},objectStore(){return {
          get(key){const r={};tx.get={key,r};return r;},
          put(value){staged.push(['put',value.owner,structuredClone(value)]);},
          delete(key){staged.push(['delete',key]);}
        };}};
        db.queue=db.queue.then(()=>new Promise(done=>setTimeout(()=>{
          try{
            if(tx.get){tx.get.r.result=structuredClone(db.records.get(tx.get.key));tx.get.r.onsuccess?.();}
            if(tx.aborted){tx.onabort?.();done();return;}
            if(mode==='readwrite')for(const [action,key,value] of staged){
              if(action==='put')db.records.set(key,value);else db.records.delete(key);
            }
            tx.oncomplete?.();
          }catch(error){tx.error=error;tx.onerror?.();}
          done();
        },0)));
        return tx;
      }};
      request.onsuccess?.();
    });
    return request;
  }};
}
function fixture(preFix=false){
  const env={structuredClone,crypto,File,Blob,TextEncoder,Uint8Array,AbortController,DOMException,URL,atob,
    indexedDB:indexedDBFixture(),navigator:{locks:{request:async(_key,run)=>run()},storage:{persisted:async()=>true}}};
  vm.createContext(env);
  const intake=preFix?execFileSync('git',['show','28089b3:pedagogy-intake.js'],{encoding:'utf8'}):readFileSync('pedagogy-intake.js','utf8');
  vm.runInContext(readFileSync('pedagogy-intake-contract.js','utf8'),env);
  vm.runInContext(intake,env);
  return env;
}
const config={files:2,fileBytes:1000,totalBytes:3000,pages:2,minDimension:1,maxDimension:1000,imageBytes:1000,
  requestBytes:2000,calls:2,retries:1,problemsPerPage:1,problemsPerJob:2,problemsPerSet:500,fieldChars:1000,blocks:10,items:10};
const renderer={count:async()=>1,page:async()=>({imageBase64:'aGVsbG8=',mimeType:'image/png',width:200,height:200,bytes:5})};
const file=name=>new File(['raw'],name,{type:'image/png'});
const response={task:'problem-intake-v1',problems:[{title:'',answer:'',blocks:[{type:'statement',text:'문제'}],
  units:[],difficulty:'중',points:null,pointsState:'absent',group:null}]};
const waitFor=async(predicate)=>{
  const until=Date.now()+3000;
  while(!predicate()&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(predicate(),'fixture request did not start');
};
async function check116(preFix){
  const env=fixture(preFix),pending=new Map(),aborted=[];
  const session=()=>({owner:'owner-116',epoch:1});
  const library={snapshot:()=>({sets:[],conflicts:[],recovery:[],deleted:[],unknown:false,cloudReady:true,online:true}),
    exclusive:run=>run()};
  const client=env.PedagogyIntake.create({config,renderer,session,library,dbName:'116',
    transport:(request,{signal})=>new Promise((resolve,reject)=>{
      const sourceId=request.attempt.sourceId;
      pending.set(sourceId,resolve);
      signal.addEventListener('abort',()=>{aborted.push(sourceId);reject(new DOMException('aborted','AbortError'));},{once:true});
    })});
  const a=await client.createJob([file('a.png')]),b=await client.createJob([file('b.png')]);
  const sourceA=(await client.readJob(a.jobId)).sources[0],sourceB=(await client.readJob(b.jobId)).sources[0];
  const runningA=client.run(a.jobId).catch(e=>e),runningB=client.run(b.jobId);
  await waitFor(()=>pending.size===2);
  const impact=await client.impact(sourceA);
  await client.deleteSource(sourceA,{ticket:impact.ticket,confirmed:true});
  assert.ok(aborted.includes(sourceA),'A request must be aborted');
  const bAborted=aborted.includes(sourceB);
  if(!bAborted)pending.get(sourceB)(response);
  await Promise.all([runningA,runningB]);
  const stateA=(await client.readJob(a.jobId)).pages[0].state;
  const stateB=(await client.readJob(b.jobId)).pages[0].state;
  assert.equal(stateA,'missing','deleted source must remain fenced');
  assert.equal((await client.listSources()).find(x=>x.id===sourceA).state,'deleted');
  assert.equal(bAborted,false,'unrelated B request was aborted');
  assert.equal(stateB,'success','B page became locked');
  await client.run(b.jobId,{retryPages:[0],confirmCharge:true});
  assert.equal((await client.readJob(b.jobId)).pages[0].state,'success');
}
async function check117(preFix){
  const env=fixture(preFix),session=()=>({owner:'owner-117',epoch:1});
  const index=preFix?execFileSync('git',['show','28089b3:index.html'],{encoding:'utf8'}):readFileSync('index.html','utf8');
  const start=index.indexOf('async function deleteAuthWithIntakeFence(');
  if(start<0&&!preFix)throw Error('Auth deletion fence helper missing');
  const authContext=vm.createContext({currentUser:{uid:'owner-117'},console:{warn(){}}});
  if(start>=0)vm.runInContext(index.slice(start,index.indexOf('\n}',start)+2),authContext);
  let releaseCount;
  const slowRenderer={...renderer,count:()=>new Promise(resolve=>{releaseCount=resolve;})};
  const client=env.PedagogyIntake.create({config,renderer:slowRenderer,session,dbName:'117'});
  const late=client.createJob([file('late.png')]).then(()=>false,()=>true);
  await waitFor(()=>!!releaseCount);
  const fence=await client.purge();
  const next=env.PedagogyIntake.create({config,renderer,session,dbName:'117'});
  await assert.rejects(next.createJob([file('during.png')]),/삭제한 계정/);
  releaseCount(1);
  assert.equal(await late,true,'late write passed the deletion fence');
  const auth={uid:'owner-117',delete:async()=>{throw Error('simulated Auth failure');},reload:async()=>true};
  if(preFix){try{await auth.delete();}catch{await auth.reload();await client.recoverPurge(fence);}}
  else{
    Object.assign(authContext,{user:auth,client,fence});
    await assert.rejects(vm.runInContext('deleteAuthWithIntakeFence(user,client,fence,"owner-117")',authContext),/simulated Auth failure/);
  }
  await next.createJob([file('after.png')]);
  assert.equal((await next.listSources()).length,1,'purged raw source was restored');
  const orphan=await client.purge();
  auth.reload=async()=>{throw Error('simulated ambiguous result');};
  if(!preFix){
    Object.assign(authContext,{user:auth,fence:orphan});
    await assert.rejects(vm.runInContext('deleteAuthWithIntakeFence(user,client,fence,"owner-117")',authContext),/다시 로그인/);
  }
  await assert.rejects(next.createJob([file('ambiguous.png')]),/삭제한 계정/);
  await assert.rejects(next.recoverPurge(fence),/시도가 바뀌었어요/);
  auth.reload=async()=>true;
  const recoveryStart=index.indexOf('let intakeFenceRecovery=null;');
  if(recoveryStart<0)throw Error('later session recovery missing');
  const sessionContext=vm.createContext({
    currentUser:{uid:'owner-117'},wiping:false,authEpoch:1,navigator:env.navigator,
    PedagogyIntake:{create:()=>next},PedagogyIntakeContract:env.PedagogyIntakeContract,
    intakeOwner:()=> 'owner-117',sessionMatches:()=>true,toast:()=>{},console:{warn(_message,error){throw error;}},
    withIntakeDeleteLock:(_uid,run)=>run(),user:auth,
    // 울타리는 원문 저장소(PM_INTAKE_V1) 안에만 있을 수 있다 — 로그인 복구는 저장소가 없으면 건너뛴다
    indexedDB:{databases:async()=>[{name:'PM_INTAKE_V1'}]}
  });
  vm.runInContext(index.slice(recoveryStart,index.indexOf('const onAuth=async',recoveryStart)),sessionContext);
  await vm.runInContext('recoverIntakeOnSignIn(user,{owner:"owner-117",epoch:1})',sessionContext);
  assert.equal(await next.purgeFence(),false,'same-owner login did not clear orphan fence');
  await next.createJob([file('new-session.png')]);
  assert.match(index,/await user\.reload\(\);[\s\S]*?await cleanup\.recoverPurge\(fence\)/,
    'account deletion does not release a confirmed failed attempt');
  assert.match(index,/await cleanup\.purgeFence\(\)[\s\S]*?await user\.reload\(\)[\s\S]*?await cleanup\.recoverPurge\(\)/,
    'later signed-in owner has no confirmed recovery path');
}

const red=process.env.B6_DELETE_RED;
for(const [issue,check] of [['116',check116],['117',check117]]){
  if(red&&red!==issue)continue;
  if(red){
    await assert.rejects(check(true),error=>{
      assert.match(error.message,issue==='116'?/unrelated B request was aborted/:/recoverPurge is not a function/);
      return true;
    });
    console.log(`RED ${issue}: pre-fix 28089b3 reproduces the defect`);
  }else{
    await check(false);
    console.log(`PASS ${issue}`);
  }
}
