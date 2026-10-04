import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';

const red=process.env.U15_RED||'';
const expectedRed={dedup:'해시·바이트·종류 재사용, 이름만 같으면 별도',
  rollback:'연결 실패 때 문제집 불변·재대조 뒤 같은 ID 재시도',
  epoch:'렌더 중 epoch 변경 거절',permission:'문항 쪽 지정·Undo·외부 권한 거절',
  editors:'구형 편집기 확인·owner·epoch 경계',limits:'AI 한도 없이 Blob과 첫 권 연결',
  undo:'문항 쪽 지정·Undo·외부 권한 거절'};
if(red&&!expectedRed[red])throw Error('알 수 없는 U15_RED: '+red);
function rehashInlineCsp(html){
  const bodies=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match=>!(/\bsrc\s*=/.test(match[1]))).map(match=>match[2]);
  assert.equal(bodies.length,3,'index inline script count');
  const hashes=bodies.map(body=>`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  let i=0;
  return html.replace(/'sha256-[^']+'/g,()=>hashes[i++]||'');
}

const port=await new Promise(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{
  const value=server.address().port;server.close(()=>resolve(value));
});});
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
  const mutations={
    dedup:['x.hash===prepared.hash','true'],
    epoch:["const matches=s=>{const n=context(); if(n.owner!==s.owner||n.epoch!==s.epoch) fail('계정이 바뀌어 작업을 멈췄어요');};",'const matches=s=>{};'],
    permission:["const link=r.links[setId];\n      if(!link||link.state", "const link=r.links[setId]||{state:'active',sources:Object.keys(r.sources)};\n      if(!link||link.state"],
    limits:['const cap=config?C.limits(config):null','const cap=C.limits(config)'],
    rollback:['else{sets=previous;localDirty=previousDirty;}','else{localDirty=previousDirty;}'],
    editors:['function createIntakeStorageClient({editorsConfirmed=false','function createIntakeStorageClient({editorsConfirmed=true'],
    undo:['if(ok){flushHistory();','if(ok){pushHistory();']
  };
  if(red)await context.route(red==='rollback'||red==='editors'||red==='undo'?'**/index.html':'**/pedagogy-intake.js',async route=>{
    const html=red==='rollback'||red==='editors'||red==='undo';
    let source=await readFile(html?'index.html':'pedagogy-intake.js','utf8');
    const [from,to]=mutations[red];assert.ok(source.includes(from),`${red} mutation target missing`);
    source=source.replace(from,to);
    await route.fulfill({contentType:html?'text/html':'application/javascript',body:html?rehashInlineCsp(source):source});
  });
  const page=await context.newPage();
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>typeof createIntakeStorageClient==='function');
  const results=await page.evaluate(async()=>{
    const checks=[];
    const eq=(actual,expected)=>{if(actual!==expected)throw Error(`값 불일치: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`);};
    const neq=(actual,expected)=>{if(actual===expected)throw Error(`서로 다른 값 필요: ${JSON.stringify(actual)}`);};
    const deepEq=(actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(`값 불일치: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`);};
    const ok=(value)=>{if(!value)throw Error('조건 실패');};
    const check=async(name,run)=>{try{await run();checks.push({name,state:'PASS'});}catch(e){checks.push({name,state:'FAIL',error:e.message});}};
    const reject=async(run,pattern)=>{try{await run();throw Error('거절되지 않음');}catch(e){if(e.message==='거절되지 않음'||!pattern.test(e.message))throw e;}};
    const file=(body,name='original.png')=>new File([body],name,{type:'image/png'});
    const owner='u15-'+crypto.randomUUID();currentUser={uid:owner};authEpoch++;
    const untouchedSource=crypto.randomUUID();
    const untouchedIntake={version:1,sources:[{sourceId:untouchedSource,pages:[2]}]};
    sets=[PedagogyNormalize.normSet({name:'수동',problems:[
      {title:'첫째',blocks:[{type:'statement',data:{text:'본문'}}]},
      {title:'둘째',intake:untouchedIntake}
    ]}),PedagogyNormalize.normSet({name:'다른 권',problems:[{title:'다른 권 문항',intake:untouchedIntake}]})];
    localDirty=true;if(!writeLocalNow())throw Error('준비 저장 실패');
    clearTimeout(histTimer);undoStack=[];redoStack=[];lastSnapshot=snapshot();
    const setId=sets[0].id,problemId=sets[0].problems[0].id;
    const renderer={count:async()=>1};
    const dbName='u15-'+crypto.randomUUID();
    let client;
    const first=file('AAAA');let sourceId,secondSourceId;
    await check('AI 한도 없이 Blob과 첫 권 연결',async()=>{
      client=createIntakeStorageClient({renderer,dbName,editorsConfirmed:true});
      const result=await client.registerSource(first,setId);sourceId=result.sourceId;
      eq((await client.listSources()).length,1);
      eq((await client.readSource(sourceId)).blob.size,4);
      deepEq((await client.forProblem(setId,sets[0].problems[0])).state,'missing');
      await reject(()=>client.readJob('none'),/작업/);
    });
    await check('해시·바이트·종류 재사용, 이름만 같으면 별도',async()=>{
      eq((await client.registerSource(file('AAAA','different.png'),setId)).sourceId,sourceId);
      secondSourceId=(await client.registerSource(file('BBBB'),setId)).sourceId;
      neq(secondSourceId,sourceId);
      eq((await client.listSources()).length,2);
    });
    await check('100MB·1GB·500쪽은 쓰기 전 거절',async()=>{
      await reject(()=>client.registerSource({size:100000001,type:'image/png',name:'large',arrayBuffer:async()=>new ArrayBuffer(1)},setId),/용량/);
      const original=renderer.count;renderer.count=async()=>501;
      try{await reject(()=>client.registerSource(file('page'),setId),/쪽수/);}finally{renderer.count=original;}
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(dbName);request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('owners','readwrite'),store=tx.objectStore('owners'),request=store.get(owner);
        request.onsuccess=()=>{const root=request.result;root.sources.injected={id:'injected',bytes:999999990,blob:new Blob(['x']),state:'unlinked'};store.put(root);};
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
      await reject(()=>client.registerSource(file('extra'),setId),/합계/);
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('owners','readwrite'),store=tx.objectStore('owners'),request=store.get(owner);
        request.onsuccess=()=>{const root=request.result;delete root.sources.injected;store.put(root);};
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
      db.close();
      eq((await client.listSources()).length,2);
    });
    await check('렌더 중 epoch 변경 거절',async()=>{
      const original=renderer.count;renderer.count=async()=>{authEpoch++;return 1;};
      try{await reject(()=>client.registerSource(file('late'),setId),/계정이 바뀌어/);}
      finally{renderer.count=original;}
      const crossing=PedagogyIntake.create({renderer,dbName,session:()=>({owner:intakeOwner(),epoch:authEpoch}),
        library:{exclusive:run=>run(),snapshot:()=>{authEpoch++;return {sets:structuredClone(sets),deleted:[],unknown:false};},commit:()=>true}});
      await reject(()=>crossing.assignPages(setId,problemId,[]),/계정이 바뀌어/);
      eq((await client.listSources()).length,2);
    });
    await check('문항 쪽 지정·Undo·외부 권한 거절',async()=>{
      const otherBefore=JSON.stringify([sets[0].problems[1].intake,sets[1].problems[0].intake]);
      await client.assignPages(setId,problemId,[{sourceId,pages:[1]}]);
      deepEq(sets[0].problems[0].intake.sources,[{sourceId,pages:[1]}]);
      doUndo();
      ok(!sets[0].problems[0].intake);
      doRedo();
      deepEq(sets[0].problems[0].intake.sources,[{sourceId,pages:[1]}]);
      await client.assignPages(setId,problemId,[{sourceId,pages:[1]},{sourceId:secondSourceId,pages:[1]}]);
      deepEq(sets[0].problems[0].intake.sources,[{sourceId,pages:[1]},{sourceId:secondSourceId,pages:[1]}]);
      eq(JSON.stringify([sets[0].problems[1].intake,sets[1].problems[0].intake]),otherBefore);
      eq((await client.forProblem(setId,sets[0].problems[0])).sourceId,sourceId);
      const external={intake:{version:1,sources:[{sourceId,pages:[1]}]}};
      eq((await client.forProblem('external',external)).state,'missing');
      ok(localStorage.getItem(setsKey()).includes(sourceId));
      await client.assignPages(setId,problemId,[{sourceId,pages:[1]}]);
    });
    await check('연결 실패 때 문제집 불변·재대조 뒤 같은 ID 재시도',async()=>{
      const before=JSON.stringify(sets),disk=localStorage.getItem(setsKey());
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key===setsKey())throw Error('injected local failure');return original.call(this,key,value);};
      try{await reject(()=>client.assignPages(setId,problemId,[]),/저장 실패/);}
      finally{Storage.prototype.setItem=original;}
      eq(JSON.stringify(sets),before);eq(localStorage.getItem(setsKey()),disk);
      await client.assignPages(setId,problemId,[]);
      deepEq(sets[0].problems[0].intake.sources,[]);
      await client.assignPages(setId,problemId,[{sourceId,pages:[1]}]);
    });
    await check('디스크 기준 충돌은 문제집 쓰기 보류',async()=>{
      const before=JSON.stringify(sets),disk=localStorage.getItem(setsKey());
      localStorage.setItem(setsKey(),disk+' ');
      try{await reject(()=>client.assignPages(setId,problemId,[]),/최신 상태/);}
      finally{localStorage.setItem(setsKey(),disk);}
      eq(JSON.stringify(sets),before);
    });
    await check('구형 편집기 확인·owner·epoch 경계',async()=>{
      const blocked=createIntakeStorageClient({renderer,dbName:'u15-'+crypto.randomUUID()});
      await reject(()=>blocked.registerSource(file('new'),setId),/구형 탭/);
      const oldOwner=currentUser;currentUser={uid:'other'};authEpoch++;
      deepEq(await client.listSources(),[]);
      await reject(()=>client.readSource(sourceId),/원문/);
      currentUser=oldOwner;authEpoch++;
      eq((await client.readSource(sourceId)).id,sourceId);
    });
    await check('다시 연결은 내용 확인, 기록 없으면 새 ID와 쪽 미적용',async()=>{
      await reject(()=>client.reconnect(sourceId,file('DIFFERENT')),/다른 파일/);
      eq(await client.reconnect(sourceId,first),sourceId);
      const fresh=await client.reconnect(crypto.randomUUID(),file('NEW'),{setId});
      neq(fresh.sourceId,sourceId);
      deepEq(sets[0].problems[0].intake.sources,[{sourceId,pages:[1]}]);
    });
    await check('해제 후 Blob 보존',async()=>{
      await client.detachSource(sourceId,setId);
      deepEq(sets[0].problems[0].intake.sources,[]);
      ok((await client.readSource(sourceId)).blob);
    });
    return checks;
  });
  for(const item of results)console.log(item.state,item.name,item.error||'');
  const failed=results.filter(item=>item.state==='FAIL');
  console.log(`U1.5 storage: ${results.length-failed.length} passed, ${failed.length} failed, 0 skipped`);
  if(process.argv.includes('--expect-red')){
    assert.ok(red&&failed.some(item=>item.name===expectedRed[red]),
      `${red} 결함 주입이 대응 검사를 실패시키지 못함`);
  }else if(failed.length)process.exitCode=1;
}finally{await browser?.close();server.kill();}
