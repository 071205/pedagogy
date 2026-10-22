import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFileSync, mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['serve.py','--port',String(port)],{stdio:'ignore'});
const red=process.env.PRINT_UI_RED==='1';
const output=process.env.PRINT_UI_OUTPUT?process.env.PRINT_UI_OUTPUT+(red?'/red':''):'';
let browser,redFailed=false;
try{
  for(let i=0;i<80;i++){
    try{if((await fetch(base+'/health')).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch();
  const page=await browser.newPage();
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base)return route.abort(); // no account or paid-service traffic
    if(red&&!process.env.PRINT_UI_SKIP_MUTATION&&url.pathname==='/index.html'){
      const original=readFileSync('index.html','utf8');
      const from='.skip-link,.topbar,#libraryView';
      assert.equal(original.split(from).length,2,'print guard mutation anchor');
      return route.fulfill({contentType:'text/html',body:original.replace(from,'.topbar,#libraryView')});
    }
    return route.continue();
  });
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>typeof showEditor==='function'&&document.querySelector('#libraryView').style.display==='flex');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('skip-link')),true,'first Tab reaches skip link');
  await page.waitForFunction(()=>document.querySelector('.skip-link').getBoundingClientRect().top>=0);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'appMain','Enter focuses main');
  await page.evaluate(()=>{
    const set=normSet({id:'print-ui',name:'Print test',header:'PRINT-UI',problems:[1,2,3,4].map(i=>({id:'q'+i,span:'col',blocks:[{type:'statement',data:{text:'PRINT-PROBE-'+i}}]}))},{keepId:true});
    sets=[set];showEditor(set.id);buildPrintDoc(false);
  });
  await page.emulateMedia({media:'print'});
  const print=await page.evaluate(()=>({skipDisplay:getComputedStyle(document.querySelector('.skip-link')).display,pages:document.querySelectorAll('#printDoc .page').length,printDisplay:getComputedStyle(document.querySelector('#printDoc')).display}));
  if(output)mkdirSync(output,{recursive:true});
  const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true,...(output?{path:output+'/print-ui.pdf'}:{})});
  const extracted=await page.evaluate(async data=>{
    const pdfjs=await import('/vendor/pdfjs/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';
    const task=pdfjs.getDocument({data:new Uint8Array(data),isEvalSupported:false});
    const doc=await task.promise;
    const pages=[];
    try{for(let i=1;i<=doc.numPages;i++)pages.push((await(await doc.getPage(i)).getTextContent()).items.map(x=>x.str||'').join(''));}
    finally{await task.destroy();}
    return pages;
  },Array.from(pdf));
  assert.equal(print.pages,2,'fixture produces two app pages');
  assert.equal(extracted.length,2,'PDF has two pages');
  assert.match(extracted[0],/PRINT-PROBE-1/);
  assert.match(extracted[1],/PRINT-PROBE-4/);
  assert.equal(print.printDisplay,'block','paper stays visible');
  assert.equal(print.skipDisplay,'none','screen navigation excluded in print media');
  assert.ok(extracted.every(text=>!text.replace(/\s/g,'').includes('본문으로건너뛰기')),'PDF excludes skip-link text on every page');
  await page.emulateMedia({media:'screen'});
  assert.notEqual(await page.locator('.skip-link').evaluate(e=>getComputedStyle(e).display),'none','screen navigation restored');
  console.log('PASS print UI: first Tab/Enter, print-media hidden navigation, two PDF pages and body preserved, screen restored');
}catch(error){
  if(!red||error.code!=='ERR_ASSERTION'||!error.message.includes('screen navigation excluded in print media'))throw error;
  redFailed=true;console.log('RED reproduced: print guard removal exposes screen navigation');
}finally{await browser?.close();server.kill();}
if(red&&!redFailed)throw Error('RED target stayed green or mutation skipped');
