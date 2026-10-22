import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:net';
const port=await new Promise(resolve=>{
  const server=createServer();server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});
});
const base=`http://127.0.0.1:${port}`,server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
const mutation=process.env.COMPOSITION_RED||'';
let browser;
try{
  for(let n=0;n<80;n++){
    try{if((await fetch(base+'/health')).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch();const context=await browser.newContext();
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
    const choices={
      stale:['/pedagogy-intake.js',"j.state==='finished'||j.draftVersion!==draftVersion","j.state==='finished'"],
      frozen:['/pedagogy-intake.js','if(hasJobAdoption(root,j.id))','if(false)'],
      groups:['/pedagogy-composition.js','for(const group of job.groups){','for(const group of []){'],
      paid:['/pedagogy-intake.js',"if(hasJobAdoption(r,jobId)){live.state='partial';return false;}","if(false){live.state='partial';return false;}"],
      views:['/pedagogy-intake.js','views.get(id).problem.groupOf=group.members[0];',"views.get(id).problem.groupOf='original-id';"],
      fork:['/pedagogy-intake.js','if(draftIds.some(id=>!known.has(id)||taken.has(id)))','if(draftIds.some(id=>!known.has(id)))'],
      undo:['/pedagogy-intake.js','j.drafts=previous.drafts;j.composition=previous.composition;','j.composition=previous.composition;']
    };
    if(mutation&&choices[mutation]?.[0]===url.pathname){
      const [,from,to]=choices[mutation],source=await readFile(url.pathname.slice(1),'utf8');
      assert.ok(source.includes(from),'composition RED anchor missing');
      return route.fulfill({contentType:'application/javascript',body:process.env.COMPOSITION_SKIP_MUTATION==='1'?source:source.replace(from,to)});
    }
    return route.continue();
  });
  const page=await context.newPage();await page.goto(base+'/index.html');
  await page.waitForFunction(()=>typeof createIntakeStorageClient==='function'&&typeof PedagogyComposition==='object');
  const result=await page.evaluate(async()=>{
    const names=[],failures=[];
    const ok=(value,message='조건 실패')=>{if(!value)throw Error(message);};
    const eq=(a,b,message='값 불일치')=>ok(JSON.stringify(a)===JSON.stringify(b),message);
    const rejects=async(run,pattern)=>{
      try{await run();}catch(error){if(!pattern||pattern.test(error.message))return;throw error;}
      throw Error('거절되지 않음');
    };
    const check=async(name,run)=>{names.push(name);try{await run();}catch(error){failures.push({name,message:error.message});}};
    localStorage.clear();currentUser=null;authEpoch++;fbReady=false;wiping=false;localDirty=false;
    const intake=unit=>({version:1,sources:[],units:[{value:unit,origin:'user'}],difficulty:{value:'중',origin:'user'},
      points:null,pointsState:'absent',contentReview:'reviewed',classificationReview:'reviewed'});
    const problem=(id,unit)=>({id,title:id,answer:'$x=2$',blocks:[{type:'statement',data:{text:'본문 $x^2$'}}],intake:intake(unit)});
    const first=normSet({id:'source-a',name:'기존 A',problems:[problem('g1','함수'),problem('g2','함수'),problem('q3','방정식')]},{keepId:true});
    first.subject='english';first.problems[0].groupLead='다음 자료를 읽고 물음에 답하시오.';
    ok(PedagogyNormalize.setGroupSpan(first.problems,'g1',2));
    const second=normSet({id:'source-b',name:'기존 B',problems:[problem('q4','도형')]},{keepId:true});
    sets=[first,second];ok(writeLocalNow());
    const dbName='composition-'+crypto.randomUUID();
    const client=createIntakeStorageClient({editorsConfirmed:true,dbName,renderer:{count:async()=>1}});
    let jobId,job,plan;
    await check('snapshot',async()=>{
      ({jobId}=await client.createComposition(['source-a','source-b']));job=await client.readComposition(jobId);
      eq(job.drafts.length,4);eq(job.groups.length,1);eq(job.calls,0);
      first.problems[0].answer='원본 나중 편집';ok(writeLocalNow());
      eq((await client.readComposition(jobId)).drafts[0].problem.answer,'$x=2$');
      eq((await client.listJobs())[0].id,jobId);
    });
    await check('view-group-ids',async()=>{
      eq(PedagogyNormalize.groupDiagnostics(job.drafts.map(d=>d.problem)),[]);
      eq(job.drafts[0].problem.groupOf,job.drafts[0].id);eq(job.drafts[1].problem.groupOf,job.drafts[0].id);
    });
    await check('seven-five',async()=>{
      const seven={drafts:Array.from({length:7},(_,i)=>({id:'u'+i,problem:{intake:intake('단원'+i)}})),groups:[]};
      const proposal=PedagogyComposition.propose(seven,{preset:'units',count:5});
      eq(proposal.plan.destinations.length,7);ok(proposal.warnings.some(x=>x.includes('5권')&&x.includes('7권')));
      eq(proposal.plan.destinations.flatMap(d=>d.items).length,7);
      const points=PedagogyComposition.propose(seven,{preset:'points',count:5});
      eq(points.plan.unassigned.length,7);eq(points.plan.destinations.length,0);
    });
    await check('coverage',async()=>{
      plan=PedagogyComposition.propose(job,{preset:'books',count:2}).plan;
      PedagogyComposition.validate(job,plan,{complete:true});
      const missing=structuredClone(plan);missing.destinations[0].items.shift();
      await rejects(()=>PedagogyComposition.validate(job,missing),/모든|공통/);
      const duplicate=structuredClone(plan);duplicate.excluded.push(job.drafts[0].id);
      await rejects(()=>PedagogyComposition.validate(job,duplicate),/중복/);
    });
    await check('groups',async()=>{
      const split=structuredClone(plan),firstDraft=job.groups[0].members[0];
      for(const destination of split.destinations)destination.items=destination.items.filter(x=>x.draftId!==firstDraft);
      split.excluded.push(firstDraft);
      await rejects(()=>PedagogyComposition.validate(job,split),/공통지문/);
      const moved=PedagogyComposition.move(job,plan,firstDraft,'excluded');
      eq(moved.excluded,job.groups[0].members);eq(moved.destinations.flatMap(d=>d.items).length,2);
      const restored=PedagogyComposition.move(job,moved,firstDraft,plan.destinations[0].id);
      eq(restored.excluded,[]);PedagogyComposition.validate(job,restored,{complete:true});
    });
    await check('edit',async()=>{
      await client.saveComposition(jobId,{draftVersion:job.draftVersion,plan,patches:[{id:job.drafts[0].id,changes:{answer:'$x=7$'}}]});
      job=await client.readComposition(jobId);
      eq(job.drafts[0].problem.answer,'$x=7$');eq(job.drafts[0].problem.intake.contentReview,'unreviewed');
      eq(job.drafts[0].problem.intake.classificationReview,'reviewed');eq(first.problems[0].answer,'원본 나중 편집');
    });
    await check('stale',async()=>{
      await rejects(()=>client.saveComposition(jobId,{draftVersion:job.draftVersion-1,plan}),/초안이 바뀌었/);
    });
    await check('undo',async()=>{
      await client.undoComposition(jobId,{draftVersion:job.draftVersion});job=await client.readComposition(jobId);
      eq(job.drafts[0].problem.answer,'$x=2$');eq(job.drafts[0].problem.intake.contentReview,'reviewed');ok(job.canRedo);
      await client.undoComposition(jobId,{draftVersion:job.draftVersion,redo:true});job=await client.readComposition(jobId);
      eq(job.drafts[0].problem.answer,'$x=7$');ok(job.canUndo);
    });
    let report;
    await check('adoption',async()=>{
      const options={draftVersion:job.draftVersion,destinations:job.composition.destinations.filter(d=>d.items.length)};
      const [a,b]=await Promise.all([client.adopt(jobId,options),client.adopt(jobId,options)]);report=a;
      eq(a.adoption.id,b.adoption.id);eq(a.results.map(x=>x.setId),b.results.map(x=>x.setId));
      eq(a.results.length,2);eq(sets.length,4);
      const copied=sets.find(x=>x.id===a.results[0].setId);
      ok(!['g1','g2','q3','q4'].includes(copied.problems[0].id));
      eq(copied.problems[0].groupOf,copied.problems[0].id);eq(copied.problems[1].groupOf,copied.problems[0].id);
      eq(PedagogyNormalize.groupDiagnostics(copied.problems),[]);eq(copied.subject,'english');
      eq(copied.problems[0].answer,'$x=7$');eq(copied.problems[0].groupLead,'다음 자료를 읽고 물음에 답하시오.');
    });
    await check('frozen',async()=>{
      await rejects(()=>client.saveComposition(jobId,{draftVersion:job.draftVersion,plan}),/이미 만들기/);
      const status=await client.adoptionStatus(report.adoption.id);eq(status.results.map(x=>x.state),['local','local']);
    });
    await check('deleted-result',async()=>{
      const deleted=report.results[0].setId;sets=sets.filter(x=>x.id!==deleted);deletedIds.set(deleted,Date.now());ok(writeLocalNow());
      const again=await client.adopt(jobId,{draftVersion:job.draftVersion,destinations:job.composition.destinations});
      ok(!sets.some(x=>x.id===deleted));eq(again.results.find(x=>x.setId===deleted).state,'deleted');
    });
    await check('partial-local-reentry',async()=>{
      const created=await client.createComposition(['source-a']);let retryJob=await client.readComposition(created.jobId);
      const retryPlan=PedagogyComposition.propose(retryJob,{preset:'books',count:1}).plan;
      await client.saveComposition(created.jobId,{draftVersion:retryJob.draftVersion,plan:retryPlan});
      retryJob=await client.readComposition(created.jobId);
      const options={draftVersion:retryJob.draftVersion,destinations:retryJob.composition.destinations};
      const countBefore=sets.length,realWrite=writeLocalNow;let failed;
      try{writeLocalNow=()=>false;failed=await client.adopt(created.jobId,options);}finally{writeLocalNow=realWrite;}
      eq(failed.results[0].state,'failed');eq(sets.length,countBefore);
      const reopened=createIntakeStorageClient({editorsConfirmed:true,dbName,renderer:{count:async()=>1}});
      const resumed=await reopened.adopt(created.jobId,options);
      eq(resumed.adoption.id,failed.adoption.id);eq(resumed.results[0].setId,failed.results[0].setId);
      eq(resumed.results[0].state,'local');eq(sets.length,countBefore+1);
      await reopened.adopt(created.jobId,options);eq(sets.length,countBefore+1);
    });
    await check('owner-switch',async()=>{
      const pending=client.readComposition(jobId);currentUser={uid:'different-owner'};authEpoch++;
      try{
        await rejects(()=>pending,/계정이 바뀌어/);
        eq(await client.listJobs(),[]);await rejects(()=>client.readComposition(jobId),/중단/);
      }finally{currentUser=null;authEpoch++;}
    });
    await check('plan-limits',async()=>{
      const reserved=structuredClone(plan);reserved.destinations[0].id='excluded';
      await rejects(()=>PedagogyComposition.validate(job,reserved),/목적지/);
      const fresh=await client.createComposition(['source-a']);const freshJob=await client.readComposition(fresh.jobId);
      const proposed=PedagogyComposition.propose(freshJob,{preset:'books',count:1}).plan;
      await client.saveComposition(fresh.jobId,{draftVersion:freshJob.draftVersion,plan:proposed});
      const saved=await client.readComposition(fresh.jobId),changed=structuredClone(saved.composition.destinations);changed[0].name='확인 안 한 다른 이름';
      await rejects(()=>client.adopt(fresh.jobId,{draftVersion:saved.draftVersion,destinations:changed}),/저장한 구성/);
    });
    let partialClient,partialJobId,partialJob,partialCalls=0,partialReport;
    await check('frozen-retry-cost',async()=>{
      const config={files:2,fileBytes:1000,totalBytes:2000,pages:2,minDimension:1,maxDimension:20,imageBytes:100,
        requestBytes:2000,calls:10,retries:2,problemsPerPage:5,problemsPerJob:20,problemsPerSet:500,fieldChars:1000,blocks:50,items:10};
      const raw=answer=>({title:'',answer,blocks:[{type:'statement',text:'추출 본문'}],units:[],difficulty:null,points:null,pointsState:'absent',group:null});
      partialClient=createIntakeFixture({config,editorsConfirmed:true,dbName:'composition-ai-'+crypto.randomUUID(),
        renderer:{count:async()=>2,page:async()=>({imageBase64:'YQ==',mimeType:'image/png',width:10,height:10,bytes:1})},
        transport:async()=>{partialCalls++;if(partialCalls===2)throw Error('둘째 쪽 실패');return {task:PedagogyIntakeContract.TASK,problems:[raw('A'),raw('B')]};}});
      ({jobId:partialJobId}=await partialClient.createJob([new File(['fixture'],'원문.pdf',{type:'application/pdf'})]));
      await partialClient.run(partialJobId);partialJob=await partialClient.readComposition(partialJobId);
      eq(partialJob.pages.map(x=>x.state),['success','failed']);
      let partialPlan=PedagogyComposition.propose(partialJob,{preset:'books',count:1}).plan;
      partialPlan=PedagogyComposition.move(partialJob,partialPlan,partialJob.drafts[1].id,'excluded');
      await partialClient.saveComposition(partialJobId,{draftVersion:partialJob.draftVersion,plan:partialPlan});
      partialJob=await partialClient.readComposition(partialJobId);
      partialReport=await partialClient.adopt(partialJobId,{draftVersion:partialJob.draftVersion,partial:true,destinations:partialJob.composition.destinations});
      await rejects(()=>partialClient.run(partialJobId,{retryPages:[1],confirmCharge:true}),/새 작업|이미 만들기/);
      eq(partialCalls,2);
    });
    await check('unadopted-fork',async()=>{
      const current=await partialClient.readComposition(partialJobId),leftover=partialJob.drafts[1].id;
      const fresh=await partialClient.forkComposition(partialJobId,{draftVersion:current.draftVersion,draftIds:[leftover]});
      const forked=await partialClient.readComposition(fresh.jobId);
      eq(forked.drafts.length,1);ok(forked.drafts[0].id!==leftover);eq(forked.drafts[0].problem.answer,'B');
      eq(forked.pages.length,0);eq(partialCalls,2);
      const unchanged=await partialClient.adoptionStatus(partialReport.adoption.id);
      eq(unchanged.results.map(x=>x.setId),partialReport.results.map(x=>x.setId));
      await rejects(()=>partialClient.forkComposition(partialJobId,{draftVersion:current.draftVersion,draftIds:[partialJob.drafts[0].id]}),/이미|채택/);
    });
    await check('frozen-concurrent-cost',async()=>{
      let release,reached,calls=0;
      const gate=new Promise(resolve=>{release=resolve;}),arrived=new Promise(resolve=>{reached=resolve;});
      const localClient=createIntakeFixture({config:partialJob.limits,editorsConfirmed:true,dbName:'concurrent-'+crypto.randomUUID(),
        renderer:{count:async()=>2,page:async(_blob,page)=>{
          if(page===2){reached();await gate;}
          return {imageBase64:'YQ==',mimeType:'image/png',width:10,height:10,bytes:1};
        }},transport:async()=>{calls++;return {task:PedagogyIntakeContract.TASK,problems:[{title:'',answer:'',
          blocks:[{type:'statement',text:'성공한 첫 쪽'}],units:[],difficulty:null,points:null,pointsState:'absent',group:null}]};}});
      const created=await localClient.createJob([new File(['fixture'],'동시 처리.pdf',{type:'application/pdf'})]);
      const processing=localClient.run(created.jobId);await arrived;
      try{
        let current=await localClient.readComposition(created.jobId),proposed=PedagogyComposition.propose(current,{preset:'books',count:1}).plan;
        await localClient.saveComposition(created.jobId,{draftVersion:current.draftVersion,plan:proposed});
        current=await localClient.readComposition(created.jobId);
        await localClient.adopt(created.jobId,{draftVersion:current.draftVersion,partial:true,destinations:current.composition.destinations});
      }finally{release();}
      await rejects(()=>processing,/새 작업|이미 만들기/);eq(calls,1);
    });
    await check('ai-group-fork',async()=>{
      const raw=(answer,group)=>({title:'',answer,blocks:[{type:'statement',text:'AI 지문 미확인'}],units:[],difficulty:null,points:null,pointsState:'absent',group});
      const localClient=createIntakeFixture({config:partialJob.limits,editorsConfirmed:true,dbName:'group-fork-'+crypto.randomUUID(),
        renderer:{count:async()=>1,page:async()=>({imageBase64:'YQ==',mimeType:'image/png',width:10,height:10,bytes:1})},
        transport:async()=>({task:PedagogyIntakeContract.TASK,problems:[raw('G1','g'),raw('독립',null),raw('G2','g')]})});
      const created=await localClient.createJob([new File(['fixture'],'그룹.pdf',{type:'application/pdf'})]);
      await localClient.run(created.jobId);let current=await localClient.readComposition(created.jobId);
      ok(!PedagogyNormalize.groupDiagnostics(current.drafts.map(d=>d.problem)).some(x=>x.reason==='대표 문항 없음'));
      PedagogyComposition.validate(current,current.composition);
      let proposed=PedagogyComposition.propose(current,{preset:'books',count:1}).plan;
      proposed=PedagogyComposition.move(current,proposed,current.groups[0].members[0],'excluded');
      await localClient.saveComposition(created.jobId,{draftVersion:current.draftVersion,plan:proposed});current=await localClient.readComposition(created.jobId);
      await localClient.adopt(created.jobId,{draftVersion:current.draftVersion,destinations:current.composition.destinations});
      await rejects(()=>localClient.forkComposition(created.jobId,{draftVersion:current.draftVersion,draftIds:[current.groups[0].members[0]]}),/공통지문/);
      const fresh=await localClient.forkComposition(created.jobId,{draftVersion:current.draftVersion,draftIds:current.groups[0].members});
      const forked=await localClient.readComposition(fresh.jobId);eq(forked.drafts.length,2);
      eq(forked.drafts[0].problem.groupReview,'intake');eq(forked.drafts[0].problem.groupOf,forked.drafts[0].id);
      eq(forked.kind,'extraction');
    });
    await check('mixed-subjects',async()=>{
      const created=await client.createComposition(['source-a','source-b']);let mixed=await client.readComposition(created.jobId);
      const plan=PedagogyComposition.propose(mixed,{preset:'books',count:1}).plan;
      await client.saveComposition(created.jobId,{draftVersion:mixed.draftVersion,plan});mixed=await client.readComposition(created.jobId);
      const adopted=await client.adopt(created.jobId,{draftVersion:mixed.draftVersion,destinations:mixed.composition.destinations});
      eq(sets.find(s=>s.id===adopted.results[0].setId).subject,'all');
    });
    await check('future-and-legacy',async()=>{
      const future={id:'future',name:'미래',setSchemaVersion:99,problems:[problem('future-q','미래')]};sets.push(future);ok(writeLocalNow());
      await rejects(()=>client.createComposition(['future']),/문항|업데이트/);
      const legacy=normSet({id:'legacy',name:'옛 묶음',problems:[{...problem('old-a','함수'),groupSpan:2,groupLead:'옛 지문'},problem('old-b','함수')]},{keepId:true});
      sets.push(legacy);ok(writeLocalNow());await rejects(()=>client.createComposition(['legacy']),/공통지문/);
    });
    return {names,failures};
  });
  for(const name of result.names)console.log((result.failures.some(x=>x.name===name)?'FAIL ':'PASS ')+name);
  result.failures.forEach(f=>console.error(f.name+': '+f.message));
  assert.equal(result.names.length,20,'all composition acceptance checks must run');
  if(mutation){
    assert.notEqual(process.env.COMPOSITION_SKIP_MUTATION,'1','RED mutation skipped');
    const target={paid:'frozen-concurrent-cost',views:'view-group-ids',fork:'unadopted-fork'}[mutation]||mutation;
    assert.ok(result.failures.some(f=>f.name===target),'RED target stayed green');
    console.log('RED composition '+mutation+' detected');
  }else assert.deepEqual(result.failures,[]);
}finally{await browser?.close();server.kill();}
