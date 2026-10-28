import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PUBLIC_INPUTS, buildPublic, verifyPublic } from './build-public.mjs';
import { validateConfiguration, PRODUCTION, IDENTITY, ORIGIN } from './backend-staging-config.mjs';
import { stagingRuntime } from './backend-staging-runtime.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const OUTPUT = 'dist/backend-staging-a0';
export const BANNER = '분리 staging A0 · 합성 텍스트 전용 · AI/이미지/계정 삭제 미지원 · 실제 자료 입력 금지';
const ENTRIES = ['index.html','document-editor.html','mock-exam-editor.html','legal.html'];
export const SCRIPT_GATE = 'window.PEDAGOGY_A0.assertContext();\n';
const MESSAGE = 'A0에서는 AI·이미지·계정 삭제를 지원하지 않습니다';
const stop = 'throw Error(' + JSON.stringify(MESSAGE) + ');';

function exact(source, before, after, label) {
  if (source.split(before).length !== 2) throw Error('A0 transform anchor mismatch: ' + label);
  return source.replace(before, after);
}
function uniqueRegex(source, re, after, label) {
  if ([...source.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags+'g'))].length !== 1)
    throw Error('A0 transform anchor mismatch: ' + label);
  return source.replace(re, after);
}
function section(source, start, end, replacement, label) {
  if (source.split(start).length !== 2 || source.split(end).length !== 2) throw Error('A0 section anchor mismatch: ' + label);
  const a=source.indexOf(start), b=source.indexOf(end,a+start.length);
  if (b<0) throw Error('A0 section order mismatch: ' + label);
  return source.slice(0,a)+replacement+source.slice(b);
}
export function renderConfiguration(config) {
  return '('+stagingRuntime.toString()+')('+JSON.stringify(validateConfiguration(config))+');\n';
}
function policy(source) {
  return uniqueRegex(source, /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([\s\S]*?)(")/i,
    (_all,open,value,close)=>open+value.split(';').map(v=>{
      const d=v.trim();
      if (d.startsWith('connect-src ')) return "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://content-firebaseappcheck.googleapis.com https://firebaseinstallations.googleapis.com https://recaptchaenterprise.googleapis.com";
      if (d.startsWith('frame-src ')) return "frame-src 'self' https://"+IDENTITY.authDomain+' https://accounts.google.com https://apis.google.com https://www.google.com';
      if (d.startsWith('font-src ')) return "font-src 'self' data: https://cdn.jsdelivr.net";
      if (d.startsWith('img-src ')) return "img-src 'self' data: blob: https://lh3.googleusercontent.com";
      return d;
    }).filter(Boolean).join('; ')+close, 'CSP');
}
function indexOverlay(source, config) {
  source=uniqueRegex(source,/const firebaseConfig = \{[\s\S]*?\n\};/,'const firebaseConfig = Object.freeze('+JSON.stringify(config.firebase)+');','index config');
  source=section(source,'function initFirebase(){','async function getAiAppCheckToken(){',`function initFirebase(){
  try{
    window.PEDAGOGY_A0.assertContext();
    firebase.initializeApp(firebaseConfig);
    firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(publicConfig.appCheckSiteKey),true);
    appCheckReady=true;
    fbAuth=firebase.auth(); fbDb=firebase.firestore(); fbStorage=null; fbReady=true;
  }catch{
    fbReady=false; appCheckReady=false; fbAuth=null; fbDb=null; fbStorage=null;
    document.getElementById('loginBtn').disabled=true;
  }
}

`, 'index initialization');
  source=exact(source,'function startApp(){\n','async function startApp(){\n  await window.PEDAGOGY_A0.ready;\n  try{window.PEDAGOGY_A0.assertContext();}catch{document.getElementById("loginBtn").disabled=true;return;}\n','index startup');
  source=exact(source,'const AI_PROXY_URL="https://dawn-shape-2664.dbruddl79.workers.dev";','const AI_PROXY_URL="";','index AI URL');
  for(const anchor of ['async function getAiAppCheckToken(){','async function uploadBlobToStorage(blob, filename){',
    'async function storeImageFile(file){','async function wipeStorageImages(uid){',
    'async function purgeAttemptLedgerBeforeAccountDelete(user){','async function deleteAccountEverything(){'])
    source=exact(source,anchor,anchor+'\n  '+stop,anchor);
  source=exact(source,'async function aiGenerateFromImage(file){','async function aiGenerateFromImage(file){\n  toast('+JSON.stringify(MESSAGE)+',"error");return;','index AI image');
  source=exact(source,'function releaseImage(url, {attached=true}={}){','function releaseImage(url, {attached=true}={}){\n  if(url){'+stop+'}return;','image release');
  source=exact(source,'function saveSets(changedSetId=currentSetId){','function saveSets(changedSetId=currentSetId){\n  window.PEDAGOGY_A0.textOnly(sets);','save guard');
  source=exact(source,'function setToDoc(s, order, {revision=null}={}){','function setToDoc(s, order, {revision=null}={}){\n  window.PEDAGOGY_A0.textOnly(s);','cloud serialization guard');
  source=exact(source,'  $("#dmDelBtn").disabled = !need || ($("#dmDelConfirm").value.trim() !== need);','  $("#dmDelBtn").disabled = true;','account UI');
  return source;
}
function documentOverlay(source, config) {
  source=uniqueRegex(source,/const firebaseConfig=\{[^\n]+\};/,'const firebaseConfig=Object.freeze('+JSON.stringify(config.firebase)+');','document config');
  source=exact(source,'const AI_PROXY_URL="https://dawn-shape-2664.dbruddl79.workers.dev";','const AI_PROXY_URL="";','document AI URL');
  source=exact(source,'function init(){','async function init(){\n  await window.PEDAGOGY_A0.ready;\n  try{window.PEDAGOGY_A0.assertContext();}catch{$("loginBtn").disabled=true;return;}','document startup');
  source=exact(source,'    firebase.initializeApp(firebaseConfig);auth=firebase.auth();',
    '    firebase.initializeApp(firebaseConfig);\n    firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(publicConfig.appCheckSiteKey),true);appCheckReady=true;\n    auth=firebase.auth();','document initialization');
  source=section(source,'  if(auth)try{','  const saved=readDraft();','', 'duplicate document App Check');
  source=exact(source,'window.addEventListener("DOMContentLoaded",init);','if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",init);else init();','document late init');
  source=exact(source,'async function makeDraft(){','async function makeDraft(){setStatus("aiStatus",'+JSON.stringify(MESSAGE)+',"error");return;','document AI');
  source=exact(source,'async function getAiAppCheckToken(){','async function getAiAppCheckToken(){'+stop,'document token guard');
  source=exact(source,'async function findHwpxServer(){','async function findHwpxServer(){hwpxBase=null;return false;','document local server');
  source=exact(source,'"AI 초안은 로그인 후 사용"','"분리 staging 로그인 대기"','document auth copy');
  return source;
}
function transform(file, bytes, config) {
  if(file==='service-config.js') return Buffer.from(renderConfiguration(config));
  if(!ENTRIES.includes(file)) return bytes;
  let source=bytes.toString('utf8');
  source=policy(source);
  source=uniqueRegex(source,/<body([^>]*)>/i,all=>all+'\n<div id="a0StagingBanner" role="status" style="padding:9px 14px;background:#4c2f8c;color:#fff;text-align:center">'+BANNER+'</div>','banner');
  if(!source.includes('<script src="service-config.js"></script>'))
    source=exact(source,'</head>','<script src="service-config.js"></script>\n</head>','configuration load');
  if(file==='index.html') source=indexOverlay(source,config);
  if(file==='document-editor.html') source=documentOverlay(source,config);
  if(file==='mock-exam-editor.html') {
    source=exact(source,'async function pingServer(){','async function pingServer(){LIVE.found=false;return false;','mock server guard');
    source=exact(source,"    markServerFeatures(false);\n  }\n}","    markServerFeatures(false);\n  }\n  window.PEDAGOGY_A0_MOCK_READY=true;\n}",'mock boot completion');
    source=exact(source,"if(window.katex)boot(); else window.addEventListener('load',boot);","if(window.katex||document.readyState==='complete')boot(); else window.addEventListener('load',boot);",'mock late boot');
    source=exact(source,'async function probe(base){','async function probe(base){return false;','mock probe guard');
  }
  return Buffer.from(source);
}
function deferApplicationScripts(html) {
  let serviceCount=0;
  const script=/<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  const result=html.replace(script,(tag,attrs)=>{
    if(attrs===undefined)return tag;
    if(!/\bsrc="[^"]+"/.test(attrs))throw Error('A0 public inline script');
    if(/\bsrc="service-config\.js"/.test(attrs)){serviceCount++;return tag;}
    if(/\btype\s*=/.test(attrs))throw Error('A0 script type requires explicit review');
    return tag.replace(/<script\b/i,'<script type="application/x-a0-script"');
  });
  if(serviceCount!==1)throw Error('A0 must have one synchronous configuration bootstrap');
  return result;
}
function ownScripts(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)]
    .map(m=>m[1]).filter(src=>src!=='service-config.js'&&!/^https:\/\//.test(src));
}
async function regular(root, relative, directory=false) {
  let path=root;
  for(const [i,part] of relative.split('/').entries()) {
    path=join(path,part); const info=await lstat(path);
    const last=i===relative.split('/').length-1;
    if(info.isSymbolicLink() || ((last&&!directory)?!info.isFile():!info.isDirectory())) throw Error('A0 path must be regular: '+relative);
  }
  return path;
}
async function distRoot(root) {
  const top=await lstat(root);
  if(!top.isDirectory()||top.isSymbolicLink())throw Error('A0 root must be a regular directory');
  const path=join(root,'dist');
  const info=await lstat(path).catch(e=>{if(e.code!=='ENOENT')throw e;});
  if(info&&(!info.isDirectory()||info.isSymbolicLink()))throw Error('A0 dist must be regular');
  await mkdir(path,{recursive:true});
  return path;
}
const REQUIRED = {
  'assets/index-3.js':['window.PEDAGOGY_A0.assertContext();','window.PEDAGOGY_A0.textOnly(s);','window.PEDAGOGY_A0.textOnly(sets);','fbStorage=null;','const AI_PROXY_URL="";',stop],
  'assets/document-editor-1.js':['window.PEDAGOGY_A0.assertContext();','const AI_PROXY_URL="";',stop],
  'assets/mock-exam-editor-1.js':['async function pingServer(){LIVE.found=false;return false;','async function probe(base){return false;'],
};
async function verifyAt(output) {
  const metaPath=await regular(output,'staging-manifest.json');
  await regular(output,'public',true);
  let meta;
  try{meta=JSON.parse(await readFile(metaPath,'utf8'));}catch{throw Error('A0 artifact metadata invalid JSON');}
  if(meta.kind!=='backend-staging-a0')throw Error('A0 artifact kind mismatch');
  const config=validateConfiguration(meta.configuration);
  const base=join(output,'public');
  if(!(await readFile(await regular(base,'service-config.js'))).equals(Buffer.from(renderConfiguration(config))))
    throw Error('A0 runtime/configuration mismatch');
  // Check semantic boundaries before the generic manifest, so REDs prove which
  // defense matters rather than merely detecting any changed byte.
  for(const file of ENTRIES) {
    const html=await readFile(await regular(base,file),'utf8');
    if(!html.includes(BANNER)||!html.includes('<script src="service-config.js"></script>'))throw Error('A0 banner/configuration missing: '+file);
    if(file==='index.html'||file==='document-editor.html') {
      if(!html.includes('https://'+IDENTITY.authDomain))throw Error('A0 staging auth frame missing');
      if(!html.includes('firebase-auth-compat.js')||!html.includes('firebase-app-check-compat.js'))throw Error('A0 SDK positive control missing');
    }
    for(const tag of html.matchAll(/<script\b([^>]*)>/gi)){
      if(!/\bsrc="service-config\.js"/.test(tag[1])&&!/type="application\/x-a0-script"/.test(tag[1]))throw Error('A0 eager application script');
    }
    for(const src of ownScripts(html)) {
      if(!(await readFile(await regular(base,src),'utf8')).startsWith(SCRIPT_GATE))throw Error('A0 late execution gate missing: '+src);
    }
    const csp=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"/i)?.[1]||'';
    if(['index.html','document-editor.html'].includes(file)&&!csp.includes('https://content-firebaseappcheck.googleapis.com'))throw Error('A0 App Check CSP origin missing');
    if(!csp || /(?:workers\.dev|firebasestorage\.googleapis|storage\.googleapis|127\.0\.0\.1|http:\/\/localhost)/.test(csp))throw Error('A0 forbidden CSP origin');
  }
  for(const [file,guards] of Object.entries(REQUIRED)) {
    const text=await readFile(await regular(base,file),'utf8');
    for(const g of guards)if(!text.includes(g))throw Error('A0 runtime guard missing: '+file);
    for(const value of [config.firebase.projectId,config.firebase.appId,config.firebase.apiKey])
      if(file!=='assets/mock-exam-editor-1.js'&&!text.includes(value))throw Error('A0 staging SDK identity missing');
  }
  const files=await verifyPublic(base);
  for(const file of Object.keys(files).filter(f=>/\.(html|js|mjs|css)$/.test(f))) {
    if(PRODUCTION.test(await readFile(await regular(base,file),'utf8')))throw Error('Production identifier in A0 artifact: '+file);
  }
  if(JSON.stringify(meta.files)!==JSON.stringify(files))throw Error('A0 manifest mismatch');
  return {configuration:config, files};
}
export async function verifyBackendStaging(root=ROOT) {
  root=resolve(root); const top=await lstat(root);
  if(!top.isDirectory()||top.isSymbolicLink())throw Error('A0 root must be a regular directory');
  await regular(root,OUTPUT,true);
  return verifyAt(join(root,OUTPUT));
}
export async function buildBackendStaging(root=ROOT, configuration) {
  root=resolve(root); const config=validateConfiguration(configuration);
  const dist=await distRoot(root);
  const output=join(root,OUTPUT);
  const old=await lstat(output).catch(e=>{if(e.code!=='ENOENT')throw e;});
  if(old&&(!old.isDirectory()||old.isSymbolicLink()))throw Error('A0 output must be regular');
  const original=new Map();
  for(const file of PUBLIC_INPUTS)original.set(file,await readFile(await regular(root,file)));
  const input=await mkdtemp(join(dist,'.a0-input-'));
  const publish=await mkdtemp(join(dist,'.a0-output-'));
  try {
    for(const [file,bytes] of original) {
      const target=join(input,file);await mkdir(dirname(target),{recursive:true});
      await writeFile(target,transform(file,bytes,config));
    }
    await buildPublic(input);
    await rename(join(input,'dist/public'),join(publish,'public'));
    const scripts=new Set();
    for(const file of ENTRIES){
      const path=join(publish,'public',file);
      const html=deferApplicationScripts(await readFile(path,'utf8'));
      for(const src of ownScripts(html))scripts.add(src);
      await writeFile(path,html);
    }
    // A native script request can finish after the loader times out. Each own
    // classic script must check admission at execution, preserving global scope.
    for(const src of scripts){const path=await regular(join(publish,'public'),src);await writeFile(path,SCRIPT_GATE+await readFile(path,'utf8'));}
    const files=await verifyPublic(join(publish,'public'));
    await writeFile(join(publish,'staging-manifest.json'),JSON.stringify({kind:'backend-staging-a0',configuration:config,files},null,2)+'\n');
    await verifyAt(publish);
    for(const [file,bytes] of original)
      if(!(await readFile(await regular(root,file))).equals(bytes))throw Error('A0 source input changed: '+file);
    const current=await lstat(output).catch(e=>{if(e.code!=='ENOENT')throw e;});
    if(current&&(!current.isDirectory()||current.isSymbolicLink()))throw Error('A0 output became unsafe');
    await rm(output,{recursive:true,force:true});await rename(publish,output);
    return await verifyBackendStaging(root);
  } finally {await rm(input,{recursive:true,force:true});await rm(publish,{recursive:true,force:true});}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    const at=process.argv.indexOf('--config');
    if(at<0||!process.argv[at+1])throw Error('Use --config with verified private temporary public-config.json');
    let config;
    try{config=JSON.parse(await readFile(process.argv[at+1],'utf8'));}catch{throw Error('Invalid A0 configuration JSON');}
    const result=process.argv.includes('--check')?await verifyBackendStaging():await buildBackendStaging(ROOT,config);
    const expected=validateConfiguration(config);
    if(result.configuration.appCheckSiteKey!==expected.appCheckSiteKey||Object.entries(expected.firebase).some(([key,value])=>result.configuration.firebase[key]!==value))throw Error('A0 verified input differs from stored configuration');
    console.log('A0 local artifact verified: '+Object.keys(result.files).length+' files; '+ORIGIN+' only.');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
