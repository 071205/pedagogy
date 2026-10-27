import assert from 'node:assert/strict';
import { readFile, writeFile, rename, symlink, rm, mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PUBLIC_INPUTS, PUBLIC_FILES } from './build-public.mjs';
import { buildBackendStaging, verifyBackendStaging, ROOT, OUTPUT } from './build-backend-staging.mjs';
import { readConfiguration, validateConfiguration, IDENTITY, ORIGIN } from './backend-staging-config.mjs';

const fixture={kind:'backend-staging-a0',origin:ORIGIN,
  firebase:{apiKey:'AIza'+'x'.repeat(35),projectId:IDENTITY.projectId,appId:IDENTITY.appId,
    authDomain:IDENTITY.authDomain,storageBucket:IDENTITY.storageBucket,messagingSenderId:IDENTITY.projectNumber},
  appCheckSiteKey:'6L'+'x'.repeat(38)};
// The fixture has public identifier shape only. It cannot authenticate to Firebase.
const clone=()=>structuredClone(fixture);
validateConfiguration(fixture);
for(const mutate of [c=>c.firebase.projectId='pedagogy-huryul',c=>c.origin='http://127.0.0.1:8796',
  c=>c.firebase.messagingSenderId='1',c=>c.appCheckSiteKey='',c=>c.firebase.refresh_token='forbidden',
  c=>c.guestPreview=true,c=>c.firebase.apiKey='not-a-browser-key']) {
  const c=clone();mutate(c);assert.throws(()=>validateConfiguration(c));
}
let paths=[];
const fakeGet=async(url,options)=>{
  assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,'Bearer fixture-only');paths.push(new URL(url).pathname);
  const path=new URL(url).pathname;
  const body=path.endsWith('/billingInfo')?{billingEnabled:false}:path.endsWith('/config')?fixture.firebase:
    path.endsWith('/recaptchaEnterpriseConfig')?{siteKey:fixture.appCheckSiteKey}:
    path.includes('/keys/')?{webSettings:{integrationType:'SCORE',allowedDomains:['localhost'],allowAllDomains:false}}:
    {projectId:IDENTITY.projectId,projectNumber:IDENTITY.projectNumber};
  return new Response(JSON.stringify(body),{status:200});
};
assert.deepEqual(await readConfiguration('fixture-only',fakeGet),fixture);
assert.equal(paths.length,5);
await assert.rejects(readConfiguration('fixture-only',async(url,options)=>url.endsWith('/billingInfo')?new Response('{"billingEnabled":true}'):fakeGet(url,options)),/unlinked billing/);
await assert.rejects(readConfiguration('fixture-only',async()=>new Response('{"error":{"message":"never echo"}}',{status:403})),/project identity HTTP 403/);
const protectedPaths=['dist/public','dist/guest-preview/dist/public'].flatMap(prefix=>PUBLIC_FILES.map(f=>prefix+'/'+f));
const before=new Map();
for(const p of [...PUBLIC_INPUTS,...protectedPaths]) {
  try{before.set(p,await readFile(join(ROOT,p)));}catch(e){if(e.code!=='ENOENT')throw e;}
}
const first=await buildBackendStaging(ROOT,fixture);
assert.deepEqual(await verifyBackendStaging(ROOT),first);
for(const [p,b] of before)assert((await readFile(join(ROOT,p))).equals(b),'A0 must preserve source/other output: '+p);
const publicRoot=join(ROOT,OUTPUT,'public');
async function red(file,mutate,expected) {
  const path=join(publicRoot,file),old=await readFile(path);
  try{const changed=mutate(old.toString('utf8'));assert.notEqual(changed,old.toString('utf8'),'RED anchor exists');await writeFile(path,changed);await assert.rejects(verifyBackendStaging(ROOT),expected);}
  finally{await writeFile(path,old);}
}
await red('index.html',s=>s.replace('type="application/x-a0-script"',''),/eager application script/);
await red('index.html',s=>s.replace('분리 staging A0','unmarked'),/banner\/configuration/);
await red('index.html',s=>s.replace(IDENTITY.authDomain,'absent.invalid'),/auth frame missing/);
await red('index.html',s=>s.replace('firebase-auth-compat.js','absent.js'),/SDK positive/);
await red('service-config.js',s=>s.replace('stagingBackendPreview:true','stagingBackendPreview:false'),/runtime\/configuration/);
await red('assets/index-3.js',s=>s.replace('window.PEDAGOGY_A0.textOnly(s);',''),/runtime guard missing/);
await red('assets/index-3.js',s=>s+'\n// pedagogy-huryul\n',/Production identifier/);
await red('assets/index-3.js',s=>s.replace('const AI_PROXY_URL="";','const AI_PROXY_URL="https://other.workers.dev";'),/runtime guard missing/);
await red('assets/mock-exam-editor-1.js',s=>s.replace('async function probe(base){return false;','async function probe(base){'),/runtime guard missing/);
await red('legal.html',s=>s.replace('분리 staging A0','unmarked'),/banner\/configuration/);
await writeFile(join(publicRoot,'private.txt'),'not public');
try{await assert.rejects(verifyBackendStaging(ROOT),/allowlist mismatch/);}finally{await rm(join(publicRoot,'private.txt'));}
const metadata=join(ROOT,OUTPUT,'staging-manifest.json'),held=metadata+'.held';
await rename(metadata,held);
try{await symlink(held,metadata);await assert.rejects(verifyBackendStaging(ROOT),/path must be regular/);}
finally{await rm(metadata);await rename(held,metadata);}
// Anchor drift rejects before old A0 output is removed. Work on a dedicated copy.
const copy=await mkdtemp(join(tmpdir(),'pedagogy-a0-input-test-'));
try{
  for(const f of PUBLIC_INPUTS){await mkdir(join(copy,f,'..'),{recursive:true});await writeFile(join(copy,f),await readFile(join(ROOT,f)));}
  await buildBackendStaging(copy,fixture);
  const old=await readFile(join(copy,OUTPUT,'public/index.html'));
  const source=await readFile(join(copy,'index.html'),'utf8');
  await writeFile(join(copy,'index.html'),source.replace('function initFirebase(){','function renamedInitFirebase(){'));
  await assert.rejects(buildBackendStaging(copy,fixture),/section anchor mismatch/);
  assert.deepEqual(await readFile(join(copy,OUTPUT,'public/index.html')),old);
}finally{await rm(copy,{recursive:true,force:true});}
console.log('A0 config/read-only preflight: normal + 9 invalid-state cases; artifact: 12 RED boundaries, source/public/guest preservation and failed-build retention passed.');
