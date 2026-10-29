const {chromium}=require('/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b/node_modules/playwright');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const out='/Users/huryul/.codex/visualizations/2026/10/27/01a17c3f-65f5-74c0-879a-8245f9a0f683/prelaunch-journey';await fs.mkdir(out+'/output/pdf',{recursive:true});
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'pedagogy-pre2-chrome-'));
 const ctx=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:false,viewport:{width:1440,height:1000},acceptDownloads:true,args:['--no-first-run']});
 const base='http://127.0.0.1:8896';let requestsBlocked=0;await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base||u.hostname==='cdn.jsdelivr.net')return r.continue();requestsBlocked++;return r.abort();});
 const page=ctx.pages()[0];page.setDefaultTimeout(15000);
 try{
 await page.goto(base+'/index.html');await page.waitForLoadState('networkidle');await page.waitForFunction(()=>typeof normSet==='function');
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=200;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,300,200);g.strokeStyle='black';g.lineWidth=3;g.strokeRect(50,40,180,120);g.fillStyle='black';g.font='20px serif';g.fillText('6',130,185);g.fillText('4',25,110);return c.toDataURL();});
 const P=(n,text,extra=[])=>({id:'journey-q'+n,title:'합성 문항 '+n,span:'col',answer:['5','9','24','210'][n-1],blocks:[{type:'statement',data:{text}},...extra]});
 const fixture={id:'journey-seed',name:'출시 전 실제 출력 검증',header:'PEDAGOGY · 합성 자료',subject:'math',problems:[P(1,'이차방정식 $x^2-5x+6=0$의 두 근의 합을 구하시오.',[{type:'choices',data:{items:['$3$','$4$','$5$','$6$','$7$'],layout:'horizontal'}}]),P(2,'함수 $f(x)=2x+1$에서 $f(4)$를 구하시오.',[{type:'table',data:{rows:[['$x$','$1$','$2$','$3$'],['$f(x)$','$3$','$5$','$7$']],header:true}}]),P(3,'가로가 $6$, 세로가 $4$인 직사각형의 넓이를 구하시오.',[{type:'image',data:{dataUrl:image,size:'m'}}]),P(4,'다음 등식을 이용하여 $1+2+\\cdots+20$을 구하시오.\n$$\\sum_{k=1}^{n}k=\\frac{n(n+1)}{2}$$')]};
 await fs.writeFile(out+'/fixture.json',JSON.stringify(fixture));await page.locator('#importAllInput').setInputFiles(out+'/fixture.json');await page.getByText(fixture.name,{exact:true}).waitFor();await page.locator('.set-card').filter({hasText:fixture.name}).click();
 await page.locator('textarea[placeholder="본문 (LaTeX)"]').first().fill('출시 전 수정 확인: 이차방정식 $x^2-5x+6=0$의 두 근의 합을 구하시오.');await page.locator('#saveBtn').click();
 const before=await page.evaluate(()=>JSON.parse(JSON.stringify(activeSet())));assert.match(before.problems[0].blocks[0].data.text,/출시 전 수정 확인/);
 await page.reload();await page.waitForLoadState('networkidle');await page.waitForFunction(()=>typeof activeSet==='function' && activeSet()?.name==='출시 전 실제 출력 검증');
 const after=await page.evaluate(()=>JSON.parse(JSON.stringify(activeSet())));assert.deepEqual(after,before,'local save/reload set unchanged');
 const download=page.waitForEvent('download');await page.locator('#exportJsonBtn').click();const d=await download;await d.saveAs(out+'/roundtrip.json');const rawExport=JSON.parse(await fs.readFile(out+'/roundtrip.json','utf8'));const exported=Array.isArray(rawExport)?rawExport[0]:rawExport;assert.deepEqual(exported,before,'exported set preserves all fields');assert.equal(exported.problems.length,4);assert.match(exported.problems[0].blocks[0].data.text,/출시 전 수정確認|출시 전 수정 확인/);
 await page.getByRole('button',{name:'지면 배치',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#sheetState').dataset.s==='ok'&&!sheetBusy,null,{timeout:45000});
 const preview=await page.evaluate(()=>({pages:document.querySelectorAll('#sheetStage .page').length,questions:activeSet().problems.length,fontProblems:sheetFontProblems()}));
 await page.screenshot({path:out+'/preview.png'});
 await fs.writeFile(out+'/journey.json',JSON.stringify({scope:'synthetic local isolated Chrome profile; backend blocked',beforeId:before.id,reloadedIdentical:true,exportedProblems:exported.problems.length,preview,requestsBlocked},null,2));
 await page.locator('#printBtn').click();await page.locator('#exportWithAns').click();console.log('READY_NATIVE_PRINT '+out);
 const deadline=Date.now()+900000;while(Date.now()<deadline){const files=await fs.readdir(out+'/output/pdf');if(files.some(f=>f.endsWith('.pdf'))){console.log('NATIVE_PDF_SAVED '+files.join(','));await new Promise(r=>setTimeout(r,2000));return;}await new Promise(r=>setTimeout(r,1000));}throw Error('Native print save timeout');
 }finally{await ctx.unrouteAll({behavior:'wait'});await ctx.close();await fs.rm(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
