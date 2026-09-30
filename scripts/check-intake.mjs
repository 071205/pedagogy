import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:net';
const port=await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
let browser;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();const ctx=await browser.newContext();
  await ctx.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if(u.origin!==base)return r.abort();
    if(process.env.B6_RED==='1'&&u.pathname==='/pedagogy-normalize.js'){
      const src=await readFile('pedagogy-normalize.js','utf8');
      assert.ok(src.includes('...(p.intake?'));
      return r.fulfill({contentType:'application/javascript',body:src.replace('...(p.intake?','...(false&&p.intake?')});
    }
    return r.continue();
  });
  const page=await ctx.newPage();await page.goto(base+'/index.html');
  await page.waitForFunction(()=>typeof createIntakeFixture==='function'&&typeof readLocalSets==='function');
  const result=await page.evaluate(async()=>{
    const checks=[],failures=[];
    const eq=(a,b,msg='값 불일치')=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(msg);};
    const ok=(v,msg='조건 실패')=>{if(!v)throw Error(msg);};
    const rejects=async(fn,pattern)=>{try{await fn();}catch(e){if(!pattern||pattern.test(e.message))return;throw e;}throw Error('거절되지 않음');};
    const check=async(name,fn)=>{checks.push(name);try{await fn();}catch(e){failures.push(name+': '+e.message);}};
    const config={files:4,fileBytes:2000000,totalBytes:4000000,pages:6,minDimension:64,maxDimension:1000,imageBytes:1000000,
      requestBytes:1500000,calls:6,retries:2,problemsPerPage:5,problemsPerJob:20,problemsPerSet:500,fieldChars:400000,blocks:50,items:10};
    window.__b6Config=config;
    const raw=(text='문제',group=null)=>({title:'',answer:'',blocks:[{type:'statement',text}],units:['함수'],difficulty:'중',points:null,pointsState:'absent',group});
    const response=(problems=[raw()])=>({task:PedagogyIntakeContract.TASK,problems,usage:{used:1,limit:6}});
    const render={count:async()=>2,page:async()=>({imageBase64:'aGVsbG8=',mimeType:'image/png',width:200,height:200,bytes:5})};
    const file=()=>new File(['fixture'], '비공개 이름.pdf',{type:'application/pdf'});
    let calls=0;
    window.__b6DB='b6-'+crypto.randomUUID();
    const client=createIntakeFixture({config,renderer:render,transport:async()=>{calls++;return response();},dbName:window.__b6DB,editorsConfirmed:true});
    const {jobId}=await client.createJob([file(),file()]);
    await check('파일/쪽/원문 보관',async()=>{eq((await client.listSources()).length,2);eq((await client.readJob(jobId)).pages.length,4);});
    await check('한도는 호출 전에 거절',async()=>{await rejects(()=>client.createJob(Array.from({length:5},file)),/개수/);eq(calls,0);});
    await client.run(jobId);const j=await client.readJob(jobId);
    await check('성공 잠금/새로고침 재개 AI0',async()=>{eq(j.pages.map(p=>p.state),['success','success','success','success']);await client.run(jobId);eq(calls,4);ok(j.pages.every(p=>p.checksum&&p.attemptId&&p.receipt));});
    const destinations=[{id:'a',name:'A',items:[{draftId:j.drafts[0].id,placementId:'1'}]},
      {id:'b',name:'B',items:[{draftId:j.drafts[0].id,placementId:'1'}]}];
    let report;
    await check('동시 채택은 고정 ID/독립 사본',async()=>{
      const opts={destinations,draftVersion:j.draftVersion};
      const [a,b]=await Promise.all([client.adopt(jobId,opts),client.adopt(jobId,opts)]);report=a;
      eq(a.adoption.id,b.adoption.id);eq(a.results.map(x=>x.state),['local','local']);
      const adopted=a.results.map(r=>sets.find(s=>s.id===r.setId));
      ok(adopted[0].problems[0].id!==adopted[1].problems[0].id);eq(adopted.length,2);
      adopted[0].problems[0].title='edited';localDirty=true;ok(writeLocalNow());
      await client.adopt(jobId,opts);eq(sets.find(x=>x.id===a.results[0].setId).problems[0].title,'edited');
    });
    await check('정규화·클라우드·JSON·복제 출처 보존/비밀 제외',async()=>{
      const set=sets.find(x=>x.id===report.results[0].setId),p=set.problems[0];ok(p.intake,'intake 소실');
      const sourceId=j.sources[0];
      const polluted={...p,intake:{...p.intake,sources:[{sourceId,pages:[2,1,2],name:'secret',hash:'secret',blobURL:'blob:private'}]}};
      const n=PedagogyNormalize.normProblem(polluted,{keepId:true,lossless:true});
      eq(n.intake.sources,[{sourceId,pages:[1,2]}]);
      eq(docToSet(setToDoc({...set,problems:[n]},0)).problems[0].intake,n.intake);
      const clone=PedagogyNormalize.normSet(JSON.parse(JSON.stringify(set)));ok(clone.problems[0].intake);
      ok(!JSON.stringify(setToDoc({...set,problems:[polluted]},0)).includes('secret'));
      ok(!JSON.stringify(portableIntakeSet({...set,problems:[polluted]})).includes('secret'));
      eq(setJSON({...set,problems:[polluted]}),setJSON({...set,problems:[n]}));
      eq(PedagogyNormalize.normSet({...set,problems:Array(501).fill(n)}).problems.length,500);
    });
    await check('불완전/연동/500 초과 채택 거절',async()=>{
      await rejects(()=>client.adopt(jobId,{...{destinations,draftVersion:j.draftVersion},mode:'linked'}),/연동/);
      const second=await client.createJob([file()]);await client.run(second.jobId);const jj=await client.readJob(second.jobId);
      await rejects(()=>client.adopt(second.jobId,{draftVersion:jj.draftVersion,destinations:[{id:'x',name:'X',items:Array.from({length:501},(_,i)=>({placementId:String(i),draftId:jj.drafts[0].id}))}]}),/500/);
    });
    await check('삭제 결과는 자동 부활 없음',async()=>{
      const setId=report.results[1].setId;sets=sets.filter(x=>x.id!==setId);deletedIds.set(setId,Date.now());localDirty=true;ok(writeLocalNow());
      const next=await client.adopt(jobId,{destinations,draftVersion:j.draftVersion});eq(next.results[1].state,'deleted');ok(!sets.some(x=>x.id===setId));
    });
    await check('검토 상태는 수정한 영역만 다시 미확인',async()=>{
      const p=sets.find(x=>x.id===report.results[0].setId).problems[0];p.intake.contentReview='reviewed';p.intake.classificationReview='reviewed';localDirty=true;writeLocalNow();
      p.answer='changed';localDirty=true;writeLocalNow();eq(p.intake.contentReview,'unreviewed');eq(p.intake.classificationReview,'reviewed');
    });
    await check('출처 메타도 900KiB 실측에 포함',async()=>{
      const set=sets.find(x=>x.id===report.results[0].setId),before=docBytes(setToDoc(set,0));
      const large=structuredClone(set);large.problems[0].intake.sources=Array.from({length:100},()=>({sourceId:crypto.randomUUID(),pages:Array.from({length:1000},(_,n)=>n+1)}));
      ok(docBytes(setToDoc(large,0))>before+300000);
    });
    await check('D4 여러 권/부분 결과 목록·owner별 기억',async()=>{
      ok(writeIntakePrefs(true));eq(intakeResultRoute(report).view,'list');
      eq(intakeResultRoute({...report,results:[report.results[0]]}).view,'editor');
      eq(intakeResultRoute({...report,adoption:{...report.adoption,partial:true},results:[report.results[0]]}).view,'list');
      const previous=currentUser;currentUser={uid:'other'};eq(readIntakePrefs(),false);currentUser=previous;
      ok(!Object.values(accountLocalKeys()).includes(intakePrefsKey()));
    });
    await check('구 탭 확인 없는 채택 보류',async()=>{
      const c=createIntakeFixture({config,renderer:render,dbName:'b6-no-ack'});
      await rejects(()=>c.adopt('anything',{}),/구형 탭/);
    });
    await check('일괄 삭제 경쟁 보류·자기 로컬 삭제 뒤 새 저장 가능',async()=>{
      const saved=structuredClone(sets);const marker={tab:'other-live',token:'fixture'};
      localStorage.setItem(intakeLockKey(),JSON.stringify(marker));
      await rejects(()=>deleteAllSets(),/다른 탭/);
      await rejects(()=>Promise.resolve().then(()=>clearLocalKeys(accountLocalKeys(),{keepBackup:true})),/다른 탭/);
      localStorage.removeItem(intakeLockKey());
      clearLocalKeys(accountLocalKeys(),{keepBackup:true});sets=saved;localDirty=true;ok(writeLocalNow());ok(readIntakePrefs());
    });
    // Controlled library uses the same engine with actual IDB, independent failures.
    let owner='owner-a',epoch=1,online=true,cloudReady=true,unknown=false,disk=[],deleted=[],recovery=[],conflicts=[],commits=0,failLocal=false;
    const library={snapshot:()=>({sets:structuredClone(disk),deleted,online,cloudReady,unknown,recovery,conflicts}),
      exclusive:fn=>navigator.locks.request('b6-test-library',fn),commit(next){commits++;if(failLocal)return false;disk=structuredClone(next);return true;},
      cloud:setId=>JSON.stringify(disk.find(s=>s.id===setId)).length>900*1024?'tooBig':'ack'};
    const make=(opts={})=>PedagogyIntake.create({config,renderer:render,session:()=>({owner,epoch}),library,transport:async()=>response(),dbName:'b6-union',...opts});
    let c=make();const setup=await c.createJob([file()]);await c.run(setup.jobId);let jj=await c.readJob(setup.jobId),sid=jj.sources[0];
    await check('전체 로컬 실패 시 초안/고정 매핑 보존 후 재개',async()=>{
      failLocal=true;const dest=[{id:'a',name:'A',items:[{draftId:jj.drafts[0].id,placementId:'1'}]},{id:'b',name:'B',items:[{draftId:jj.drafts[1].id,placementId:'1'}]}];
      const a=await c.adopt(setup.jobId,{destinations:dest,draftVersion:jj.draftVersion});eq(a.results.map(x=>x.state),['failed','failed']);eq(disk.length,0);
      failLocal=false;c=make();const b=await c.adopt(setup.jobId,{destinations:dest,draftVersion:jj.draftVersion});eq(a.adoption.id,b.adoption.id);eq(disk.length,2);
    });
    await check('삭제 영향: 실제 복제/충돌/백업/작업 합집합',async()=>{
      const clone=structuredClone(disk[0]);clone.id='clone';disk.push(clone);
      const conflict=structuredClone(clone);conflict.id='conflict';conflicts=[conflict];
      const backup=structuredClone(clone);backup.id='backup';recovery=[backup];
      const impact=await c.impact(sid);eq(impact.state,'ready');ok(impact.active.includes('clone')&&impact.active.includes('conflict'));ok(impact.recovery.includes('backup'));ok(impact.jobs.includes(setup.jobId));
    });
    await check('첫 구독 전/오프라인/기록 손상은 원문 삭제 보류',async()=>{
      cloudReady=false;eq((await c.impact(sid)).state,'check');cloudReady=true;
      online=false;eq((await c.impact(sid)).state,'check');online=true;
      unknown=true;eq((await c.impact(sid)).state,'check');unknown=false;
      ok((await c.readSource(sid)).blob);
    });
    await check('결과 blob 의존/삭제 범위 변경은 보류',async()=>{
      disk[0].problems[0].answerImg='blob:dependent';eq((await c.impact(sid)).state,'check');disk[0].problems[0].answerImg='';
      const impact=await c.impact(sid);disk[0].name='changed';await rejects(()=>c.deleteSource(sid,{ticket:impact.ticket,confirmed:true}),/범위/);
    });
    await check('명시 삭제는 원문만 파기/복구·외부 ID가 부활 못 함',async()=>{
      const impact=await c.impact(sid);await c.deleteSource(sid,{ticket:impact.ticket,confirmed:true});
      ok(disk.length===3);await rejects(()=>c.readSource(sid),/원문 없음/);await c.reconcile();eq((await c.listSources())[0].state,'deleted');
      eq((await c.forProblem('clone',disk[0].problems[0])).state,'missing');await rejects(()=>c.reconnect(sid,file()),/새 원문/);
    });
    await check('owner/epoch 격리와 계정 파기 fence',async()=>{
      const setup=await c.createJob([file()]);owner='owner-b';epoch++;await rejects(()=>c.readJob(setup.jobId),/작업/);
      owner='owner-a';epoch++;await c.purge();await rejects(()=>c.readJob(setup.jobId),/삭제한 계정/);
    });
    await check('공통지문 구성원 이동/제외 검증',async()=>{
      const grouped=make({dbName:'b6-group',transport:async()=>response([raw('지문','G'),raw('꼬리','G'),raw('무관')])});
      const setup=await grouped.createJob([file()],{selection:[[1]]});await grouped.run(setup.jobId);const job=await grouped.readJob(setup.jobId);
      const items=job.drafts.map((d,i)=>({draftId:d.id,placementId:String(i)}));
      await rejects(()=>grouped.adopt(setup.jobId,{draftVersion:job.draftVersion,destinations:[{id:'a',name:'A',items:[items[1],items[2]]}]}),/지문/);
      const duplicates=[...items.slice(0,2),...items.slice(0,2).map(x=>({...x,placementId:x.placementId+'-copy'})),items[2]];
      const a=await grouped.adopt(setup.jobId,{draftVersion:job.draftVersion,destinations:[{id:'a',name:'A',items:duplicates}]});
      const adopted=disk.find(s=>s.id===a.results[0].setId).problems;eq(adopted.map(p=>p.groupSpan),[2,1,2,1,1]);
      ok(new Set(adopted.map(p=>p.id)).size===5);
    });
    await check('실패 쪽만 명시 재시도/순차 호출·부분 성공 채택',async()=>{
      let n=0,active=0,max=0;
      const c=make({dbName:'b6-retry',transport:async()=>{active++;max=Math.max(active,max);try{if(++n===2)throw Error('fixture failure');return response();}finally{active--;}}});
      const setup=await c.createJob([file()]);await c.run(setup.jobId);const j=await c.readJob(setup.jobId);eq(j.pages.map(p=>p.state),['success','failed']);
      const opts={draftVersion:j.draftVersion,destinations:[{id:'a',name:'A',items:[{placementId:'1',draftId:j.drafts[0].id}]}]};
      await rejects(()=>c.adopt(setup.jobId,opts),/성공한 쪽만/);
      ok((await c.adopt(setup.jobId,{...opts,partial:true})).adoption.partial);
      await c.run(setup.jobId);eq(n,2);await rejects(()=>c.run(setup.jobId,{retryPages:[1]}),/차감/);
      await c.run(setup.jobId,{retryPages:[1],confirmCharge:true});eq(n,3);eq(max,1);eq((await c.readJob(setup.jobId)).pages[1].state,'success');
    });
    await check('늦은 AI 응답은 삭제 세대 뒤 원문/결과 못 부활',async()=>{
      let resolve,started;const ready=new Promise(r=>started=r),reply=new Promise(r=>resolve=r);
      const c=make({dbName:'b6-late',transport:async()=>{started();return reply;}});
      const setup=await c.createJob([file()],{selection:[[1]]}),run=c.run(setup.jobId).catch(e=>e.message);await ready;
      const j=await c.readJob(setup.jobId),impact=await c.impact(j.sources[0]);await c.deleteSource(j.sources[0],{ticket:impact.ticket,confirmed:true});resolve(response());await run;
      eq((await c.readJob(setup.jobId)).drafts.length,0);eq((await c.listSources())[0].state,'deleted');
    });
    await check('모호한 성공 기록은 자동 재호출 없음',async()=>{
      let n=0;const c=make({dbName:'b6-lock',transport:async()=>{n++;return {state:'completed'};}});
      const setup=await c.createJob([file()],{selection:[[1]]});await c.run(setup.jobId);await c.run(setup.jobId,{retryPages:[0],confirmCharge:true});eq(n,1);eq((await c.readJob(setup.jobId)).pages[0].state,'locked');
    });
    await check('IDB 매핑 실패는 라이브러리 쓰기 0회',async()=>{
      let used=0;
      const c=make({dbName:'b6-idb-fail',library:{...library,commit(){used++;return true;}}});
      const setup=await c.createJob([file()],{selection:[[1]]});await c.run(setup.jobId);const j=await c.readJob(setup.jobId);
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(v,...args){if(v.adoptions&&Object.keys(v.adoptions).length)throw Error('fixture IDB quota');return original.call(this,v,...args);};
      try{await rejects(()=>c.adopt(setup.jobId,{draftVersion:j.draftVersion,destinations:[{id:'a',name:'A',items:[{draftId:j.drafts[0].id,placementId:'1'}]}]}),/IDB/);}
      finally{IDBObjectStore.prototype.put=original;}
      eq(used,0);ok((await c.readJob(setup.jobId)).drafts.length);
    });
    await check('여러 권 cloud ACK/900KiB 초과를 따로 표시',async()=>{
      const c=make({dbName:'b6-large',transport:async()=>response([raw('가'.repeat(340000)),raw('small')]),
        library:{...library,cloud:setId=>new TextEncoder().encode(JSON.stringify(disk.find(s=>s.id===setId))).length>900*1024?'tooBig':'ack'}});
      const setup=await c.createJob([file()],{selection:[[1]]});await c.run(setup.jobId);const j=await c.readJob(setup.jobId);
      const a=await c.adopt(setup.jobId,{draftVersion:j.draftVersion,destinations:j.drafts.map((d,i)=>({id:String(i),name:'권 '+i,items:[{draftId:d.id,placementId:'1'}]}))});
      eq(a.results.map(r=>r.state),['local','local']);eq(a.results.map(r=>r.cloud),['tooBig','ack']);ok((await c.readSource(j.sources[0])).blob);
    });
    await check('권 삭제/작업 종료는 원문 unlinked, Undo 재연결',async()=>{
      const c=make({dbName:'b6-unlinked'}),setup=await c.createJob([file()],{selection:[[1]]});await c.run(setup.jobId);const j=await c.readJob(setup.jobId);
      const a=await c.adopt(setup.jobId,{draftVersion:j.draftVersion,destinations:[{id:'a',name:'A',items:[{draftId:j.drafts[0].id,placementId:'1'}]}]});
      await c.finishJob(setup.jobId);const backup=disk.find(s=>s.id===a.results[0].setId);disk=disk.filter(s=>s.id!==backup.id);
      await c.reconcile();eq((await c.listSources())[0].state,'unlinked');ok((await c.readSource(j.sources[0])).blob);
      disk.push(backup);await c.reconcile();eq((await c.listSources())[0].state,'available');eq((await c.forProblem(backup.id,backup.problems[0])).state,'available');
      await rejects(()=>c.run(setup.jobId),/종료/);
    });
    await check('외부 출처 표시만으로 Blob 접근 권한 생성 안 됨',async()=>{
      const c=make({dbName:'b6-external'}),setup=await c.createJob([file()],{selection:[[1]]}),j=await c.readJob(setup.jobId);
      const imported={id:'external',problems:[{intake:{version:1,sources:[{sourceId:j.sources[0],pages:[1]}]}}]};
      disk.push(imported);await c.reconcile();eq((await c.forProblem(imported.id,imported.problems[0])).state,'missing');
      await c.linkSource(j.sources[0],imported.id,[1]);eq((await c.forProblem(imported.id,imported.problems[0])).state,'available');
    });
    await check('계정 전환 후 늦은 응답은 양 owner에 쓰지 않음',async()=>{
      let finish,started;const ready=new Promise(r=>started=r),reply=new Promise(r=>finish=r);
      const c=make({dbName:'b6-owner-late',transport:async()=>{started();return reply;}}),setup=await c.createJob([file()],{selection:[[1]]});
      const run=c.run(setup.jobId).catch(()=>{});await ready;owner='owner-b';epoch++;finish(response());await run;
      await rejects(()=>c.readJob(setup.jobId),/작업/);owner='owner-a';epoch++;eq((await c.readJob(setup.jobId)).drafts.length,0);
    });
    await check('원문 저장 실패면 보관·AI 완료 주장 안 함',async()=>{
      const c=make({dbName:'b6-source-fail'});const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(){throw Error('fixture source quota');};
      try{await rejects(()=>c.createJob([file()]),/quota/);}finally{IDBObjectStore.prototype.put=original;}
      eq((await c.listSources()).length,0);
    });
    // Cross-tab target identifiers for the external test below.
    window.__b6Client=client;window.__b6Job=jobId;window.__b6Options={destinations,draftVersion:j.draftVersion};
    return {checks,failures};
  });
  console.log('B6 checks',result.checks.length);
  if(process.env.B6_RED==='1'){
    assert.ok(result.failures.some(f=>f.startsWith('정규화·클라우드·JSON·복제')),'metadata-removal mutation must turn its target check red');
    const regression=await ctx.newPage();await regression.goto(base+'/regression-test.html');
    await regression.waitForFunction(()=>document.querySelector('#status')?.textContent.startsWith('완료'),null,{timeout:60000});
    const failed=await regression.locator('.row.fail').allTextContents();
    assert.ok(failed.some(x=>x.includes('B6 intake 출처·검토 상태')),'new regression row must turn red too');
    assert.ok(failed.some(x=>x.includes('B6 모르는 intake 버전')),'unknown-version regression row must turn red');
    console.log('RED: intake metadata loss and both new regression rows detected');
  }else{
    assert.deepEqual(result.failures,[]);
    // A supported stale tab must not overwrite a new adoption's full array.
    const second=await ctx.newPage();await second.goto(base+'/index.html');await second.waitForFunction(()=>typeof writeLocalNow==='function');
    const args=await page.evaluate(()=>({config:window.__b6Config,dbName:window.__b6DB,jobId:window.__b6Job,options:window.__b6Options}));
    await second.evaluate(args=>{
      sets=readLocalSets();window.__b6Second=createIntakeFixture({config:args.config,dbName:args.dbName,editorsConfirmed:true});
      window.__b6SecondJob=args.jobId;window.__b6SecondOptions=args.options;
    },args);
    const results=await Promise.all([
      page.evaluate(()=>window.__b6Client.adopt(window.__b6Job,window.__b6Options)),
      second.evaluate(()=>window.__b6Second.adopt(window.__b6SecondJob,window.__b6SecondOptions))
    ]);
    assert.equal(results[0].adoption.id,results[1].adoption.id);
    console.log('PASS two-tab adoption reuses identical result IDs');
    const crash=await ctx.newPage();await crash.goto(base+'/index.html');await crash.waitForFunction(()=>typeof createIntakeFixture==='function');
    await crash.evaluate(args=>{
      sets=readLocalSets();
      IDBFactory.prototype.open=function(){return {};}; // interrupted IDB open keeps the real library Web Lock held
      const c=createIntakeFixture({config:args.config,dbName:'b6-crash',editorsConfirmed:true});
      c.adopt(args.jobId,args.options).catch(()=>{});
    },args);
    await crash.waitForFunction(()=>JSON.parse(localStorage.getItem(intakeLockKey())||'null')?.clientId);
    const held=await page.evaluate(()=>({allowed:intakeWriteAllowed(),marker:!!localStorage.getItem(intakeLockKey())}));
    assert.deepEqual(held,{allowed:false,marker:true},'a live holder must stay protected');
    await crash.close(); // releases actual browser locks, leaves its durable writer marker
    await page.evaluate(()=>window.__b6Client.adopt(window.__b6Job,window.__b6Options));
    assert.equal(await page.evaluate(()=>localStorage.getItem(intakeLockKey())),null);
    console.log('PASS live writer protected and closed-tab marker reclaimed only after browser ownership proof');
    await second.evaluate(()=>{readLocalSets();sets=[];});
    await page.evaluate(()=>{sets.push({id:'cross-tab-added',name:'new',problems:[]});localDirty=true;writeLocalNow();});
    const stale=await second.evaluate(()=>{localDirty=true;return {ok:writeLocalNow(),disk:JSON.parse(localStorage.getItem(setsKey())).some(x=>x.id==='cross-tab-added'),pending:pendingLocalByOwner.has(setsKey())};});
    assert.deepEqual(stale,{ok:false,disk:true,pending:true});console.log('PASS cross-tab stale library write rejected');
    // Real browser image + PDF renderer, no artificial renderer for these checks.
    const rendered=await page.evaluate(async()=>{
      const renderer=PedagogyIntake.browserRenderer(),cap=window.__b6Config;
      const canvas=document.createElement('canvas');canvas.width=300;canvas.height=300;
      const image=await new Promise(r=>canvas.toBlob(r,'image/png'));
      const r=await renderer.page(image,1,cap);
      canvas.width=1;canvas.height=1;const tiny=await new Promise(r=>canvas.toBlob(r,'image/png'));
      let low=false;try{await renderer.count(tiny,cap);}catch{low=true;}
      const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
      const content='BT /F1 24 Tf 80 100 Td (B6) Tj ET\n0 0 0 rg 10 10 60 60 re f';
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=pdf.length;
      pdf+='xref\n0 7\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      const blob=new Blob([pdf],{type:'application/pdf'});const count=await renderer.count(blob,cap),p=await renderer.page(blob,2,cap);
      const bytes=Uint8Array.from(atob(p.imageBase64),x=>x.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:p.mimeType}));
      const output=document.createElement('canvas');output.width=p.width;output.height=p.height;const ctx=output.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
      const pixel=(x,y)=>[...ctx.getImageData(x,y,1,1).data].slice(0,3).reduce((n,x)=>n+x,0);
      return {image:r.width===300&&r.bytes>0,low,pdf:count===2&&p.width>p.height&&p.bytes>0&&pixel(100,500)<100&&pixel(5,5)>600};
    });assert.deepEqual(rendered,{image:true,low:true,pdf:true});console.log('PASS actual image/PDF per-page rendering and low-resolution rejection');
  }
}finally{await browser?.close();server.kill();}
