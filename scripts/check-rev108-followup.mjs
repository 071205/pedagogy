import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {chromium} from 'playwright';

const red=process.env.REV108_FOLLOWUP_RED||'';
const baseline=process.env.REV108_FOLLOWUP_BASELINE||'';
const reviewBaseline=process.env.REV108_FOLLOWUP_REVIEW_BASELINE||'';
const only=process.env.REV108_FOLLOWUP_ONLY||'';
const skip=process.env.REV108_FOLLOWUP_SKIP_MUTATION==='1';
const phases=['legacy','singleton','duplicate','paste','bulk','intake',
  'legacyDuplicate','legacyPaste','hiddenLead'];
assert.ok(!red||phases.includes(red));
assert.ok(!baseline||phases.includes(baseline));
assert.ok(!reviewBaseline||phases.includes(reviewBaseline));
assert.ok(!only||phases.includes(only));
assert.ok([red,baseline,reviewBaseline].filter(Boolean).length<=1);
const mutations={
  legacy:{file:'index.html',from:'const grouped=normGroupProblems(s.problems,{keepId:true,lossless:true});',to:'const grouped=s.problems;'},
  singleton:{file:'pedagogy-render.js',from:'if(!q?.groupOf||q.groupOf!==q.id||!lead.trim()) return "";',to:'if(!range||!q?.groupOf||q.groupOf!==q.id||!lead.trim()) return "";'},
  duplicate:{file:'index.html',from:'arr.splice(insertionIndexAfterGroup(arr,fi+1),0,cp);',to:'arr.splice(fi+1,0,cp);'},
  paste:{file:'index.html',from:'at = at<0 ? arr.length : insertionIndexAfterGroup(arr,at+1);',to:'at = at<0 ? arr.length : at+1;'},
  bulk:{file:'pedagogy-normalize.js',
    from:'const candidates=arr.filter(q=>q?.groupReview==="legacy"&&q.groupOf===q.id);\n  const withoutLegacy=arr.map(q=>q?.groupReview==="legacy"?{...q,groupReview:undefined}:q);\n  const {groups}=validGroups(withoutLegacy);',
    to:'const candidates=arr.filter(q=>["legacy","invalid"].includes(q?.groupReview)&&q.groupOf===q.id);\n  const groups=new Map(candidates.map(q=>[q.id,arr.flatMap((p,i)=>p?.groupOf===q.id?[i]:[])]));'},
  intake:{file:'index.html',from:'historyStep(()=>{if(setGroupSpan(arr,q.id,1))saveSets();});',to:'historyStep(()=>{saveSets();});'},
  legacyDuplicate:{file:'pedagogy-normalize.js',from:'  const indexes=validGroups(arr).groups.get(left.groupOf)\n    ||confirmableLegacyGroups(arr).find(g=>g.leaderId===left.groupOf)?.indexes;',
    to:'  const indexes=validGroups(arr).groups.get(left.groupOf);'},
  legacyPaste:{file:'pedagogy-normalize.js',from:'  const indexes=validGroups(arr).groups.get(left.groupOf)\n    ||confirmableLegacyGroups(arr).find(g=>g.leaderId===left.groupOf)?.indexes;',
    to:'  const indexes=validGroups(arr).groups.get(left.groupOf);'},
  hiddenLead:{file:'pedagogy-render.js',from:'if(!q?.groupOf||q.groupOf!==q.id||!lead.trim()) return "";',to:'if(!lead.trim()) return "";'},
};
const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
let browser;
function source(file){
  if(baseline||reviewBaseline)
    return execFileSync('git',['show',`${reviewBaseline?'c2dba2b':'1a0fc50'}:${file}`],{encoding:'utf8'});
  let body=readFileSync(file,'utf8');
  if(red&&!skip&&mutations[red].file===file){
    const {from,to}=mutations[red];
    assert.ok(body.includes(from),`${red}: mutation target missing`);
    body=body.replace(from,to);
    if(file==='index.html'){
      const inline=body.match(/<script src="pedagogy-normalize.js"[\s\S]*?<script>([\s\S]*?)<\/script>/)?.[1];
      assert.ok(inline,'inline script missing');
      const old=[...body.matchAll(/sha256-[A-Za-z0-9+/=]+/g)][2]?.[0];
      assert.ok(old,'CSP hash missing');
      body=body.replace(old,'sha256-'+createHash('sha256').update(inline).digest('base64'));
    }
  }
  return body;
}
async function pageFor(){
  const context=await browser.newContext();
  const page=await context.newPage();
  page.setDefaultTimeout(5000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base)return route.abort();
    const file=url.pathname.slice(1);
    if(((baseline||reviewBaseline)&&['index.html','pedagogy-normalize.js','pedagogy-render.js','pedagogy-print.js'].includes(file))
      ||(red&&!skip&&mutations[red].file===file))
      return route.fulfill({contentType:file.endsWith('.html')?'text/html':'application/javascript',body:source(file)});
    return route.continue();
  });
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>typeof showEditor==='function');
  assert.deepEqual(errors,[],'page startup errors');
  return {page,context};
}
async function clickProblem(page,id,title){
  await page.evaluate(({id,title})=>{
    const item=[...document.querySelectorAll('.q-item')].find(e=>e.querySelector('.q-open')?.dataset.qid===id);
    const button=[...item?.querySelectorAll('button')||[]].find(e=>e.title===title);
    if(!button)throw Error(`missing ${id} ${title}`);
    button.click();
  },{id,title});
}
async function setup(page,raw,id='followup'){
  await page.evaluate(({raw,id})=>{
    const s=normSet({id,name:'회귀 권',subject:'korean',problems:raw},{keepId:true});
    sets=[s];showEditor(id);currentQId=s.problems[0].id;renderEditor();renderPreview();
    clearTimeout(histTimer);undoStack=[];redoStack=[];lastSnapshot=snapshot();
    window.confirm=()=>true;
  },{raw,id});
}
async function checkLegacy(page){
  const result=await page.evaluate(()=>{
    const raw=[{id:'p1',groupSpan:3,blocks:[{type:'passage',data:{parts:[{text:'옛 지문 원문'}]}}]},
      {id:'p2',blocks:[{type:'statement',data:{text:'둘째 본문'}}]},
      {id:'p3',blocks:[{type:'statement',data:{text:'셋째 본문'}}]},
      {id:'q4',blocks:[{type:'statement',data:{text:'독립 본문'}}]}];
    const disk=JSON.stringify([{id:'legacy-set',name:'옛 권',future:'권 메타',problems:raw}]);
    localStorage.setItem(setsKey(),disk);
    const local=readLocalSets();
    const first={review:local[0].problems[0].groupReview,of:local[0].problems[0].groupOf,
      ids:local[0].problems.map(q=>q.id),body:local[0].problems[1].blocks[0].data.text,
      meta:local[0].future,disk:localStorage.getItem(setsKey()),base:intakeLocalBase.get(setsKey())};
    pendingLocalByOwner.set(setsKey(),disk);
    const pending=readLocalSets();pendingLocalByOwner.delete(setsKey());
    sets=local;showEditor('legacy-set');currentQId='p2';renderEditor();
    clearTimeout(histTimer);undoStack=[];redoStack=[];lastSnapshot=snapshot();window.confirm=()=>true;
    return {first,pendingReview:pending[0].problems[0].groupReview};
  });
  assert.equal(result.first.review,'legacy');assert.equal(result.first.of,'p1');
  assert.deepEqual(result.first.ids,['p1','p2','p3','q4']);
  assert.equal(result.first.body,'둘째 본문');assert.equal(result.first.meta,'권 메타');
  assert.equal(result.first.disk,result.first.base);assert.equal(result.pendingReview,'legacy');
  await clickProblem(page,'p2','삭제');
  const after=await page.evaluate(()=>{
    const arr=activeProblems();let blocked=false;
    try{buildPrintDoc(false,document.createElement('div'));}catch{blocked=true;}
    const raw=[{id:'x',groupSpan:3,groupLead:'옛 안내'},{id:'y'},{id:'z'},{id:'w'}];
    PedagogyNormalize.setGroupSpan(raw,'w',1);
    return {ids:arr.map(q=>q.id),review:arr[0].groupReview,span:arr[0].groupSpan,
      issues:groupDiagnostics(arr).length,blocked,rawSpan:raw[0].groupSpan,rawIssues:groupDiagnostics(raw).length};
  });
  assert.deepEqual(after.ids,['p1','p3','q4']);
  assert.equal(after.review,'legacy');assert.equal(after.span,2);
  assert.ok(after.issues>0&&after.blocked);
  assert.equal(after.rawSpan,3);assert.ok(after.rawIssues>0);
}
async function checkSingleton(page){
  await setup(page,[{id:'a',groupLead:'다음을 듣고 답하시오',blocks:[{type:'statement',data:{text:'첫 본문'}}]},
    {id:'b'},{id:'c'}],'single');
  await page.evaluate(()=>{setGroupSpan(activeProblems(),'a',2);renderEditor();renderPreview();});
  await clickProblem(page,'b','삭제');
  const after=await page.evaluate(()=>{
    const arr=activeProblems(),wrap=document.createElement('div');buildPrintDoc(false,wrap);
    currentQId='a';renderEditor();renderPreview();
    const before={span:arr[0].groupSpan,review:arr[0].groupReview||'',issues:groupDiagnostics(arr).length,
      preview:$('#pvContent').textContent,print:wrap.textContent,editable:$('#qGroupLead').style.display!=='none'};
    setGroupSpan(arr,'a',1);renderEditor();renderPreview();
    const next=document.createElement('div');buildPrintDoc(false,next);
    return {before,explicit:{preview:$('#pvContent').textContent,print:next.textContent,
      editable:$('#qGroupLead').style.display!=='none'}};
  });
  assert.equal(after.before.span,1);assert.equal(after.before.issues,0);
  assert.equal(after.before.editable,true);assert.match(after.before.preview,/다음을 듣고 답하시오/);
  assert.match(after.before.print,/다음을 듣고 답하시오/);
  assert.equal(after.explicit.editable,true);assert.doesNotMatch(after.explicit.preview,/다음을 듣고 답하시오/);
  assert.doesNotMatch(after.explicit.print,/다음을 듣고 답하시오/);
}
async function checkDuplicate(page){
  await setup(page,[{id:'p1',groupLead:'대표 안내'},{id:'p2'},{id:'p3'},{id:'q4'}],'dup');
  await page.evaluate(()=>{setGroupSpan(activeProblems(),'p1',3);renderQList();renderEditor();renderPreview();});
  await clickProblem(page,'p1','이 문항 복제');
  const after=await page.evaluate(()=>{
    const arr=activeProblems(),wrap=document.createElement('div');let blocked=false;
    try{buildPrintDoc(false,wrap);}catch{blocked=true;}
    return {ids:arr.map(q=>q.id),groups:arr.map(q=>q.groupOf||''),issues:groupDiagnostics(arr).length,
      blocked,printed:wrap.textContent};
  });
  assert.deepEqual(after.ids.slice(0,3),['p1','p2','p3']);
  assert.equal(after.ids[4],'q4');assert.notEqual(after.ids[3],'p1');
  assert.deepEqual(after.groups.slice(0,3),['p1','p1','p1']);
  assert.equal(after.groups[3],'');assert.equal(after.issues,0);assert.equal(after.blocked,false);
  assert.match(after.printed,/대표 안내/);
}
async function checkPaste(page){
  await setup(page,[{id:'p1',groupLead:'대표 안내'},{id:'p2'},{id:'p3'},{id:'q4'}],'paste-followup');
  await page.evaluate(()=>{setGroupSpan(activeProblems(),'p1',3);currentQId='p2';renderEditor();renderPreview();});
  const input={problems:[{id:'new',blocks:[{type:'statement',data:{text:'붙여넣은 본문'}}]}]};
  await page.locator('#loadInput').setInputFiles({name:'insert.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(input))});
  await page.waitForFunction(()=>activeProblems().length===5);
  const after=await page.evaluate(()=>{
    const arr=activeProblems(),wrap=document.createElement('div');let blocked=false;
    try{buildPrintDoc(false,wrap);}catch{blocked=true;}
    return {ids:arr.map(q=>q.id),groups:arr.map(q=>q.groupOf||''),issues:groupDiagnostics(arr).length,blocked,printed:wrap.textContent};
  });
  assert.deepEqual(after.ids.slice(0,3),['p1','p2','p3']);assert.equal(after.ids[4],'q4');
  assert.deepEqual(after.groups.slice(0,3),['p1','p1','p1']);
  assert.equal(after.groups[3],'');assert.equal(after.issues,0);assert.equal(after.blocked,false);
  assert.match(after.printed,/붙여넣은 본문/);
}
async function checkLegacyDuplicate(page){
  await setup(page,[{id:'p1',groupSpan:3,groupLead:'옛 대표 안내'},
    {id:'p2'},{id:'p3'},{id:'q4'}],'legacy-duplicate');
  assert.equal(await page.evaluate(()=>PedagogyNormalize.confirmableLegacyGroups(activeProblems()).length),1);
  await clickProblem(page,'p1','이 문항 복제');
  const after=await page.evaluate(()=>{
    const arr=activeProblems();
    return {ids:arr.map(q=>q.id),groups:arr.map(q=>q.groupOf||''),
      candidate:PedagogyNormalize.confirmableLegacyGroups(arr).length,
      reasons:groupDiagnostics(arr).map(x=>x.reason),bulk:$('#legacyBulkReview')?.textContent||''};
  });
  assert.deepEqual(after.ids.slice(0,3),['p1','p2','p3']);assert.equal(after.ids[4],'q4');
  assert.deepEqual(after.groups.slice(0,3),['p1','p1','p1']);assert.equal(after.groups[3],'');
  assert.equal(after.candidate,1);assert.match(after.bulk,/옛 묶음 1개/);
  assert.ok(after.reasons.includes('옛 묶음 소속 검토 필요'));
  assert.ok(!after.reasons.includes('묶음 구성원이 연속하지 않음'));
}
async function checkLegacyPaste(page){
  await setup(page,[{id:'p1',groupSpan:3,groupLead:'옛 대표 안내'},
    {id:'p2'},{id:'p3'},{id:'q4'}],'legacy-paste');
  await page.evaluate(()=>{currentQId='p2';renderEditor();renderPreview();});
  assert.equal(await page.evaluate(()=>PedagogyNormalize.confirmableLegacyGroups(activeProblems()).length),1);
  const input={problems:[{id:'new',blocks:[{type:'statement',data:{text:'붙여넣은 본문'}}]}]};
  await page.locator('#loadInput').setInputFiles({name:'legacy-insert.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(input))});
  await page.waitForFunction(()=>activeProblems().length===5);
  const after=await page.evaluate(()=>{
    const arr=activeProblems();
    return {ids:arr.map(q=>q.id),groups:arr.map(q=>q.groupOf||''),
      candidate:PedagogyNormalize.confirmableLegacyGroups(arr).length,
      reasons:groupDiagnostics(arr).map(x=>x.reason),bulk:$('#legacyBulkReview')?.textContent||''};
  });
  assert.deepEqual(after.ids.slice(0,3),['p1','p2','p3']);assert.equal(after.ids[4],'q4');
  assert.deepEqual(after.groups.slice(0,3),['p1','p1','p1']);assert.equal(after.groups[3],'');
  assert.equal(after.candidate,1);assert.match(after.bulk,/옛 묶음 1개/);
  assert.ok(after.reasons.includes('옛 묶음 소속 검토 필요'));
  assert.ok(!after.reasons.includes('묶음 구성원이 연속하지 않음'));
}
async function checkHiddenLead(page){
  await setup(page,[{id:'a',groupLead:'옛 숨은 안내',blocks:[{type:'statement',data:{text:'원래 본문'}}]}],
    'hidden-lead');
  const inactive=await page.evaluate(()=>{
    const wrap=document.createElement('div');buildPrintDoc(false,wrap);
    return {preview:$('#pvContent').textContent,print:wrap.textContent,
      editable:$('#qGroupLead').style.display!=='none',value:$('#qGroupLead').value,
      groupOf:activeProblems()[0].groupOf||''};
  });
  assert.equal(inactive.groupOf,'');assert.equal(inactive.editable,true);
  assert.equal(inactive.value,'옛 숨은 안내');
  assert.doesNotMatch(inactive.preview,/옛 숨은 안내/);
  assert.doesNotMatch(inactive.print,/옛 숨은 안내/);
  await setup(page,[{id:'a',groupLead:'활성 대표 안내'},{id:'b'}],'active-singleton');
  await page.evaluate(()=>{setGroupSpan(activeProblems(),'a',2);renderQList();renderEditor();renderPreview();});
  await clickProblem(page,'b','삭제');
  const active=await page.evaluate(()=>{
    currentQId='a';renderEditor();renderPreview();
    const wrap=document.createElement('div');buildPrintDoc(false,wrap);
    return {groupOf:activeProblems()[0].groupOf,preview:$('#pvContent').textContent,
      print:wrap.textContent,editable:$('#qGroupLead').style.display!=='none'};
  });
  assert.equal(active.groupOf,'a');assert.equal(active.editable,true);
  assert.match(active.preview,/활성 대표 안내/);assert.match(active.print,/활성 대표 안내/);
}
async function checkBulk(page){
  const raw=[];
  for(const [lead,member] of [['a1','a2'],['b1','b2'],['c1','c2']]){
    raw.push({id:lead,groupSpan:2,groupLead:`${lead} 안내 첫 줄\n다음 줄`},{id:member});
  }
  await setup(page,raw,'bulk-followup');
  const open=async()=>{
    const button=page.getByRole('button',{name:'옛 묶음 3개 확인하기'});
    assert.equal(await button.count(),1,'three legacy groups need a bulk review button');
    await button.click();
  };
  await open();
  assert.equal(await page.locator('#legacyReviewList .conflict-choice').count(),3);
  assert.match(await page.locator('#legacyReviewList').innerText(),/\[01~02\].*2문항/);
  const before=await page.evaluate(()=>JSON.stringify(activeSet().problems));
  await page.getByRole('button',{name:'빼기'}).first().click();
  await page.getByRole('button',{name:'취소',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.stringify(activeSet().problems)),before);
  await open();
  await page.getByRole('button',{name:'모두 이대로 확정'}).click();
  const done=await page.evaluate(()=>({issues:groupDiagnostics(activeProblems()).length,
    reviews:activeProblems().filter(q=>q.groupReview).length,spans:activeProblems().filter(q=>q.groupOf===q.id).map(q=>q.groupSpan)}));
  assert.deepEqual(done,{issues:0,reviews:0,spans:[2,2,2]});
  await page.evaluate(()=>doUndo());
  const undone=await page.evaluate(()=>({issues:groupDiagnostics(activeProblems()).length,
    reviews:activeProblems().filter(q=>q.groupReview==='legacy').length}));
  assert.equal(undone.reviews,3);assert.ok(undone.issues>=3);
  await setup(page,[{id:'a',groupSpan:2,groupLead:'정상 옛 안내'},{id:'b'},
    {id:'x',groupOf:'x',groupSpan:2,groupLead:'손상 안내',groupReview:'invalid'},
    {id:'y',groupOf:'x'},
    {id:'ai',groupOf:'ai',groupSpan:2,groupReview:'intake',groupLead:'AI 안내'},
    {id:'ai2',groupOf:'ai'}],'bulk-invalid');
  const count=await page.getByRole('button',{name:'옛 묶음 1개 확인하기'}).count();
  assert.equal(count,1,'invalid group must not enter bulk action');
  await page.getByRole('button',{name:'옛 묶음 1개 확인하기'}).click();
  const list=await page.locator('#legacyReviewList').innerText();
  assert.match(list,/정상 옛 안내/);assert.doesNotMatch(list,/손상 안내|AI 안내/);
  await page.getByRole('button',{name:'모두 이대로 확정'}).click();
  const invalid=await page.evaluate(()=>({review:activeProblems()[2].groupReview,
    ai:activeProblems()[4].groupReview,
    issues:groupDiagnostics(activeProblems()).some(x=>x.id==='x')}));
  assert.deepEqual(invalid,{review:'invalid',ai:'intake',issues:true});
}
async function checkIntake(page){
  await setup(page,[{id:'ai1',groupOf:'ai1',groupSpan:2,groupReview:'intake',
    blocks:[{type:'statement',data:{text:'지문과 첫 문항이 섞인 원문'}}]},
    {id:'ai2',groupOf:'ai1'}],'intake-followup');
  const initial=await page.evaluate(()=>({hint:$('#groupHint').textContent,
    button:!!$('#groupUnlinkBtn')&&!$('#groupUnlinkBtn').hidden,issues:groupDiagnostics(activeProblems()).length}));
  assert.match(initial.hint,/지문 부분을 '지문' 블록으로 옮긴 뒤/);
  assert.equal(initial.button,true);assert.ok(initial.issues>0);
  await page.locator('#metaHead').click();
  await page.getByRole('button',{name:'묶음 풀기'}).click();
  const done=await page.evaluate(()=>{
    const wrap=document.createElement('div');let blocked=false;
    try{buildPrintDoc(false,wrap);}catch{blocked=true;}
    return {issues:groupDiagnostics(activeProblems()).length,blocked,
      text:activeProblems()[0].blocks[0].data.text};
  });
  assert.equal(done.issues,0);assert.equal(done.blocked,false);
  assert.equal(done.text,'지문과 첫 문항이 섞인 원문');
  await page.evaluate(()=>doUndo());
  assert.equal(await page.evaluate(()=>activeProblems()[0].groupReview),'intake');
  await page.evaluate(()=>{setGroupSpan(activeProblems(),'ai1',2);renderEditor();renderPreview();});
  const afterSame=await page.evaluate(()=>({review:activeProblems()[0].groupReview||'',
    issues:groupDiagnostics(activeProblems()).some(x=>x.reason==='대표 지문·안내 없음'),
    hint:$('#groupHint').textContent,button:!$('#groupUnlinkBtn').hidden}));
  assert.equal(afterSame.review,'');assert.equal(afterSame.issues,true);
  assert.match(afterSame.hint,/묶음을 풀면\(1\)/);assert.equal(afterSame.button,true);
}

const checks={legacy:checkLegacy,singleton:checkSingleton,duplicate:checkDuplicate,
  paste:checkPaste,bulk:checkBulk,intake:checkIntake,
  legacyDuplicate:checkLegacyDuplicate,legacyPaste:checkLegacyPaste,hiddenLead:checkHiddenLead};
let failed=false;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();
  for(const phase of phases){
    if((red&&red!==phase)||(baseline&&baseline!==phase)
      ||(reviewBaseline&&reviewBaseline!==phase)||(only&&only!==phase))continue;
    const {page,context}=await pageFor();
    try{
      await checks[phase](page);
      console.log('PASS',phase);
    }catch(error){
      if(!red&&!baseline&&!reviewBaseline)throw error;
      failed=true;
      console.log(baseline?'BASELINE RED':reviewBaseline?'REVIEW BASELINE RED':'RED',
        phase,error.message.split('\n').slice(0,3).join(' | '));
    }finally{await context.close();}
  }
  if(red||baseline||reviewBaseline)
    assert.equal(failed,true,`${red||baseline||reviewBaseline}: target stayed green`);
}finally{await browser?.close();server.kill();}
