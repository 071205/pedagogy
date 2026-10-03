/* B7 fixture transport. Registration is opt-in; file:// keeps the B6 path. */
(function(global){
'use strict';
function create({scriptURL='./pedagogy-intake-sw.js',timeoutMs=15000,fixture={}}={}){
  let registration;
  async function worker(){
    if(location.protocol==='file:'||!navigator.serviceWorker) throw Error('Service Worker는 이 주소에서 사용할 수 없습니다');
    registration ||= navigator.serviceWorker.register(scriptURL,{scope:'./',updateViaCache:'none'});
    const current=await registration;
    if(current.active)return current.active;
    await navigator.serviceWorker.ready;
    if(!current.active) throw Error('Service Worker 준비 실패');
    return current.active;
  }
  async function send(request,{owner,jobGeneration,sourceGeneration,pageIndex,dbName='PM_INTAKE_V1',signal}={}){
    if(signal?.aborted) throw new DOMException('중단됨','AbortError');
    const target=await worker();
    const channel=new MessageChannel();
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(error,value)=>{
        if(settled)return;settled=true;
        clearTimeout(timer);signal?.removeEventListener('abort',onAbort);channel.port1.close();
        if(error){error.ambiguous=true;reject(error);}else resolve(value);
      };
      const onAbort=()=>finish(new DOMException('중단됨','AbortError'));
      const timer=setTimeout(()=>finish(Error('outbox 응답 전달 확인 불가')),timeoutMs);
      signal?.addEventListener('abort',onAbort,{once:true});
      channel.port1.onmessage=event=>{
        const data=event.data;
        finish(data?.ok?null:Error(data?.error||'outbox 보존 실패'),data?.reply);
      };
      target.postMessage({type:'PM_B7_FIXTURE_SEND',owner,dbName,request,
        jobGeneration,sourceGeneration,pageIndex,fixture},[channel.port2]);
    });
  }
  return Object.freeze({send,ready:worker});
}
global.PedagogyIntakeOutbox=Object.freeze({create});
})(globalThis);
