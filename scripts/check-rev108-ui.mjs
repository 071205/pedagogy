import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {chromium} from 'playwright';

const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=`http://127.0.0.1:${port}`,server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
let browser,phase='setup',redFailed=false;
const red=process.env.REV108_UI_RED||'';
const mutations={
  review:[['if(orphan||(!member&&q.groupReview)){','if(orphan){']],
  delete:[['removeGroupedProblem(arr,fi); if(!arr.length)','arr.splice(fi,1); if(!arr.length)']],
  undo:[['historyStep(()=>{\n          if(fi>0 && arr[fi-1].paired)','((run)=>run())(()=>{\n          if(fi>0 && arr[fi-1].paired)']],
  paste:[['newProbs.push(...normGroupProblems(s.problems.slice(0,500)));','newProbs.push(...s.problems.slice(0,500));'],
    ['const cloned=newProbs;','const cloned=normGroupProblems(newProbs);']],
  sheet:[['      $("#sheetStage").replaceChildren();','      // injected: previous sheet page retained']],
};
if(red&&!mutations[red]) throw Error('unknown UI RED mode');
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();
  const page=await browser.newPage();
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base)return route.abort();
    if(red&&!process.env.REV108_SKIP_MUTATION&&url.pathname==='/index.html'){
      let body=readFileSync('index.html','utf8');
      for(const [from,to] of mutations[red]){assert.ok(body.includes(from),red+' mutation target missing');body=body.replace(from,to);}
      const inline=body.match(/<script src="pedagogy-normalize.js"[\s\S]*?<script>([\s\S]*?)<\/script>/)?.[1];
      assert.ok(inline);
      const old=[...body.matchAll(/sha256-[A-Za-z0-9+/=]+/g)][2][0];
      body=body.replace(old,'sha256-'+createHash('sha256').update(inline).digest('base64'));
      return route.fulfill({contentType:'text/html',body});
    }
    return route.continue();
  });
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>typeof showEditor==='function');
  const start=await page.evaluate(()=>{
    const set=normSet({id:'rev-ui',name:'UI',subject:'korean',problems:[
      {id:'p1',paired:true,groupLead:'다음을 읽고 답하시오'},
      {id:'p2'},{id:'p3'},{id:'q4'}]},{keepId:true});
    PedagogyNormalize.setGroupSpan(set.problems,'p1',3);
    sets=[set];showEditor(set.id);
    clearTimeout(histTimer);undoStack=[];redoStack=[];lastSnapshot=snapshot();
    window.confirm=()=>true;
    return {span:set.problems[0].groupSpan,range:computeNums(set.problems)[0].range};
  });
  assert.deepEqual(start,{span:3,range:'01~03'});
  phase='review';
  const reviewed=await page.evaluate(()=>{
    const q=activeProblems()[0];q.groupReview='legacy';currentQId=q.id;renderEditor();
    const select=document.querySelector('#qGroupSpan'),before=select.value;
    select.value='3';select.dispatchEvent(new Event('change',{bubbles:true}));
    return {before,review:q.groupReview||'',range:computeNums(activeProblems())[0].range};
  });
  assert.deepEqual(reviewed,{before:'review',review:'',range:'01~03'});
  console.log('PASS reviewed representative confirms the same group size through the select UI');
  const click=(id,title)=>page.evaluate(({id,title})=>{
    const item=[...document.querySelectorAll('.q-item')].find(e=>e.querySelector('.q-open')?.dataset.qid===id);
    const button=[...item.querySelectorAll('button')].find(e=>e.title===title);
    if(!button)throw Error('button missing: '+id+' '+title);
    button.click();
  },{id,title});
  await click('p1','삭제');
  const blocked=await page.evaluate(()=>({length:activeProblems().length,paired:activeProblems()[0].paired}));
  assert.deepEqual(blocked,{length:4,paired:true},'representative delete must not mutate pair');
  phase='delete';
  await click('p2','삭제');
  const deleted=await page.evaluate(()=>{
    const arr=activeProblems(),wrap=document.createElement('div');buildPrintDoc(false,wrap);
    return {ids:arr.map(q=>q.id),span:arr[0].groupSpan,range:computeNums(arr)[0].range,
      outsider:arr[2].groupOf||'',preview:document.querySelector('#pvContent')?.textContent||'',
      printed:wrap.textContent};
  });
  assert.deepEqual(deleted.ids,['p1','p3','q4']);
  assert.equal(deleted.span,2);assert.equal(deleted.range,'01~02');assert.equal(deleted.outsider,'');
  assert.match(deleted.preview,/01~02/);assert.match(deleted.printed,/01~02/);
  assert.doesNotMatch(deleted.printed,/01~03/);
  console.log('PASS UI delete P2 → preview/print 01~02, Q4 independent; representative blocked without pair mutation');
  phase='undo';
  const history=await page.evaluate(()=>{
    doUndo();
    const undo={ids:activeProblems().map(q=>q.id),paired:activeProblems()[0].paired,
      groupOf:activeProblems()[1].groupOf,range:computeNums(activeProblems())[0].range};
    doRedo();
    const redo={ids:activeProblems().map(q=>q.id),groupOf:activeProblems()[1].groupOf,
      range:computeNums(activeProblems())[0].range};
    return {undo,redo};
  });
  assert.deepEqual(history.undo,{ids:['p1','p2','p3','q4'],paired:true,groupOf:'p1',range:'01~03'});
  assert.deepEqual(history.redo,{ids:['p1','p3','q4'],groupOf:'p1',range:'01~02'});
  console.log('PASS UI deletion Undo/Redo preserves pair and explicit membership');
  await page.evaluate(()=>{
    const set=normSet({id:'paste',name:'붙여넣기',problems:[{id:'z'}]},{keepId:true});
    sets=[set];showEditor('paste');currentQId='z';
  });
  const input=[
    {problems:[{id:'same',groupLead:'A 안내',groupOf:'same',groupSpan:2},{id:'a2',groupOf:'same'}]},
    {problems:[{id:'b1',groupOf:'same'}]}
  ];
  phase='paste';
  await page.locator('#loadInput').setInputFiles({name:'two-sets.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(input))});
  await page.waitForFunction(()=>activeProblems().length===4);
  const pasted=await page.evaluate(()=>{
    const arr=activeProblems();
    return {a:arr[1].id,a2:arr[2].groupOf,bReview:arr[3].groupReview,
      bGroup:arr[3].groupOf,issues:PedagogyNormalize.groupDiagnostics(arr).length};
  });
  assert.equal(pasted.a,pasted.a2,'within-set reference must remap');
  assert.equal(pasted.bReview,'invalid','cross-set reference must remain diagnostic');
  assert.ok(pasted.bGroup!==pasted.a&&pasted.issues>0);
  console.log('PASS FileReader paste keeps set boundaries and flags cross-set reference');
  await page.evaluate(()=>{
    const set=normSet({id:'sheet-rev',name:'지면',problems:[
      {id:'a',groupLead:'안내'},{id:'b'},{id:'c'}]},{keepId:true});
    PedagogyNormalize.setGroupSpan(set.problems,'a',2);
    sets=[set];showEditor('sheet-rev');setEditorMode('sheet');
  });
  await page.waitForFunction(()=>document.querySelector('#sheetState')?.dataset.s==='ok',{timeout:15000});
  phase='sheet';
  await page.evaluate(()=>{
    const arr=activeProblems();
    arr.splice(1,0,detachedProblem(arr[0]));
    saveSets();renderPreview();
  });
  await page.waitForFunction(()=>document.querySelector('#sheetState')?.dataset.s==='fail',{timeout:15000});
  const stale=await page.evaluate(()=>({pages:document.querySelectorAll('#sheetStage .page').length,
    thumbs:document.querySelectorAll('#sheetThumbs .sheet-thumb').length,
    state:document.querySelector('#sheetState').textContent}));
  assert.equal(stale.pages,0);assert.equal(stale.thumbs,0);assert.match(stale.state,/묶음/);
  console.log('PASS invalid sheet clears old page labels and thumbnails');
}catch(error){
  if(!red||phase!==red) throw error;
  redFailed=true;
  console.log('RED UI '+red+' target failed:',error.message.split('\n')[0]);
}finally{await browser?.close();server.kill();}
if(red) assert.ok(redFailed,red+' UI target stayed green');
