import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';

const records=new Map();
let putFails=false;
const indexedDB={open(name){
  const request={};
  queueMicrotask(()=>{
    const data=records.get(name)||new Map();records.set(name,data);
    request.result={
      createObjectStore(){},
      transaction(){
        const tx={aborted:false,abort(){this.aborted=true;queueMicrotask(()=>this.onabort?.());}};
        tx.objectStore=()=>({
          get(owner){const get={};queueMicrotask(()=>{
            get.result=structuredClone(data.get(owner));get.onsuccess?.();
            queueMicrotask(()=>{if(!tx.aborted)tx.oncomplete?.();});
          });return get;},
          put(root){if(putFails)throw Error('injected IDB failure');data.set(root.owner,structuredClone(root));}
        });return tx;
      }
    };
    request.onupgradeneeded?.();request.onsuccess?.();
  });
  return request;
}};
const global={crypto:webcrypto,indexedDB,structuredClone,Blob,File,
  navigator:{locks:{request:async(_key,run)=>run()}},URL,TextEncoder,console};
global.globalThis=global;
runInNewContext(await readFile('pedagogy-normalize.js','utf8'),global);
let source=await readFile('pedagogy-intake.js','utf8');
if(process.env.U15_RED==='dedup'){
  assert.ok(source.includes('x.hash===prepared.hash'));
  source=source.replace('x.hash===prepared.hash','true');
}
if(process.env.U15_RED==='linked'){
  const guard="if(!link||link.state!=='active'||!link.sources.includes(sourceId))return {state:'missing'};";
  assert.ok(source.includes(guard));
  source=source.replace(guard,"if(false)return {state:'missing'};");
}
global.PedagogyIntakeContract={limits:()=>{throw Error('AI limit must not be read');}};
runInNewContext(source,global);
let owner='A',epoch=1,commitFails=false;
const untouched={version:1,sources:[{sourceId:webcrypto.randomUUID(),pages:[2]}]};
const set={id:'set',problems:[{id:'problem',title:'original'},{id:'other-problem',intake:untouched}]};
let disk=[structuredClone(set),{id:'other-set',problems:[{id:'third',intake:structuredClone(untouched)}]}];
const library={
  snapshot:()=>({sets:structuredClone(disk),deleted:[],unknown:false,cloudReady:true,online:true,conflicts:[],recovery:[]}),
  exclusive:run=>run(),
  commit(next){if(commitFails)return false;disk=structuredClone(next);return true;},
  cloud:()=> 'pending'
};
const renderer={count:async()=>1};
const make=()=>global.PedagogyIntake.create({session:()=>({owner,epoch}),library,renderer,dbName:'u15-node'});
const client=make();
const file=(body,name='same.png')=>new File([body],name,{type:'image/png'});
const rejects=async(run,match)=>{await assert.rejects(run,match);};
const checks=[];
const check=async(name,run)=>{try{await run();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,error:e.message});}};
let sourceId;
await check('AI 설정 없는 Blob·첫 권 연결',async()=>{
  const result=await client.registerSource(file('one'),'set');sourceId=result.sourceId;
  assert.equal((await client.readSource(sourceId)).blob.size,3);
  assert.equal((await client.forProblem('set',disk[0].problems[0])).state,'missing');
  assert.equal(Object.keys(records.get('u15-node').get('A').jobs).length,0);
  assert.ok(records.get('u15-node').get('A').links.set.sources.includes(sourceId));
});
await check('권 연결 없는 Blob 읽기 거절',async()=>{
  const list=await client.forSet('set');
  assert.equal(list.state,'linked');
  assert.equal(list.sources.length,1);
  assert.deepEqual(Object.keys(list.sources[0]).sort(),['bytes','name','pageCount','sourceId','state','type']);
  assert.equal(list.sources[0].sourceId,sourceId);
  assert.equal((await client.readLinked('set',sourceId)).blob.size,3);
  assert.equal((await client.forSet('other-set')).state,'missing');
  assert.equal((await client.readLinked('other-set',sourceId)).state,'missing');
  assert.equal((await client.readLinked('set',webcrypto.randomUUID())).state,'missing');
});
await check('detached·삭제 상태의 권 읽기는 Blob을 내주지 않음',async()=>{
  const root=records.get('u15-node').get('A'),saved=structuredClone(root.sources[sourceId]);
  root.links.set.state='detached';
  assert.equal((await client.forSet('set')).state,'missing');
  assert.equal((await client.readLinked('set',sourceId)).state,'missing');
  root.links.set.state='active';
  root.sources[sourceId].state='deleted';root.sources[sourceId].blob=null;
  assert.equal((await client.forSet('set')).sources[0].state,'deleted');
  assert.deepEqual(await client.readLinked('set',sourceId),{state:'deleted'});
  root.sources[sourceId]=saved;
});
await check('해시·바이트·종류로만 재사용',async()=>{
  assert.equal((await client.registerSource(file('one','other.png'),'set')).sourceId,sourceId);
  assert.notEqual((await client.registerSource(file('two'),'set')).sourceId,sourceId);
});
await check('100MB·1GB·500쪽 저장 전 거절',async()=>{
  await rejects(()=>client.registerSource({size:100000001,type:'image/png',arrayBuffer:async()=>new ArrayBuffer(1)},'set'),/용량/);
  renderer.count=async()=>501;
  await rejects(()=>client.registerSource(file('page'),'set'),/쪽수/);
  renderer.count=async()=>1;
  const root=records.get('u15-node').get('A');
  root.sources.large={id:'large',bytes:999999995,blob:new Blob(['x']),state:'unlinked'};
  await rejects(()=>client.registerSource(file('extra'),'set'),/합계/);
  delete root.sources.large;
  assert.equal((await client.listSources()).length,2);
});
await check('IDB 실패와 렌더 중 epoch 전환은 Blob·연결 모두 불변',async()=>{
  const before=JSON.stringify(records.get('u15-node').get('A').links);
  putFails=true;
  await rejects(()=>client.registerSource(file('idb-fail'),'set'),/injected IDB failure/);
  putFails=false;
  assert.equal(JSON.stringify(records.get('u15-node').get('A').links),before);
  assert.equal((await client.listSources()).length,2);
  renderer.count=async()=>{epoch++;return 1;};
  await rejects(()=>client.registerSource(file('epoch-fail'),'set'),/계정이 바뀌어/);
  renderer.count=async()=>1;
  assert.equal((await client.listSources()).length,2);
});
await check('문항 출처 정본과 외부 JSON 권한 분리',async()=>{
  const otherBefore=JSON.stringify([disk[0].problems[1].intake,disk[1].problems[0].intake]);
  await client.assignPages('set','problem',[{sourceId,pages:[1]}]);
  assert.equal(JSON.stringify(disk[0].problems[0].intake.sources),JSON.stringify([{sourceId,pages:[1]}]));
  assert.equal(JSON.stringify([disk[0].problems[1].intake,disk[1].problems[0].intake]),otherBefore);
  assert.equal((await client.forProblem('set',disk[0].problems[0])).sourceId,sourceId);
  assert.equal((await client.forProblem('foreign',disk[0].problems[0])).state,'missing');
});
await check('저장 실패면 문제집 불변·재시도',async()=>{
  const before=JSON.stringify(disk);commitFails=true;
  await rejects(()=>client.assignPages('set','problem',[]),/저장 실패/);
  assert.equal(JSON.stringify(disk),before);
  commitFails=false;
  await client.assignPages('set','problem',[]);
  assert.equal(disk[0].problems[0].intake.sources.length,0);
});
await check('owner·epoch·재연결·해제 경계',async()=>{
  owner='B';epoch++;
  assert.equal((await client.listSources()).length,0);
  assert.equal((await client.forSet('set')).state,'missing');
  assert.equal((await client.readLinked('set',sourceId)).state,'missing');
  await rejects(()=>client.readSource(sourceId),/원문/);
  owner='A';epoch++;
  const lateSet=client.forSet('set');epoch++;
  await rejects(()=>lateSet,/계정이 바뀌어/);
  const lateRead=client.readLinked('set',sourceId);epoch++;
  await rejects(()=>lateRead,/계정이 바뀌어/);
  await rejects(()=>client.reconnect(sourceId,file('other')),/다른 파일/);
  assert.equal(await client.reconnect(sourceId,file('one')),sourceId);
  const fresh=await client.reconnect(webcrypto.randomUUID(),file('fresh'),{setId:'set'});
  assert.notEqual(fresh.sourceId,sourceId);
  assert.equal(disk[0].problems[0].intake.sources.length,0);
  await client.assignPages('set','problem',[{sourceId,pages:[1]}]);
  await client.detachSource(sourceId,'set');
  assert.equal(disk[0].problems[0].intake.sources.length,0);
  assert.ok((await client.readSource(sourceId)).blob);
});
for(const result of checks)console.log(result.pass?'PASS':'FAIL',result.name,result.error||'');
const failed=checks.filter(x=>!x.pass);
console.log(`U1.5 Node storage: ${checks.length-failed.length} passed, ${failed.length} failed, 0 skipped`);
if(process.argv.includes('--expect-red')){
  const expected={dedup:'해시·바이트·종류로만 재사용',linked:'권 연결 없는 Blob 읽기 거절'}[process.env.U15_RED];
  assert.ok(expected&&failed.some(x=>x.name===expected),'고장 주입이 빨간불을 만들지 못함');
}else if(failed.length)process.exitCode=1;
