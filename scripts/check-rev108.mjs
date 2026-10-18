import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {createServer} from 'node:net';
import {chromium} from 'playwright';

const red=process.env.REV108_RED||'';
if(red==='baseline'){
  const context={};vm.createContext(context);
  for(const file of ['pedagogy-normalize.js','pedagogy-print.js'])
    vm.runInContext(execFileSync('git',['show',`877a8e7:${file}`],{encoding:'utf8'}),context);
  const arr=[
    {id:'p1',groupSpan:3,blocks:[{type:'passage',data:{parts:[{text:'지문'}]}}]},
    {id:'p2'},{id:'p3'},{id:'q4'}];
  arr.splice(1,1);
  const actual=context.PedagogyPrint.computeNums(arr)[0].range;
  assert.equal(actual,'01~03','baseline must reproduce outsider absorption');
  assert.notEqual(actual,'01~02','baseline unexpectedly passed the fixed expectation');
  console.log('RED baseline 877a8e7: expected 01~02, actual',actual);
  process.exit(0);
}
const port=await new Promise(resolve=>{
  const server=createServer();
  server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});
});
const base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
let browser;
const changes={
  delete:{file:'pedagogy-normalize.js',from:'  arr.splice(index,1);\n  syncGroupSpans(arr);',to:'  arr.splice(index,1);'},
  remap:{file:'pedagogy-normalize.js',from:'if(idMap.has(old.groupOf)) q.groupOf=idMap.get(old.groupOf);',to:'if(idMap.has(old.groupOf)) q.groupOf=old.groupOf;'},
  range:{file:'pedagogy-print.js',from:'  const {groups}=validGroups(arr);',to:'  const groups=new Map(arr[0]?.groupSpan>1?[[arr[0].id,Array.from({length:Math.min(arr[0].groupSpan,arr.length)},(_,i)=>i)]]:[]);'},
  print:{file:'index.html',from:'  if(groupDiagnostics(s.problems).length){ wrap.replaceChildren(); throw Error(groupIssueText(s.problems)); }',to:'  // injected: output builder guard omitted'},
};
if(red&&!changes[red]) throw Error('unknown RED mode');
function altered(file){
  let body=readFileSync(file,'utf8');
  if(!red||changes[red].file!==file) return body;
  const {from,to}=changes[red];
  assert.ok(body.includes(from),`${red}: mutation target missing`);
  body=body.replace(from,to);
  if(file==='index.html'){
    const old=body.match(/<script src="pedagogy-normalize.js"[\s\S]*?<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(old,'inline source missing');
    const hashes=[...body.matchAll(/sha256-[A-Za-z0-9+/=]+/g)];
    const oldHash=hashes[2]?.[0];
    const newHash='sha256-'+createHash('sha256').update(old).digest('base64');
    body=body.replace(oldHash,newHash);
  }
  return body;
}
const checks=[];
function test(name,fn){
  try{fn();checks.push({name,pass:true});}
  catch(error){checks.push({name,pass:false,error:error.message});}
}
try{
  for(let i=0;i<80;i++){
    try{if((await fetch(base+'/health')).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch();
  const page=await browser.newPage();
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base)return route.abort();
    const file=url.pathname.slice(1);
    if(red&&changes[red].file===file)
      return route.fulfill({contentType:file.endsWith('.html')?'text/html':'application/javascript',body:altered(file)});
    return route.continue();
  });
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>typeof normSet==='function',{timeout:15000});
  const actual=await page.evaluate(()=>{
    const N=PedagogyNormalize;
    const base=N.normSet({id:'rev108',problems:[
      {id:'p1',groupSpan:3,blocks:[{type:'passage',data:{parts:[{text:'지문'}]}}]},
      {id:'p2'},{id:'p3'},{id:'q4'}]},{keepId:true});
    const held=!computeNums(base.problems)[0].range&&base.problems[0].groupReview==='legacy';
    N.setGroupSpan(base.problems,'p1',3);
    const removed=N.removeGroupedProblem(base.problems,1);
    const deletion={removed:removed?.id,span:base.problems[0].groupSpan,
      range:computeNums(base.problems)[0].range,outsider:base.problems[2].groupOf||''};
    const copy=N.normSet(base);
    const remap={leaderChanged:copy.problems[0].id!==base.problems[0].id,
      memberOf:copy.problems[1].groupOf,leaderId:copy.problems[0].id};
    const old=N.normSet({id:'old',problems:[
      {id:'a',groupSpan:3,groupLead:'안내'},{id:'b'},{id:'c'}]},{keepId:true});
    const legacyRange=computeNums(old.problems)[0].range||'';
    const beforeSets=sets,beforeId=currentSetId;
    let printBlocked=false;
    try{sets=[old];currentSetId=old.id;buildPrintDoc(false);}
    catch{printBlocked=true;}
    finally{sets=beforeSets;currentSetId=beforeId;}
    return {held,deletion,remap,legacyRange,printBlocked};
  });
  test('old relation held',()=>{assert.equal(actual.held,true);assert.equal(actual.legacyRange,'');});
  test('member deletion updates group and excludes outsider',()=>{
    assert.deepEqual(actual.deletion,{removed:'p2',span:2,range:'01~02',outsider:''});
  });
  test('new set IDs remap internal references',()=>{
    assert.equal(actual.remap.leaderChanged,true);
    assert.equal(actual.remap.memberOf,actual.remap.leaderId);
  });
  test('invalid output builder blocks print',()=>assert.equal(actual.printBlocked,true));
  assert.deepEqual(errors,[],'page errors');
  const failed=checks.filter(x=>!x.pass);
  for(const item of checks) console.log(item.pass?'PASS':'FAIL',item.name,item.error||'');
  if(red){
    const target={delete:'member deletion updates group and excludes outsider',
      remap:'new set IDs remap internal references',range:'old relation held',
      print:'invalid output builder blocks print'}[red];
    assert.ok(failed.some(x=>x.name===target),`${red}: target regression stayed green`);
    console.log('RED',red,'target failed as expected');
  }else assert.deepEqual(failed,[],'REV-108 normal checks');
}finally{
  await browser?.close();
  server.kill();
}
