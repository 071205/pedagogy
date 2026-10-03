/* B7 message-only fixture outbox. No fetch handler, cache, background sync or
   provider call: registration cannot change HTML/update delivery. */
'use strict';
const DB_VERSION=1,MAX_REPLY_BYTES=2*1024*1024;
function openDB(name){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(name,DB_VERSION);
    request.onupgradeneeded=()=>request.result.createObjectStore('owners',{keyPath:'owner'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('원문 저장소 확인 필요'));
  });
}
function readOwner(db,owner){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('owners','readonly'),request=tx.objectStore('owners').get(owner);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
function valid(root,message){
  const a=message.request?.attempt,j=root?.jobs?.[a?.jobId],p=j?.pages?.[message.pageIndex],src=root?.sources?.[a?.sourceId];
  return !root?.deleted&&!!j&&!!p&&!!src?.blob&&['available','unlinked'].includes(src.state)
    &&j.generation===message.jobGeneration&&src.generation===message.sourceGeneration
    &&j.state!=='finished'&&j.state!=='discarded'&&['processing','locked'].includes(p.state)
    &&p.sourceId===a.sourceId&&p.pageNumber===a.pageNumber&&p.attemptId===a.attemptId;
}
function save(db,message,reply,checksum){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('owners','readwrite'),store=tx.objectStore('owners'),get=store.get(message.owner);
    let error;
    get.onsuccess=()=>{
      const root=get.result;
      if(!valid(root,message)){error=Error('원문/작업 세대가 바뀌어 응답을 버렸어요');tx.abort();return;}
      const a=message.request.attempt,key=`${a.jobId}:${message.pageIndex}:${a.attemptId}`;
      root.outbox ||= {};
      if(root.outbox[key]){error=Error('같은 응답이 이미 보존됐어요');tx.abort();return;}
      root.outbox[key]={jobId:a.jobId,pageIndex:message.pageIndex,attemptId:a.attemptId,
        jobGeneration:message.jobGeneration,sourceId:a.sourceId,sourceGeneration:message.sourceGeneration,
        reply,checksum,createdAt:Date.now()};
      root.revision=(root.revision||0)+1;store.put(root);
    };
    tx.oncomplete=()=>resolve();
    tx.onerror=tx.onabort=()=>reject(error||tx.error||Error('outbox 보존 실패'));
  });
}
async function send(message){
  if(typeof message.owner!=='string'||!message.owner||typeof message.dbName!=='string'
    ||!/^[\w-]{1,100}$/.test(message.dbName)||!Number.isSafeInteger(message.pageIndex)
    ||message.pageIndex<0||!Number.isSafeInteger(message.jobGeneration)
    ||!Number.isSafeInteger(message.sourceGeneration)) throw Error('outbox 요청 형식 오류');
  const db=await openDB(message.dbName);
  try{
    if(!valid(await readOwner(db,message.owner),message)) throw Error('원문/작업 상태가 바뀌어 호출을 멈췄어요');
    if(message.fixture?.delayMs) await new Promise(r=>setTimeout(r,Math.min(2000,message.fixture.delayMs)));
    const reply={task:'problem-intake-v1',problems:[{title:'',answer:'',
      blocks:[{type:'statement',text:'Fixture outbox 문제'}],units:[],difficulty:null,
      points:null,pointsState:'absent',group:null}],usage:{used:1,limit:1}};
    const bytes=new TextEncoder().encode(JSON.stringify(reply.problems));
    if(bytes.length>MAX_REPLY_BYTES) throw Error('outbox 응답 용량 초과');
    const checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
      x=>x.toString(16).padStart(2,'0')).join('');
    await save(db,message,reply,checksum);
    return reply;
  }finally{db.close();}
}
self.addEventListener('message',event=>{
  // 같은 출처의 페이지가 보낸 메시지만 받는다. SW 는 원래 같은 출처 클라이언트에게서만 메시지를 받지만,
  // 출처와 보낸 쪽(Client)을 명시적으로 확인한다(SonarCloud 보안 규칙 · 깨보기는 check-intake-outbox).
  if(event.origin!==self.location.origin||!(event.source&&'id' in event.source))return;
  if(event.data?.type!=='PM_B7_FIXTURE_SEND'||!event.ports?.[0])return;
  const port=event.ports[0],message=event.data;
  event.waitUntil(send(message).then(reply=>{
    if(!message.fixture?.dropDelivery) port.postMessage({ok:true,reply});
  },error=>port.postMessage({ok:false,error:error.message})).finally(()=>port.close()));
});
