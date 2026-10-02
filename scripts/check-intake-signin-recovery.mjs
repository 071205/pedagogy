/* B6 · REV-2026-117 후속 — 로그인마다 도는 원문 삭제 울타리 복구가 **모든 사용자**에게 해를 끼치지 않는가.
 *   ① IndexedDB 가 없는 브라우저: 오류 안내 없이 지나간다(울타리가 있을 수 없다)
 *   ② 일괄 AI 를 한 번도 안 쓴 사용자: 로그인만으로 원문 저장소(PM_INTAKE_V1)를 만들지 않는다
 *   ③ 실제로 남은 울타리: 계정이 살아 있으면 비우고 복구 안내를 한다
 * B6_SIGNIN_RED=1 이면 이 수정 전 함수(첫 구현)로 바꿔 끼워 ①② 가 빨간불인지 본다.
 * 외부 요청은 전부 막는다(Firebase·AI 없음). */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:net';

const PRE_FIX=`let intakeFenceRecovery=null;
async function recoverIntakeOnSignIn(user,session){
  if(!user||wiping)return;
  if(intakeFenceRecovery)return intakeFenceRecovery;
  intakeFenceRecovery=withIntakeDeleteLock(user.uid,async()=>{
    const cleanup=PedagogyIntake.create({
      config:PedagogyIntakeContract.LIMIT_KEYS.reduce((o,k)=>(o[k]=1,o),{}),
      session:()=>({owner:intakeOwner(),epoch:authEpoch})
    });
    if(!await cleanup.purgeFence())return;
    await user.reload(); // Auth server confirmation; a stale local login is insufficient.
    if(!sessionMatches(session)||currentUser?.uid!==user.uid) return;
    await cleanup.recoverPurge();
    toast('계정 삭제가 끝나지 않아 원문 저장을 빈 상태로 복구했어요');
  });
  try{await intakeFenceRecovery;}
  catch(e){console.warn('원문 삭제 울타리 확인 보류',e);toast('원문 저장 복구를 확인하지 못했어요 · 다시 로그인해 주세요','error');}
  finally{intakeFenceRecovery=null;}
}

`;
const port=await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
const SOURCE=await readFile(new URL('../index.html',import.meta.url),'utf8');
function rehash(html){
  const TAG=/<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  const hashes=[...html.matchAll(TAG)].filter(m=>m[1]!==undefined&&!/\bsrc\s*=/.test(m[1]))
    .map(m=>`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
  let i=0;
  return html.replace(/(script-src[^;]*?)((?:'sha256-[^']+'\s*)+)/,(all,head,list)=>head+list.replace(/'sha256-[^']+'/g,()=>hashes[i++]));
}
function preFixHtml(){
  const a=SOURCE.indexOf('let intakeFenceRecovery=null;'), b=SOURCE.indexOf('const onAuth=async (user)=>{');
  if(a<0||b<a) throw new Error('수정 전 함수로 바꿔 끼울 자리를 못 찾았다(검사가 낡았다)');
  return rehash(SOURCE.slice(0,a)+PRE_FIX+SOURCE.slice(b));
}

let browser;
async function scenario(html,{noIdb=false,seedFence=false}={}){
  const ctx=await browser.newContext();
  await ctx.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.origin===base&&u.pathname==='/index.html'&&html) return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
    return u.origin===base?r.continue():r.abort();
  });
  if(noIdb) await ctx.addInitScript(()=>{ Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true}); });
  const p=await ctx.newPage(); await p.goto(base+'/index.html');
  await p.waitForFunction(()=>typeof recoverIntakeOnSignIn==='function'&&Array.isArray(sets),null,{timeout:15000});
  const r=await p.evaluate(async seedFence=>{
    window.__toasts=[]; window.toast=(m,k)=>window.__toasts.push((k||'info')+':'+m);
    currentUser={uid:'owner-signin'}; authEpoch++;
    const cfg=PedagogyIntakeContract.LIMIT_KEYS.reduce((o,k)=>(o[k]=1,o),{});
    if(seedFence){ const c=PedagogyIntake.create({config:cfg,session:()=>({owner:'owner-signin',epoch:authEpoch})}); await c.purge(); }
    let threw=null;
    try{ await recoverIntakeOnSignIn({uid:'owner-signin',reload:async()=>{}},sessionContext()); }catch(e){ threw=e.message; }
    const dbs=typeof indexedDB!=='undefined'&&indexedDB?.databases?(await indexedDB.databases()).map(d=>d.name):null;
    let fence=null;
    if(seedFence){ const c=PedagogyIntake.create({config:cfg,session:()=>({owner:'owner-signin',epoch:authEpoch})}); fence=await c.purgeFence(); }
    return {toasts:window.__toasts,dbs,fence,threw};
  },seedFence);
  await ctx.close();
  return r;
}
async function suite(html){
  const fails=[];
  const a=await scenario(html,{noIdb:true});
  if(a.toasts.length||a.threw) fails.push('① IndexedDB 없는 브라우저에 로그인 안내/예외: '+JSON.stringify(a));
  const b=await scenario(html);
  if(b.toasts.length||(b.dbs||[]).includes('PM_INTAKE_V1')) fails.push('② 안 쓴 사용자에게 저장소를 만들거나 안내했다: '+JSON.stringify(b));
  const c=await scenario(html,{seedFence:true});
  if(c.fence!==false||!c.toasts.some(t=>/빈 상태로 복구/.test(t))) fails.push('③ 남은 울타리를 복구하지 않았다: '+JSON.stringify(c));
  return fails;
}

let exit=0;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();
  if(process.env.B6_SIGNIN_RED==='1'){
    const f=await suite(preFixHtml());
    const hit=f.some(x=>x.startsWith('①'))&&f.some(x=>x.startsWith('②'));
    console.log(hit?'RED signin: 수정 전 함수에서 ①② 결함 재현':'MISS signin: 수정 전 함수가 통과했다(검사가 헛돈다) '+JSON.stringify(f));
    if(!hit) exit=1;
  }else{
    const f=await suite(null);
    f.forEach(x=>console.log('FAIL '+x));
    if(f.length) exit=1; else console.log('PASS signin recovery: IndexedDB 없음 무안내 · 미사용자 저장소 미생성 · 남은 울타리 복구');
  }
}catch(e){ console.error(e); exit=1; }
finally{ await browser?.close(); server.kill(); }
process.exit(exit);
