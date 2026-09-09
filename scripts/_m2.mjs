import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
const base='http://127.0.0.1:18889';
const server=spawn('python3',['serve.py','--port','18889'],{stdio:'ignore'});
const out='/private/tmp/claude-501/-Users-huryul-pedagogy-main/2da85c98-cb80-4c91-b4db-f65777ab6da7/scratchpad/';
let b;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  b=await chromium.launch();
  for(const [w,h,name,shot] of [[1512,760,'맥북13 크롬',1],[1194,834,'아이패드 가로',0],[390,760,'휴대폰',1]]){
    const p=await b.newPage({viewport:{width:w,height:h},locale:'ko-KR'});
    const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
    await p.goto(base+'/index.html');
    await p.waitForFunction(()=>typeof renderLibrary==='function');
    await p.waitForTimeout(800);
    await p.evaluate(()=>{currentUser=null;
      sets=Array.from({length:14},(_,i)=>normSet({id:'s'+i,name:'문제집 '+(i+1),problems:[{}]},{keepId:true}));
      libMeta=normLibMeta({folders:[{id:'f',name:'수학',order:0},{id:'g',name:'영어',order:1}],folderBySetId:{s0:'f'}});
      renderLibrary();});
    await p.waitForTimeout(250);
    const m=await p.evaluate(()=>{
      const g=document.querySelector('.lib-grid').getBoundingClientRect();
      const f=document.querySelector('.lib-footer').getBoundingClientRect();
      const card=document.querySelector('.set-card');
      return {gridTop:Math.round(g.top), footerH:Math.round(f.height), vh:innerHeight,
              cardH:card?Math.round(card.getBoundingClientRect().height):0,
              cols:getComputedStyle(document.querySelector('.lib-grid')).gridTemplateColumns.split(' ').length,
              over:document.documentElement.scrollWidth-innerWidth,
              railW:Math.round(document.querySelector('.lib-rail').getBoundingClientRect().width),
              wide:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1)
                    .slice(0,4).map(e=>(e.id||e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().right))};
    });
    const avail=m.vh-m.gridTop-m.footerH;
    console.log(`${name} ${w}x${h}: 카드시작 y=${m.gridTop} (${Math.round(m.gridTop/m.vh*100)}%) · 푸터 ${m.footerH} · ${m.cols}열 · 보이는행 ${(avail/(m.cardH+16)).toFixed(1)} · 가로넘침 ${m.over} · 레일폭 ${m.railW}`);
    if(errs.length) console.log('  ERRORS', errs);
    if(m.over>0) console.log('  넘치는 것:', m.wide);
    if(shot) await p.screenshot({path:out+(w<500?'rail-m.png':'rail-d.png'),fullPage:false});
    await p.close();
  }
}finally{await b?.close();server.kill();}
