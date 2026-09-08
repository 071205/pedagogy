import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const {createWorker, DailyQuota}=await import(pathToFileURL(path.resolve('worker/index.js')));

class Storage {
  data = new Map(); alarm = null;
  async get(k){return structuredClone(this.data.get(k));}
  async put(k,v){this.data.set(k,structuredClone(v));}
  async getAlarm(){return this.alarm;}
  async setAlarm(v){this.alarm=v;}
  async deleteAll(){this.data.clear();}
  async transaction(fn){return fn(this);}
}
const buckets=new Map(); let aiCalls=0;
const env={ALLOWED_ORIGINS:'https://app.example',DAILY_LIMIT:'1',ANTHROPIC_KEY:'fixture',
  QUOTA:{idFromName:n=>n,get(n){if(!buckets.has(n))buckets.set(n,new DailyQuota({storage:new Storage()}));
    return {fetch:(u,o)=>buckets.get(n).fetch(new Request(u,o))};}}};
const worker=createWorker({verifyToken:async()=>({uid:'audit-user',claims:{}}),
  generateProblems:async()=>{aiCalls++;return [];}});
function req(method,extra={}){return new Request('https://worker.example/ai',{method,
  headers:{Origin:'https://app.example',Authorization:'Bearer fixture','Content-Type':'application/json'},
  ...(method==='POST'?{body:JSON.stringify({imageBase64:'YQ==',mimeType:'image/png',...extra})}:{})});}
const statuses=[];
for(const method of ['POST','POST','DELETE','POST']) statuses.push((await worker.fetch(req(method),env)).status);
assert.deepEqual(statuses,[200,429,204,200]);
console.log('QUOTA_RESET', {statuses,aiCalls});
await worker.fetch(req('DELETE'),env);
const oversized=req('POST',{unused:'a'.repeat(8*1024*1024+1)});
console.log('BODY_LIMIT',{contentLength:oversized.headers.get('content-length'),bytes:(await oversized.clone().text()).length,status:(await worker.fetch(oversized,env)).status});

const src=fs.readFileSync('index.html','utf8');
function fn(name){let start=src.indexOf('function '+name+'(');if(src.slice(start-6,start)==='async ')start-=6;
  return src.slice(start,src.indexOf('\n}',start)+2);}
function context(code){const c=vm.createContext({console,setTimeout:()=>0,clearTimeout:()=>{}});vm.runInContext(code,c);return c;}
const sync=context(`
let sets=[{id:'s',name:'v1'}],currentUser={uid:'A'},cloudSynced=new Map(),wiping=false;
let sent=[],release;const gate=new Promise(r=>release=r);
const flushLocal=()=>true,setSaveStatus=()=>{},toast=()=>{};
const cloudSyncEntry=s=>({json:JSON.stringify(s)});
const isCloudSynced=s=>cloudSynced.get(s.id)?.json===JSON.stringify(s);
const setToDoc=s=>structured(s);const structured=o=>JSON.parse(JSON.stringify(o));
const SETS_COL=()=>({doc:id=>id});const fbDb={batch:()=>({set:(id,d)=>sent.push(d),commit:()=>gate})};
`);
vm.runInContext(fn('flushToCloud'),sync);
const pending=vm.runInContext("flushToCloud('A')",sync);
vm.runInContext("sets[0].name='v2';release()",sync);await pending;
const ack=vm.runInContext("({sent:sent[0].name,current:sets[0].name,markedSynced:isCloudSynced(sets[0])})",sync);
assert.equal(ack.markedSynced,true);assert.notEqual(ack.sent,ack.current);console.log('FALSE_SYNC_ACK',ack);

const load=context(`
let currentUser={uid:'A'},sets=[],cloudSynced,localStamps={},writes=[],release;
const gate=new Promise(r=>release=r);
const SETS_COL=()=>({get:()=>gate});
const localSetsWorthMerging=x=>x,readLocalSets=()=>[];
const mergeSets=x=>x,shouldUseCloudResult=()=>true,docToSet=x=>x,cloudSyncEntry=x=>x;
const writeLocalNow=()=>writes.push({owner:currentUser.uid,data:JSON.parse(JSON.stringify(sets))});
const isCloudSynced=()=>true,saveSets=()=>{},watchCloud=()=>{},toast=()=>{},loadSetsLocal=()=>{};
`);
vm.runInContext(fn('loadSets'),load);
const loading=vm.runInContext('loadSets()',load);
vm.runInContext("currentUser={uid:'B'};release({docs:[{data:()=>({id:'A-only',name:'A private fixture'})}]})",load);
await loading;console.log('STALE_ACCOUNT_LOAD',vm.runInContext('writes',load));
assert.equal(vm.runInContext('writes[0].owner',load),'B');

const image=context(`let sets=[{problems:[]}],currentUser={uid:'A'},fbReady=true,deleted=[];
const isStorageUrl=()=>true,storagePathsOf=()=>[];
const fbStorage={refFromURL:u=>({delete:async()=>{deleted.push(u)}})};`);
vm.runInContext(fn('releaseImage'),image);
vm.runInContext("releaseImage('fixture-image');sets=[{problems:[{answerImg:'fixture-image'}]}]",image);
await Promise.resolve();await Promise.resolve();
console.log('IMAGE_UNDO',vm.runInContext('({restored:sets[0].problems[0].answerImg,deleted})',image));

const disk=context(`let localDirty=true,localTimer=0,wiping=false,sets=[{id:'unsaved'}],quotaWarned=false,currentUser=null;
const setsKey=()=> 'guest';const setSaveStatus=()=>{},toast=()=>{};
const localStorage={setItem:()=>{throw Error('simulated quota failure')}};`);
vm.runInContext(fn('writeLocalNow')+'\n'+fn('flushLocal')+'\n'+fn('hasUnsavedCloudWork'),disk);
console.log('FAILED_LOCAL_SAVE',vm.runInContext('({first:flushLocal(),dirty:localDirty,second:flushLocal(),closeWarning:hasUnsavedCloudWork()})',disk));
