import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const red=process.env.B6_REVIEW_RED;
const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
let browser;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();
  const context=await browser.newContext();
  await context.route('**/*',r=>{
    const url=new URL(r.request().url());
    if(url.origin!==base)return r.abort();
    if(red&&['/index.html','/pedagogy-normalize.js','/pedagogy-intake.js'].includes(url.pathname))
      return r.fulfill({contentType:url.pathname.endsWith('.html')?'text/html':'application/javascript',
        body:execFileSync('git',['show',`eb7e69f:${url.pathname.slice(1)}`],{encoding:'utf8',maxBuffer:5000000})});
    return r.continue();
  });
  const failures=[],checks=[];
  const check=async(name,run)=>{checks.push(name);try{await run();console.log('PASS',name);}catch(e){failures.push(name+': '+e.message);console.log('FAIL',name,e.message);}};
  const page=await context.newPage();
  const ready=async()=>{await page.goto(base+'/index.html');await page.waitForFunction(()=>typeof createIntakeFixture==='function');};
  await ready();
  if(!red||red==='112'){
    await check('112 Node normSet isolates unknown/malformed intake',()=>{
      const source=red?execFileSync('git',['show','eb7e69f:pedagogy-normalize.js'],{encoding:'utf8'}):readFileSync('pedagogy-normalize.js','utf8');
      const env={};vm.runInNewContext(source,env);const n=env.PedagogyNormalize;
      for(const intake of [{version:2,sources:[]},{version:1,sources:[{sourceId:'not-a-uuid',pages:[1]}]}]){
        const s=n.normSet({problems:[{title:'ok'},{intake}]});assert.equal(s.problems.length,2);assert.equal(JSON.stringify(s.problems[1].intake),JSON.stringify(intake));
      }
    });
    await page.evaluate(()=>{
      localStorage.clear(); currentUser={uid:'review-112'};authEpoch++;fbReady=true;localDirty=false;
      window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,libraryCloudSchema:1,setRevisionSchema:1};
      loadSetSyncMeta(currentUser.uid);cloudSynced.clear();setWriteBase.clear();deletedIds.clear();sets=[];
      window.__messages=[];window.toast=m=>__messages.push(m);window.__writes=[];
      window.__docs=['첫째','둘째','셋째'].map((name,i)=>({id:'r'+i,name,header:'',order:i,revision:1,deleted:false,
        problems:[{id:'p'+i,title:name,blocks:[{type:'statement',data:{text:'body'}}]}]}));
      __docs[1].problems.push({id:'future',blocks:[],intake:{version:2,sources:[],future:{keep:'원문'}}});
      window.__snapshot=()=>({metadata:{fromCache:false,hasPendingWrites:false},docs:__docs.map(d=>({data:()=>structuredClone(d)})),docChanges:()=>__docs.map(d=>({type:'added',doc:{data:()=>structuredClone(d)}}))});
      const collection=()=>({get:async()=>__snapshot(),onSnapshot:(_options,fn)=>{window.__watch=fn;return ()=>{};},doc:id=>({id,collection,get:async()=>({exists:false}),onSnapshot:()=>()=>{}})});
      fbDb={collection,batch:()=>({set:(ref,data)=>__writes.push(data),commit:async()=>{}}),runTransaction:async run=>run({get:async ref=>({exists:true,data:()=>structuredClone(__docs.find(d=>d.id===ref.id))}),set:(ref,data)=>__writes.push(data)})};
      window.loadLibraryPrefs=async()=>{};window.flushToCloud=async()=>{};
    });
    await check('112 confirmed cloud snapshot keeps all three books',async()=>{
      const r=await page.evaluate(async()=>{await loadSets();renderLibrary();return {names:sets.map(s=>s.name),messages:__messages,raw:sets[1]?.problems[1]?.intake};});
      assert.deepEqual(r.names,['첫째','둘째','셋째']);assert.ok(!r.messages.some(m=>m.includes('연결하지 못')));assert.equal(r.raw.future.keep,'원문');
      assert.ok((await page.locator('#setGrid').innerText()).includes('읽기 전용'));
    });
    await check('112 sync/export/watch preserve opaque metadata without throwing',async()=>{
      const r=await page.evaluate(()=>{const s=sets.find(s=>s.id==='r1');const json=setJSON(s),doc=setToDoc(s,1),out=portableIntakeSet(s);__watch(__snapshot());return {json,raw:doc.problems[1].intake,out:out.problems[1].intake,n:sets.length};});
      assert.equal(r.n,3);assert.equal(r.raw.future.keep,'원문');assert.deepEqual(r.raw,r.out);assert.ok(r.json.includes('원문'));
    });
    await check('112 only incompatible book is blocked from editor/cloud writes',async()=>{
      const r=await page.evaluate(async()=>{showLibrary();showEditor('r1');const blocked=document.querySelector('#editorView').style.display==='none';
        sets[0].header='정상 수정';sets[1].header='오래된 탭 수정';localDirty=true;await writeCloudSnapshot(currentUser.uid,sessionContext());return {blocked,ids:__writes.map(x=>x.id),raw:sets[1].problems[1].intake};});
      assert.ok(r.blocked);assert.ok(r.ids.includes('r0'));assert.ok(!r.ids.includes('r1'));assert.equal(r.raw.future.keep,'원문');
    });
    await check('112 compatible local draft cannot overwrite future remote intake',async()=>{
      const r=await page.evaluate(async()=>{const before=__writes.length;try{await writeSetDocRevision(currentUser.uid,{...setToDoc(sets[0],0),id:'r1'},sessionContext(),{useCurrentServerAsBase:true});return {code:'accepted'};}catch(e){return {code:e.code,n:__writes.length-before};}});
      assert.equal(r.code,'set-intake-update');assert.equal(r.n,0);
    });
    if(!red)await check('112 explicit account purge can tombstone an incompatible remote book',async()=>{
      const r=await page.evaluate(async()=>{const before=__writes.length;await writeSetDocRevision(currentUser.uid,{...setToDoc(sets[0],0),id:'r1',deleted:true,problems:[]},sessionContext(),{allowWiping:true,useCurrentServerAsBase:true});return __writes.slice(before).map(d=>({id:d.id,deleted:d.deleted}));});
      assert.deepEqual(r,[{id:'r1',deleted:true}]);
    });
    await check('112 actual JSON file import preserves all books',async()=>{
      const input=await page.evaluate(()=>JSON.stringify(__docs));
      await page.locator('#importAllInput').setInputFiles({name:'review.json',mimeType:'application/json',buffer:Buffer.from(input)});
      await page.waitForFunction(()=>sets.length===6,null,{timeout:3000});
      const r=await page.evaluate(()=>({raw:sets[4].problems[1].intake,messages:__messages}));assert.equal(r.raw.future.keep,'원문');assert.ok(!r.messages.includes('JSON을 읽을 수 없어요'));
    });
    await check('112 actual backup restore keeps malformed intake and healthy siblings',async()=>{
      const r=await page.evaluate(()=>{const input=structuredClone(__docs);input[1].problems[1].intake={version:1,sources:[{sourceId:'not-a-uuid',pages:[1]}]};localStorage.setItem(backupKey(),JSON.stringify({sets:input,t:Date.now()}));
        const restored=restoreFromBackup();return {restored,n:sets.length,raw:sets[1].problems[1].intake};});
      assert.ok(r.restored);assert.equal(r.n,3);assert.equal(r.raw.sources[0].sourceId,'not-a-uuid');
    });
  }
  if(!red||red==='113'){
    await ready();
    const source=await page.evaluate(async()=>{
      localStorage.clear();currentUser=null;authEpoch++;sets=readLocalSets();sets=[];localDirty=true;writeLocalNow();
      const config={files:1,fileBytes:1000,totalBytes:1000,pages:1,minDimension:1,maxDimension:1000,imageBytes:1000,requestBytes:2000,calls:1,retries:1,problemsPerPage:1,problemsPerJob:1,problemsPerSet:500,fieldChars:1000,blocks:10,items:10};
      const renderer={count:async()=>1,page:async()=>({imageBase64:'aGVsbG8=',mimeType:'image/png',width:200,height:200,bytes:5})};
      window.__config=config;
      const client=createIntakeFixture({config,renderer,editorsConfirmed:true,transport:async()=>({task:PedagogyIntakeContract.TASK,problems:[{title:'',answer:'',blocks:[{type:'statement',text:'문제'}],units:[],difficulty:'중',points:null,pointsState:'absent',group:null}],usage:{used:1,limit:1}})});
      const {jobId}=await client.createJob([new File(['raw'],'fixture.png',{type:'image/png'})]);await client.run(jobId);const j=await client.readJob(jobId);
      const report=await client.adopt(jobId,{draftVersion:j.draftVersion,destinations:[{id:'a',name:'원본권',items:[{draftId:j.drafts[0].id,placementId:'1'}]}]});
      await client.finishJob(jobId);window.__client=client;renderLibrary();showLibrary();
      return {config,setId:report.results[0].setId,sourceId:j.sources[0]};
    });
    const duplicate=async(name)=>{
      const card=page.locator('.set-card').filter({has:page.locator('h3',{hasText:name})});
      await card.getByRole('button',{name:`${name} 문제집 메뉴`,exact:true}).click();
      await card.getByRole('button',{name:'복제',exact:true}).click();
      await page.waitForFunction(name=>sets.some(s=>s.name===name+' 복제'),name,{timeout:3000});
      return page.evaluate(name=>sets.find(s=>s.name===name+' 복제').id,name);
    };
    await check('113 same-tab actual duplicate inherits source',async()=>{
      const id=await duplicate('원본권');
      assert.equal(await page.evaluate(async id=>(await __client.forProblem(id,sets.find(s=>s.id===id).problems[0])).state,id),'available');
    });
    await page.reload();await page.waitForFunction(()=>typeof createIntakeFixture==='function');
    await page.evaluate(()=>{showLibrary();});
    // No client is constructed until AFTER the real duplicate click.
    let reloadedCopy;
    await check('113 reload then actual duplicate works without live client',async()=>{
      assert.equal(await page.evaluate(()=>intakeClients.size),0);
      reloadedCopy=await duplicate('원본권 복제');
      const r=await page.evaluate(async({config,id,sourceId})=>{window.__client=createIntakeFixture({config,editorsConfirmed:true});const p=sets.find(s=>s.id===id).problems[0];return {state:(await __client.forProblem(id,p)).state,impact:await __client.impact(sourceId)};},{config:source.config,id:reloadedCopy,sourceId:source.sourceId});
      assert.equal(r.state,'available');assert.ok(r.impact.active.includes(reloadedCopy));
    });
    await check('113 deleting originals leaves copy available after reload',async()=>{
      await page.evaluate(async id=>{for(const s of sets.filter(s=>s.id!==id)){await deleteSetEverywhere(s);sets=sets.filter(x=>x.id!==s.id);}localDirty=true;writeLocalNow();},reloadedCopy);
      await page.reload();await page.waitForFunction(()=>typeof createIntakeFixture==='function');
      const state=await page.evaluate(async({id,config})=>{window.__client=createIntakeFixture({config,editorsConfirmed:true});await __client.reconcile();return (await __client.forProblem(id,sets.find(s=>s.id===id).problems[0])).state;},{id:reloadedCopy,config:source.config});assert.equal(state,'available');
    });
    await check('113 boot recovery creates conflict copy without live client',async()=>{
      // Use the same owner's persisted guest root under a fixture login owner.
      await page.evaluate(async id=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('PM_INTAKE_V1');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
        await new Promise((ok,no)=>{const tx=db.transaction('owners','readwrite'),store=tx.objectStore('owners'),r=store.get('guest');r.onsuccess=()=>{const root={...r.result,owner:'review-113'};if(root.links[id])root.links[id].state='detached';for(const src of Object.values(root.sources))if(src.blob)src.state='unlinked';store.put(root);};tx.oncomplete=ok;tx.onabort=()=>no(tx.error);});db.close();
        const set=sets.find(s=>s.id===id);localStorage.setItem('PM_SETS_V7:review-113',JSON.stringify([set]));
        localStorage.setItem(setConflictKeyFor('review-113'),JSON.stringify({v:1,entries:[{setId:id,copyId:'boot-copy',snapshot:set,order:0,reason:'remote-changed',hasBase:true,baseRevision:1,serverRevision:2,at:Date.now()}]}));
      },reloadedCopy);
      await page.reload();await page.waitForFunction(()=>typeof createIntakeFixture==='function');
      const r=await page.evaluate(async({id,config})=>{currentUser={uid:'review-113'};authEpoch++;window.PEDAGOGY_PUBLIC_CONFIG={...window.PEDAGOGY_PUBLIC_CONFIG,setRevisionSchema:1};
        // Simulate the boot caller after owner-local load, before any B6 client.
        sets=JSON.parse(localStorage.getItem('PM_SETS_V7:review-113'));readLocalSets();const clients=intakeClients.size;const added=await ensureConflictCopies(currentUser.uid);
        const c=createIntakeFixture({config,editorsConfirmed:true});const cp=sets.find(s=>s.id==='boot-copy');return {clients,added,state:(await c.forProblem(cp.id,cp.problems[0])).state};},{id:reloadedCopy,config:source.config});
      assert.equal(r.clients,0);assert.ok(r.added);assert.equal(r.state,'available');
    });
    await check('113 imported source IDs still cannot grant Blob access',async()=>{
      const state=await page.evaluate(async config=>{const c=createIntakeFixture({config,editorsConfirmed:true});const p=structuredClone(sets.find(s=>s.id==='boot-copy').problems[0]);return (await c.forProblem('external-json',p)).state;},source.config);assert.equal(state,'missing');
    });
    if(!red)await check('113 source-link IDB failure holds copy, reload retry recovers',async()=>{
      await page.reload();await page.waitForFunction(()=>typeof createIntakeFixture==='function');
      await page.evaluate(()=>{showLibrary();window.__messages=[];window.toast=m=>__messages.push(m);IDBFactory.prototype.open=()=>{const r={error:new DOMException('fixture link quota','QuotaExceededError')};queueMicrotask(()=>r.onerror?.());return r;};});
      const name='원본권 복제 복제',before=await page.evaluate(()=>sets.length);
      const card=page.locator('.set-card').filter({has:page.locator('h3',{hasText:name})});
      await card.getByRole('button',{name:`${name} 문제집 메뉴`,exact:true}).click();await card.getByRole('button',{name:'복제',exact:true}).click();
      await page.waitForFunction(()=>__messages.some(m=>m.includes('원문 연결 저장 실패')));
      assert.equal(await page.evaluate(()=>sets.length),before);
      await page.reload();await page.waitForFunction(()=>typeof createIntakeFixture==='function');await page.evaluate(()=>showLibrary());
      const id=await duplicate(name);
      const state=await page.evaluate(async({id,config})=>{const c=createIntakeFixture({config,editorsConfirmed:true});return (await c.forProblem(id,sets.find(s=>s.id===id).problems[0])).state;},{id,config:source.config});assert.equal(state,'available');
    });
  }
  if(red){const target=red==='112'?'112 confirmed cloud snapshot':'113 reload then actual duplicate';assert.ok(failures.some(x=>x.startsWith(target)&&x.includes('Expected values')),`old code did not reproduce ${red}`);if(red==='113')assert.ok(failures.some(x=>x.startsWith('113 boot recovery')&&x.includes("'missing'"))); console.log(`RED ${red}: ${failures.length} reproducible failures`);}
  else{assert.deepEqual(failures,[]);console.log(`PASS ${checks.length} review reproduction checks`);}
}finally{await browser?.close();server.kill();}
