import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:net';
const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=`http://127.0.0.1:${port}`,server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'}),red=process.env.COMPOSITION_UI_RED||'';
let browser;const failures=[],names=[];
const logDir='/private/tmp/u2-ui';await mkdir(logDir,{recursive:true});
try{
 for(let n=0;n<80;n++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch();
 async function setup(){
  const ctx=await browser.newContext({viewport:{width:1194,height:834}});await ctx.route('**/*',async r=>{
   const u=new URL(r.request().url());if(u.origin!==base)return r.abort();
   const mutations={
    count:['/pedagogy-composition-ui.js',"if(mismatch&&!approve.checked)",'if(false)'],
    dirty:['/pedagogy-composition-ui.js','function cleanRequired(){if(dirty)','function cleanRequired(){if(false)'],
    source:['/pedagogy-composition-ui.js','{view.close();return;}sourceView=view;','{return;}sourceView=view;'],
    owner:['/pedagogy-composition-ui.js','finally{if(lease===serial){','finally{if(true){'],
    selection:['/pedagogy-composition-ui.js','if(!visible.includes(selectedId))','if(false)'],
    points:['/pedagogy-intake.js',"fail('배점은 0 이상의 숫자로 입력하거나 비워 주세요');",'void 0;']
   };
   if(red&&mutations[red]?.[0]===u.pathname){
    const [,from,to]=mutations[red];let source=await readFile(u.pathname.slice(1),'utf8');
    assert.ok(source.includes(from));if(process.env.COMPOSITION_UI_SKIP_MUTATION!=='1')source=source.replace(from,to);
    return r.fulfill({contentType:'application/javascript',body:source});
   }return r.continue();
  });
  const p=await ctx.newPage();p.setDefaultTimeout(5000);await p.goto(base+'/index.html');
  await p.waitForFunction(()=>typeof compositionUI==='object');
  await p.evaluate(()=>{
   localStorage.clear();currentUser=null;authEpoch++;fbReady=false;intakeCloudReady=false;
   const problem=(id,unit)=>({id,title:'함수 문항 '+id,answer:'$x=2$',blocks:[{type:'statement',data:{text:'함수 $f(x)=x^2$의 값을 구하시오.'}}],intake:{version:1,sources:[],units:[{value:unit,origin:'user'}],difficulty:{value:'최상위',origin:'ai'},points:null,pointsState:'absent',contentReview:'reviewed',classificationReview:'reviewed'}});
   const first=normSet({id:'a',name:'단원별 함수 모음',subject:'math',problems:[problem('q1','함수1'),problem('q2','함수1'),...Array.from({length:6},(_,i)=>problem('q'+(i+3),'함수'+(i+2)))]},{keepId:true});
   first.problems[0].groupLead='다음 공통지문';PedagogyNormalize.setGroupSpan(first.problems,'q1',2);
   sets=[first];localDirty=true;writeLocalNow();window.__uiOriginal=JSON.stringify(sets);renderLibrary();
  });return {p,ctx};
 }
 async function settled(p){await p.waitForFunction(()=>!document.querySelector('.cmp-content')?.disabled);}
 async function start(p){
  await p.getByRole('button',{name:'+ 새 문제집',exact:true}).click();await settled(p);await p.getByRole('menuitem',{name:/여러 권으로 새로 구성/}).click();await settled(p);
  await p.getByLabel('같은 브라우저의 다른 PEDAGOGY 탭을 닫았어요').check();await p.getByLabel('단원별 함수 모음 · 8문항').check();
  await p.getByRole('button',{name:'선택한 문제집으로 구성 시작',exact:true}).click();await settled(p);await p.getByLabel('분류 기준').waitFor();
 }
 async function proposal(p){await p.getByLabel('분류 기준').selectOption('units');await p.getByLabel('원하는 권수',{exact:true}).fill('5');await p.getByRole('button',{name:'새 구성안 미리보기',exact:true}).click();await settled(p);await p.getByRole('region').count();}
 async function check(name,run){names.push(name);const {p,ctx}=await setup();try{await run(p);console.log('PASS '+name);}catch(e){failures.push({name,message:e.message});console.error('FAIL '+name+': '+e.message);}finally{await ctx.close();}}
 await check('entry-and-gate',async p=>{
  await p.getByRole('button',{name:'+ 새 문제집',exact:true}).click();await settled(p);await p.getByRole('menuitem',{name:/여러 권으로 새로 구성/}).click();await settled(p);
  await p.getByRole('button',{name:'선택한 문제집으로 구성 시작',exact:true}).click();await settled(p);assert.match(await p.locator('.cmp-message').innerText(),/다른 탭/);
  assert.equal(await p.getByRole('button',{name:'PDF·사진 일괄 추출 준비 중',exact:true}).isEnabled(),false);
  await p.keyboard.press('Escape');assert.equal(await p.locator('#compositionDialog').evaluate(x=>x.open),false);
  await p.locator('#selectBtn').click();await settled(p);await p.locator('#setGrid input[type=checkbox]').check();
  await p.getByRole('button',{name:'여러 권으로 구성',exact:true}).click();await settled(p);assert.equal(await p.getByLabel('단원별 함수 모음 · 8문항').isChecked(),true);
 });
 await check('count-confirmation',async p=>{
  await start(p);await proposal(p);assert.match(await p.locator('.cmp-proposal').innerText(),/제안 7권/);
  await p.getByRole('button',{name:'새 구성안 적용',exact:true}).click();await settled(p);assert.match(await p.locator('.cmp-message').innerText(),/권수 변경/);
  await p.getByLabel('요청한 권수와 다른 7권으로 적용할게요').check();await p.getByRole('button',{name:'새 구성안 적용',exact:true}).click();await settled(p);
  assert.match(await p.locator('.cmp-toolbar').first().innerText(),/미분류 0/);
  assert.equal(await p.evaluate(()=>JSON.stringify(sets)===window.__uiOriginal),true);
 });
 await check('dirty-and-undo',async p=>{
  await start(p);await p.getByLabel('정답',{exact:true}).fill('$x=9$');
  await p.getByRole('button',{name:'새 구성안 미리보기',exact:true}).click();await settled(p);assert.match(await p.locator('.cmp-message').innerText(),/먼저 저장/);
  await p.getByRole('button',{name:'문항 수정 저장',exact:true}).click();await settled(p);assert.equal(await p.getByLabel('정답',{exact:true}).inputValue(),'$x=9$');
  assert.match(await p.locator('.cmp-detail').innerText(),/본문 확인 필요/);
  assert.deepEqual(await p.evaluate(async()=>{const c=createIntakeStorageClient();const jobs=await c.listJobs();const j=await c.readComposition(jobs[0].id);return [j.drafts[0].problem.intake.difficulty,j.drafts[0].problem.intake.classificationReview];}),[{value:'최상위',origin:'ai'},'reviewed']);
  await p.getByRole('button',{name:'실행취소',exact:true}).click();await settled(p);assert.equal(await p.getByLabel('정답',{exact:true}).inputValue(),'$x=2$');
  assert.match(await p.locator('.cmp-detail').innerText(),/본문 확인됨/);
  await p.getByRole('button',{name:'다시실행',exact:true}).click();await settled(p);assert.equal(await p.getByLabel('정답',{exact:true}).inputValue(),'$x=9$');
 });
 await check('stale-proposal-and-group',async p=>{
  await start(p);await proposal(p);await p.getByLabel('문항 목적지').selectOption('excluded');await p.getByRole('button',{name:'이 목적지로 이동',exact:true}).click();await settled(p);
  assert.match(await p.locator('.cmp-toolbar').first().innerText(),/제외 2/);
  await p.getByLabel('요청한 권수와 다른 7권으로 적용할게요').check();await p.getByRole('button',{name:'새 구성안 적용',exact:true}).click();await settled(p);assert.match(await p.locator('.cmp-message').innerText(),/초안이 바뀌/);
  assert.match(await p.locator('.cmp-toolbar').first().innerText(),/제외 2/);
 });
 await check('manual-request-and-no-points',async p=>{
  await start(p);await p.getByLabel('구성 요청',{exact:true}).fill('어려운 문제만 그림도 다시 만들어줘');await p.getByRole('button',{name:'새 구성안 미리보기',exact:true}).click();await settled(p);assert.match(await p.locator('.cmp-message').innerText(),/해석/);
  await p.getByLabel('구성 요청',{exact:true}).fill('배점별로 5권');await p.getByRole('button',{name:'새 구성안 미리보기',exact:true}).click();await settled(p);assert.match(await p.locator('.cmp-proposal').innerText(),/미분류 8 → 8/);
  assert.match(await p.locator('.cmp-proposal').innerText(),/배점 없음/);
 });
 await check('adopt-reentry-and-editor',async p=>{
  await start(p);await p.getByRole('button',{name:'새 구성안 미리보기',exact:true}).click();await settled(p);await p.getByRole('button',{name:'새 구성안 적용',exact:true}).click();await settled(p);
  await p.getByRole('button',{name:'문제집 1권 만들기',exact:true}).dblclick();await p.getByRole('heading',{name:'만들기 결과',exact:true}).waitFor();
  assert.match(await p.locator('.cmp-results').innerText(),/이 기기 저장됨.*로그인 전/);
  const before=await p.evaluate(()=>sets.map(s=>s.id));assert.equal(before.length,2);
  await p.getByRole('button',{name:'라이브러리로',exact:true}).click();await settled(p);await p.reload();await p.waitForFunction(()=>typeof compositionUI==='object');
  await p.getByRole('button',{name:'+ 새 문제집',exact:true}).click();await settled(p);await p.getByRole('menuitem',{name:/여러 권으로 새로 구성/}).click();await settled(p);await p.getByLabel('같은 브라우저의 다른 PEDAGOGY 탭을 닫았어요').check();
  await p.getByRole('button',{name:/단원별 함수 모음 · 8문항 · 만들기 결과 있음/}).click();await settled(p);
  assert.deepEqual(await p.evaluate(()=>sets.map(s=>s.id)),before);await p.getByRole('button',{name:'편집기 열기',exact:true}).click();await settled(p);assert.equal(await p.locator('#compositionDialog').evaluate(x=>x.open),false);
 });
 await check('invalid-points',async p=>{
  await start(p);await p.getByLabel('배점 (없으면 비움)',{exact:true}).fill('-1');await p.getByRole('button',{name:'문항 수정 저장',exact:true}).click();await settled(p);
  assert.match(await p.locator('.cmp-message').innerText(),/배점은/);assert.equal(await p.getByLabel('배점 (없으면 비움)',{exact:true}).inputValue(),'-1');
  await p.getByRole('button',{name:'문항 수정 되돌리기',exact:true}).click();await settled(p);assert.equal(await p.getByLabel('배점 (없으면 비움)',{exact:true}).inputValue(),'');
 });
 await check('selected-bucket-consistency',async p=>{
  await start(p);await p.locator('.cmp-questions button').nth(7).click();await settled(p);await proposal(p);
  await p.getByLabel('요청한 권수와 다른 7권으로 적용할게요').check();await p.getByRole('button',{name:'새 구성안 적용',exact:true}).click();await settled(p);
  assert.equal(await p.locator('.cmp-questions button[aria-pressed=true]').count(),1);
  assert.equal(await p.getByLabel('문항 제목',{exact:true}).last().inputValue(),'함수 문항 q1');
 });
 await check('owner-generation',async p=>{
  const result=await p.evaluate(async()=>{
   document.getElementById('compositionDialog').remove();let identity='a',release,opens=0;
   const pending=new Promise(resolve=>release=resolve);
   const ui=PedagogyCompositionUI.create({session:()=>identity,client:()=>({listJobs:()=>{const captured=identity;opens++;return opens===1?pending.then(()=>{if(identity!==captured)throw Error('계정 변경');return [];}):Promise.resolve([]);}}),sets:()=>[],signedIn:()=>false});
   const first=ui.open();identity='b';ui.sessionChanged();await ui.open();release();await first;
   const d=document.getElementById('compositionDialog');return {open:d.open,children:d.querySelector('fieldset').childElementCount,disabled:d.querySelector('fieldset').disabled,opens};
  });assert.deepEqual(result,{open:true,children:3,disabled:false,opens:2});
 });
 await check('late-source-disposal',async p=>{
  await p.evaluate(async()=>{
   document.getElementById('compositionDialog').remove();window.__closed=0;window.__identity='a';let opens=0;
   const draft={id:'d',sourceIds:['source'],problem:{id:'d',title:'원문 테스트',answer:'',desc:'',blocks:[{type:'statement',data:{text:'본문'}}]}};
   const j={id:'j',draftVersion:1,groups:[],pages:[],drafts:[draft],composition:{destinations:[],excluded:[],unassigned:['d'],settings:{preset:'books',count:1,size:20,request:''}}};
   const c={listJobs:async()=>{opens++;return opens===3?new Promise(r=>__releaseNew=()=>r([])):[{id:'j',name:'원문 작업',count:1,createdAt:0}];},readComposition:async()=>structuredClone(j),readSource:async()=>({blob:new Blob(['fixture']),state:'available'})};
   window.__testUI=PedagogyCompositionUI.create({session:()=>__identity,client:()=>c,sets:()=>[],math:()=>{},source:()=>new Promise(r=>__releaseSource=()=>r({kind:'image',url:'blob:fixture',total:1,close:()=>__closed++}))});await __testUI.open();
  });
  await p.getByLabel('같은 브라우저의 다른 PEDAGOGY 탭을 닫았어요').check();await p.getByRole('button',{name:'원문 작업 · 1문항',exact:true}).click();await settled(p);
  await p.getByRole('button',{name:'원문 1 열기',exact:true}).click();await p.waitForFunction(()=>typeof __releaseSource==='function');
  await p.evaluate(()=>{__identity='b';__testUI.sessionChanged();window.__newOpen=__testUI.open();});await p.waitForFunction(()=>typeof __releaseNew==='function');
  await p.evaluate(()=>__releaseSource());await p.waitForFunction(()=>__closed===1);assert.equal(await p.locator('.cmp-content').evaluate(x=>x.disabled),true,'old finally unlocked new owner');
  await p.evaluate(async()=>{__releaseNew();await __newOpen;});assert.equal(await p.locator('.cmp-content').evaluate(x=>x.disabled),false);
 });
 await check('layout-and-keyboard',async p=>{
  await start(p);for(const width of [375,768,1194]){await p.setViewportSize({width,height:900});
   const overflow=await p.locator('#compositionDialog').evaluate(d=>({scroll:d.scrollWidth,width:d.clientWidth}));assert.ok(overflow.scroll<=overflow.width+1,JSON.stringify({width,...overflow}));
   await p.screenshot({path:`${logDir}/composition-${width}.png`,fullPage:true});
  }
  await p.locator('#compositionDialog').getByLabel('문항 제목',{exact:true}).focus();await p.keyboard.type(' 수정');let handled=false;p.once('dialog',async d=>{handled=true;await d.dismiss();});await p.keyboard.press('Escape');assert.equal(handled,true);assert.equal(await p.locator('#compositionDialog').evaluate(x=>x.open),true);
 });
 for(const f of failures)console.error(JSON.stringify(f));assert.equal(names.length,11);
 if(red){assert.notEqual(process.env.COMPOSITION_UI_SKIP_MUTATION,'1');assert.ok(failures.some(f=>f.name===({count:'count-confirmation',dirty:'dirty-and-undo',source:'late-source-disposal',owner:'late-source-disposal',selection:'selected-bucket-consistency',points:'invalid-points'}[red])));console.log('RED UI '+red+' detected');}else assert.deepEqual(failures,[]);
}finally{await browser?.close();server.kill();}
