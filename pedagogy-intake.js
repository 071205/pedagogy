/* B6 device-only raw storage + page staging + recoverable independent adoption.
   U1.5 uses this same store. No source upload, TTL, automatic retry or auto-GC. */
(function(global){
'use strict';
const C=global.PedagogyIntakeContract;
const copy=v=>structuredClone(v), id=()=>crypto.randomUUID();
const fail=message=>{throw Error(message);};
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
function openDB(name){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(name,1);
    r.onupgradeneeded=()=>r.result.createObjectStore('owners',{keyPath:'owner'});
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
    r.onblocked=()=>reject(Error('다른 탭의 원문 저장소 업데이트 확인 필요'));
  });
}
async function persistence(){
  try{
    if(!navigator.storage?.persisted || !navigator.storage?.persist) return 'unsupported';
    if(await navigator.storage.persisted()) return 'granted';
    return await navigator.storage.persist()?'granted':'denied';
  }catch{ return 'error'; }
}
function create({session,library,renderer=browserRenderer(),transport=null,outbox=null,config,dbName='PM_INTAKE_V1',locks=navigator.locks}={}){
  const cap=C.limits(config), db=openDB(dbName), controllers=new Map(), urls=new Map();
  const context=()=>{const s=session(); if(!s?.owner) fail('소유자 확인 필요'); return {...s};};
  const matches=s=>{const n=context(); if(n.owner!==s.owner||n.epoch!==s.epoch) fail('계정이 바뀌어 작업을 멈췄어요');};
  async function transact(s,fn,write=true){
    matches(s);
    const d=await db; matches(s);
    return new Promise((resolve,reject)=>{
      const tx=d.transaction('owners',write?'readwrite':'readonly'),store=tx.objectStore('owners');
      let result, caught;
      const r=store.get(s.owner);
      r.onsuccess=()=>{
        try{
          matches(s);
          const root=r.result||{owner:s.owner,version:1,generation:1,sources:{},jobs:{},adoptions:{},links:{}};
          if(root.deleted) fail('삭제한 계정의 작업은 재개할 수 없습니다');
          result=fn(root);
          if(write){root.revision=(root.revision||0)+1;store.put(root);}
        }catch(e){caught=e; tx.abort();}
      };
      tx.oncomplete=()=>{try{matches(s);resolve(copy(result));}catch(e){reject(e);}};
      tx.onerror=tx.onabort=()=>reject(caught||tx.error||Error('원문 저장 실패'));
    });
  }
  const locked=async(s,key,run)=>{
    if(!locks?.request) fail('이 브라우저에서는 탭 간 저장을 조정할 수 없어요 · 지원 브라우저에서 다시 여세요');
    return locks.request(`pm-intake:${s.owner}:${key}`,async()=>{matches(s);return run();});
  };
  function source(root,sourceId,generation){
    const src=root.sources[sourceId];
    if(!src?.blob||!['available','unlinked'].includes(src.state)||(generation!=null&&src.generation!==generation)) fail('원문 없음 · 다시 연결이 필요합니다');
    return src;
  }
  function job(root,jobId,generation){
    const j=root.jobs[jobId];
    if(!j||j.state==='discarded'||(generation!=null&&j.generation!==generation)) fail('작업이 중단되었어요');
    return j;
  }
  async function createJob(files,{selection=null,contract='fixture-v1'}={}){
    const s=context();
    if(!Array.isArray(files)||!files.length||files.length>cap.files) fail('파일 개수 한도 초과');
    if(files.some(f=>!f.size||f.size>cap.fileBytes)||files.reduce((n,f)=>n+f.size,0)>cap.totalBytes) fail('원문 용량 한도 초과');
    const prepared=[]; let pages=0;
    for(let i=0;i<files.length;i++){
      const file=files[i]; matches(s);
      if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type)) fail('PDF 또는 지원 이미지 파일을 선택해 주세요');
      const count=await renderer.count(file,cap); matches(s);
      if(!Number.isSafeInteger(count)||count<1) fail('원문 쪽수 확인 실패');
      if(!selection?.[i]&&count>cap.pages)fail('선택 쪽수 한도 초과');
      const selected=selection?.[i]||Array.from({length:count},(_,n)=>n+1);
      if(!selected.length||new Set(selected).size!==selected.length||selected.some(n=>!Number.isSafeInteger(n)||n<1||n>count||n>500)) fail('쪽 범위 오류');
      pages+=selected.length; if(pages>cap.pages) fail('선택 쪽수 한도 초과');
      prepared.push({id:id(),name:file.name||'원문',type:file.type,bytes:file.size,pageCount:count,
        hash:await hash(await file.arrayBuffer()),blob:file,selected,generation:1,state:'available',version:1});
    }
    const jobId=id();
    await transact(s,r=>{
      if(Object.values(r.sources).reduce((n,x)=>n+(x.blob?x.bytes:0),0)+prepared.reduce((n,x)=>n+x.bytes,0)>cap.totalBytes)fail('원문 보관 합계 용량 초과');
      prepared.forEach(src=>{r.sources[src.id]=src;});
      r.jobs[jobId]={id:jobId,version:1,generation:1,state:'pending',contract,limits:cap,draftVersion:1,calls:0,
        sources:prepared.map(x=>x.id),pages:prepared.flatMap(x=>x.selected.map(pageNumber=>({
          sourceId:x.id,pageNumber,sourceGeneration:x.generation,state:'pending',attemptId:null,retries:0}))),drafts:[],groups:[]};
      return jobId;
    });
    const storageState=await persistence();matches(s);
    return {jobId,persistence:storageState};
  }
  async function readJob(jobId){const s=context();return transact(s,r=>job(r,jobId),false);}
  async function recoverOutbox(jobId=null){
    const s=context();
    if(!outbox) return [];
    // The SW stores the response in this owner record before replying. Consume
    // it in the same transaction as the page result so a crash cannot duplicate
    // drafts or lose the only durable copy between two writes.
    return transact(s,r=>{
      const recovered=[];
      for(const [key,item] of Object.entries(r.outbox||{})){
        if(jobId && item.jobId!==jobId) continue;
        const j=r.jobs[item.jobId],p=j?.pages[item.pageIndex],src=r.sources[item.sourceId];
        if(!j||!p||!src?.blob||!['available','unlinked'].includes(src.state)
          ||src.generation!==item.sourceGeneration||j.generation!==item.jobGeneration
          ||j.state==='discarded'||j.state==='finished'||p.attemptId!==item.attemptId
          ||p.sourceId!==item.sourceId||p.state!=='processing'&&p.state!=='locked'){
          delete r.outbox[key];continue;
        }
        try{
          const jobCap=j.limits||cap,parsed=C.validateResponse(item.reply,jobCap);
          if(j.drafts.length+parsed.length>jobCap.problemsPerJob) fail('작업 문항 한도 초과 · 범위 선택 필요');
          const groups=new Map(),drafts=parsed.map((raw,n)=>({id:id(),sourceId:item.sourceId,pageNumber:p.pageNumber,ordinal:n+1,raw}));
          drafts.forEach(d=>{if(d.raw.group){if(!groups.has(d.raw.group))groups.set(d.raw.group,[]);groups.get(d.raw.group).push(d.id);}});
          for(const members of groups.values()){
            if(members.length<2||members.length>10) fail('공통지문 구성원 확인 필요');
            j.groups.push({id:id(),members});
          }
          j.drafts.push(...drafts);j.draftVersion++;
          Object.assign(p,{state:'success',checksum:item.checksum,
            receipt:item.reply.usage?{used:item.reply.usage.used,limit:item.reply.usage.limit}:null,error:null});
          recovered.push({jobId:item.jobId,pageIndex:item.pageIndex});
        }catch(e){p.state='locked';p.error=e.message;}
        delete r.outbox[key];
      }
      for(const j of Object.values(r.jobs)) if(recovered.some(x=>x.jobId===j.id))
        j.state=j.pages.every(p=>p.state==='success')?'success':'partial';
      return recovered;
    });
  }
  async function run(jobId,{retryPages=[],confirmCharge=false}={}){
    const s=context();
    if(!transport&&!outbox) fail('C1~C3 승인·운영 한도 전에는 일괄 AI 호출을 사용할 수 없습니다');
    return locked(s,`job:${jobId}`,async()=>{
      await recoverOutbox(jobId);
      let j=await readJob(jobId);
      if(['finished','discarded'].includes(j.state))fail('종료한 작업은 재개 확인 필요');
      if(retryPages.length&&!confirmCharge) fail('재시도는 추가 차감 안내 확인이 필요합니다');
      for(let i=0;i<j.pages.length;i++){
        j=await readJob(jobId); const p=j.pages[i];
        if(p.state==='success'||p.state==='locked'||p.state==='missing') continue;
        if(p.state==='processing'){ // crashed/ambiguous call: never automatically pay again
          await transact(s,r=>{job(r,jobId,j.generation).pages[i].state='locked';}); continue;
        }
        const retry=p.state==='failed';
        if(retry&&!retryPages.includes(i)) continue;
        if(retry&&p.retries>=cap.retries) continue;
        if(j.calls>=cap.calls) break;
        let src;
        try{src=await transact(s,r=>source(r,p.sourceId,p.sourceGeneration),false);}
        catch{await transact(s,r=>{job(r,jobId,j.generation).pages[i].state='missing';});continue;}
        let image,imageHash;
        try{
          image=await renderer.page(src.blob,p.pageNumber,cap); matches(s);
          if(!image || !['image/jpeg','image/png','image/webp'].includes(image.mimeType)
            || Math.min(image.width,image.height)<cap.minDimension || Math.max(image.width,image.height)>cap.maxDimension
            || !Number.isSafeInteger(image.bytes)||image.bytes>cap.imageBytes||!image.imageBase64) fail('쪽 이미지 해상도/용량 오류');
          const pageBytes=Uint8Array.from(atob(image.imageBase64),x=>x.charCodeAt(0));
          if(pageBytes.length!==image.bytes)fail('쪽 이미지 바이트 불일치');
          imageHash=await hash(pageBytes);matches(s);
        }catch(e){await transact(s,r=>{const q=job(r,jobId,j.generation).pages[i];q.state='failed';q.error=e.message;});continue;}
        const attemptId=id();
        const request={task:C.TASK,imageBase64:image.imageBase64,mimeType:image.mimeType,width:image.width,height:image.height,
          attempt:{jobId,sourceId:p.sourceId,pageNumber:p.pageNumber,sourceHash:imageHash,
            extractionContractHash:await hash(new TextEncoder().encode(j.contract)),attemptId,retry}};
        if(new TextEncoder().encode(JSON.stringify(request)).length>cap.requestBytes){
          await transact(s,r=>{const q=job(r,jobId,j.generation).pages[i];q.state='failed';q.error='요청 용량 초과';});continue;
        }
        await transact(s,r=>{
          source(r,p.sourceId,p.sourceGeneration);const live=job(r,jobId,j.generation),q=live.pages[i];
          if(q.state!==p.state) fail('다른 탭에서 이 쪽 상태가 바뀌었어요');
          q.state='processing';q.attemptId=attemptId;if(retry)q.retries++;live.calls++;live.state='processing';
        });
        const controller=new AbortController(); controllers.set(controller,p.sourceId);
        try{
          const reply=outbox
            ? await outbox.send(request,{owner:s.owner,jobGeneration:j.generation,sourceGeneration:p.sourceGeneration,
              pageIndex:i,dbName,signal:controller.signal})
            : await transport(request,{signal:controller.signal}); matches(s);
          if(reply?.state==='completed'||reply?.state==='pending'){
            await transact(s,r=>{job(r,jobId,j.generation).pages[i].state='locked';});continue;
          }
          if(outbox){await recoverOutbox(jobId);continue;}
          const parsed=C.validateResponse(reply,cap);
          const checksum=await hash(new TextEncoder().encode(JSON.stringify(parsed)));
          await transact(s,r=>{
            source(r,p.sourceId,p.sourceGeneration);const live=job(r,jobId,j.generation);
            if(live.drafts.length+parsed.length>cap.problemsPerJob) fail('작업 문항 한도 초과 · 범위 선택 필요');
            const drafts=parsed.map((raw,n)=>({id:id(),sourceId:p.sourceId,pageNumber:p.pageNumber,ordinal:n+1,raw}));
            const groups=new Map();
            drafts.forEach(d=>{if(d.raw.group){if(!groups.has(d.raw.group))groups.set(d.raw.group,[]);groups.get(d.raw.group).push(d.id);}});
            for(const members of groups.values()){
              if(members.length<2||members.length>10) fail('공통지문 구성원 확인 필요');
              live.groups.push({id:id(),members});
            }
            live.drafts.push(...drafts); live.draftVersion++;
            Object.assign(live.pages[i],{state:'success',checksum,receipt:reply.usage?{used:reply.usage.used,limit:reply.usage.limit}:null,error:null});
          });
        }catch(e){
          try{await transact(s,r=>{source(r,p.sourceId,p.sourceGeneration);const q=job(r,jobId,j.generation).pages[i];
            q.state=outbox||e.ambiguous||e.name==='AbortError'?'locked':'failed';q.error=e.message;});}catch{}
        }finally{controllers.delete(controller);}
      }
      return transact(s,r=>{const live=job(r,jobId,j.generation);live.state=live.pages.every(p=>p.state==='success')?'success':'partial';return live;});
    });
  }
  function problemFromDraft(d,problemId){
    const raw=d.raw;
    const blocks=raw.blocks.map(b=>({type:b.type,data:['statement','boxed'].includes(b.type)?{text:b.text}:{items:copy(b.items)}}));
    return global.PedagogyNormalize.normProblem({id:problemId,title:raw.title,answer:raw.answer,blocks,
      intake:{version:1,sources:[{sourceId:d.sourceId,pages:[d.pageNumber]}],units:raw.units.map(value=>({value,origin:'ai'})),
        difficulty:raw.difficulty===null?null:{value:raw.difficulty,origin:'ai'},points:raw.points,pointsState:raw.pointsState,
        contentReview:'unreviewed',classificationReview:'unreviewed'}},{keepId:true,lossless:true});
  }
  function validatePlan(j,destinations,partial){
    if(j.pages.some(p=>p.state!=='success')&&!partial) fail('성공한 쪽만 사용 선택 필요');
    if(!Array.isArray(destinations)||!destinations.length||new Set(destinations.map(d=>d.id)).size!==destinations.length) fail('목적지 확인 필요');
    const known=new Set(j.drafts.map(d=>d.id));
    for(const d of destinations){
      if(typeof d.id!=='string'||!d.id||d.id.length>100||typeof d.name!=='string'||!d.name.trim()||d.name.length>100||!Array.isArray(d.items)||!d.items.length
        ||d.items.length>cap.problemsPerSet||d.items.some(x=>!known.has(x.draftId)||typeof x.placementId!=='string'||!x.placementId||x.placementId.length>100)
        ||new Set(d.items.map(x=>x.placementId)).size!==d.items.length) fail('목적지 문항/500문항 한도 오류');
      for(const g of j.groups){
        const positions=d.items.map((x,i)=>g.members.includes(x.draftId)?i:-1).filter(i=>i>=0);
        if(!positions.length) continue;
        const memberIds=positions.map(i=>d.items[i].draftId);
        if(positions.length%g.members.length) fail('공통지문은 실제 구성원 순서대로 함께 채택해야 합니다');
        for(let start=0;start<positions.length;start+=g.members.length){
          if(g.members.some((member,i)=>memberIds[start+i]!==member||positions[start+i]!==positions[start]+i))
            fail('공통지문은 실제 구성원 순서대로 함께 채택해야 합니다');
        }
      }
    }
  }
  async function adopt(jobId,{destinations,draftVersion,partial=false,adoptionId=null,mode='independent'}={}){
    const s=context();if(!library) fail('라이브러리 연결 필요');
    if(mode!=='independent') fail('수정 연동 저장은 별도 Rules·호환 검토 전 사용할 수 없습니다');
    return locked(s,`adopt:${jobId}`,async()=>library.exclusive(async()=>{
      matches(s);
      let ledger=await transact(s,r=>{
        const j=job(r,jobId);
        // One frozen adoption per configuration; explicit new-copy flow is future UI.
        const existing=Object.values(r.adoptions).find(a=>a.jobId===jobId&&a.draftVersion===draftVersion);
        if(existing){if(existing.generation!==j.generation)fail('작업 세대 변경 · 채택 확인 필요');if(adoptionId&&adoptionId!==existing.id) fail('기존 채택 기록 확인 필요');return existing;}
        if(adoptionId) fail('채택 기록 없음 · 라이브러리 확인 필요');
        if(draftVersion!==j.draftVersion) fail('초안 버전이 바뀌었어요');
        validatePlan(j,destinations,partial);
        const a={id:id(),version:1,jobId,draftVersion,generation:j.generation,partial,
          results:destinations.map(d=>({destinationId:d.id,setId:id(),name:d.name,state:'mapped',
            items:d.items.map(x=>({...x,problemId:id()}))})),drafts:copy(j.drafts),groups:copy(j.groups)};
        r.adoptions[a.id]=a;
        for(const result of a.results) r.links[result.setId]={sources:[...new Set(result.items.map(x=>j.drafts.find(p=>p.id===x.draftId).sourceId))],state:'pending'};
        return a;
      });
      const before=library.snapshot();matches(s);
      const next=copy(before.sets),included=[];
      for(const result of ledger.results){
        if(next.some(x=>x.id===result.setId)){included.push(result.setId);continue;}
        if(before.deleted.includes(result.setId)){result.state='deleted';continue;}
        if(result.state==='local'||result.state==='deleted'||result.state==='check'){result.state='check';continue;}
        const problems=result.items.map(item=>problemFromDraft(ledger.drafts.find(d=>d.id===item.draftId),item.problemId));
        for(const g of ledger.groups) result.items.forEach((item,i)=>{if(item.draftId===g.members[0])problems[i].groupSpan=g.members.length;});
        next.push({id:result.setId,name:result.name,header:'',subject:'math',lineColor:'indigo',problems});included.push(result.setId);
      }
      let saved=false,error=null;
      try{saved=await library.commit(next,before);matches(s);if(!saved)error='로컬 저장 실패';}
      catch(e){error=e.message;}
      // Even if this transaction fails, the fixed mapping survives. Reentry checks library IDs.
      ledger=await transact(s,r=>{
        const a=r.adoptions[ledger.id];job(r,jobId,a.generation);
        for(const result of a.results){
          const observed=ledger.results.find(x=>x.setId===result.setId);
          if(['deleted','check'].includes(observed.state)) result.state=observed.state;
          else result.state=saved&&included.includes(result.setId)?'local':'failed';
          result.error=error;
          if(result.state==='local') r.links[result.setId].state='active';
          if(result.state==='deleted') r.links[result.setId].state='detached';
        }
        return a;
      });
      return {adoption:ledger,results:ledger.results.map(r=>({...r,cloud:r.state==='local'?library.cloud(r.setId):null})),
        next:'list'};
    }));
  }
  function refs(sets,sourceId){return (sets||[]).filter(set=>(set.problems||[]).some(p=>p.intake?.sources?.some(s=>s.sourceId===sourceId))).map(x=>x.id);}
  async function impact(sourceId){
    const s=context(),view=library?.snapshot();
    if(!view || view.unknown || !view.cloudReady || !view.online) return {state:'check',reason:'확인 필요 · 온라인 및 첫 서버 확정 구독 필요'};
    return transact(s,r=>{
      const src=r.sources[sourceId];if(!src) fail('원문 없음');
      const indexed=Object.entries(r.links).filter(([,v])=>v.sources.includes(sourceId));
      const active=[...new Set([...refs(view.sets,sourceId),...refs(view.conflicts,sourceId),...indexed.filter(([key,v])=>v.state==='pending'||view.sets.some(s=>s.id===key)).map(([key])=>key)])];
      const jobs=Object.values(r.jobs).filter(j=>!['discarded','finished'].includes(j.state)&&j.sources.includes(sourceId)).map(j=>j.id);
      const recovery=refs(view.recovery,sourceId);
      const dependent=[...view.sets,...view.conflicts,...view.recovery].some(set=>refs([set],sourceId).length&&JSON.stringify(set).includes('blob:'));
      return {state:dependent?'check':'ready',reason:dependent?'결과 그림의 독립 보존 확인 필요':null,
        sourceId,generation:src.generation,name:src.name,bytes:src.bytes,active,jobs,recovery,
        revision:r.revision||0,ticket:JSON.stringify({view,revision:r.revision||0,generation:src.generation,active,jobs,recovery})};
    },false);
  }
  async function deleteSource(sourceId,{ticket,confirmed=false}={}){
    const s=context();if(!confirmed||!ticket) fail('원문 삭제 영향 확인 필요');
    return library.exclusive(async()=>{
      const now=await impact(sourceId);matches(s);
      if(now.state!=='ready'||now.ticket!==ticket) fail('삭제 범위가 바뀌었거나 확인 필요');
      await transact(s,r=>{
        const src=r.sources[sourceId];if(src.generation!==now.generation||(r.revision||0)!==now.revision) fail('삭제 범위/세대 변경');
        src.generation++;src.state='deleting';
        for(const j of Object.values(r.jobs)) if(j.sources.includes(sourceId)){
          j.generation++;j.state='partial';j.pages.forEach(p=>{if(p.sourceId===sourceId&&p.state!=='success')p.state='missing';});
        }
        for(const [key,item] of Object.entries(r.outbox||{})) if(item.sourceId===sourceId) delete r.outbox[key];
      });
      for(const [controller,id] of controllers) if(id===sourceId){controller.abort();controllers.delete(controller);}
      for(const [url,id] of urls) if(id===sourceId){URL.revokeObjectURL(url);urls.delete(url);}
      return transact(s,r=>{
        const src=r.sources[sourceId];src.blob=null;src.state='deleted';delete src.selected;return {state:'deleted'};
      });
    });
  }
  async function listSources(){if(library)await reconcile();const s=context();return transact(s,r=>Object.values(r.sources).map(({blob,...v})=>v),false);}
  async function readSource(sourceId){const s=context();return transact(s,r=>source(r,sourceId),false);}
  async function forProblem(setId,p){
    const s=context();return transact(s,r=>{
      const link=r.links[setId];
      if(!link||link.state!=='active') return {state:'missing',reason:'이 브라우저에 연결된 원본이 없습니다 · 다시 연결'};
      const ref=p.intake?.sources?.find(x=>link.sources.includes(x.sourceId));
      if(!ref) return {state:'missing'};
      const src=r.sources[ref.sourceId];return src?.blob?{state:src.state,blob:src.blob,pages:ref.pages}: {state:src?.state||'missing'};
    },false);
  }
  async function linkSource(sourceId,setId,pages=[]){
    const s=context();return library.exclusive(async()=>{
      const view=library.snapshot();if(!view.sets.some(x=>x.id===setId)) fail('문제집 없음');
      return transact(s,r=>{
        const src=source(r,sourceId);if(pages.some(n=>!Number.isSafeInteger(n)||n<1||n>src.pageCount)) fail('쪽 범위 오류');
        const link=r.links[setId]||{sources:[],state:'active'};
        if(!link.sources.includes(sourceId))link.sources.push(sourceId);link.state='active';r.links[setId]=link;src.state='available';
        return true;
      });
    });
  }
  async function reconcile(){
    const s=context(),view=library.snapshot();if(view.unknown) return;
    return transact(s,r=>{
      for(const [key,link] of Object.entries(r.links)) if(view.deleted.includes(key)||(link.state==='active'&&!view.sets.some(x=>x.id===key))) link.state='detached';
      for(const [key,link] of Object.entries(r.links)) if(link.state==='detached'&&view.sets.some(x=>x.id===key)) link.state='active';
      for(const src of Object.values(r.sources)) if(src.blob){
        const alive=refs(view.sets,src.id).length||refs(view.conflicts,src.id).length
          ||Object.values(r.links).some(l=>['active','pending'].includes(l.state)&&l.sources.includes(src.id))
          ||Object.values(r.jobs).some(j=>!['discarded','finished'].includes(j.state)&&j.sources.includes(src.id));
        src.state=alive?'available':'unlinked';
      }
    });
  }
  async function finishJob(jobId){const s=context();return transact(s,r=>{const j=job(r,jobId);j.state='finished';j.generation++;});}
  function stop(){controllers.forEach((_,c)=>c.abort());controllers.clear();urls.forEach((_,u)=>URL.revokeObjectURL(u));urls.clear();}
  async function purge(){
    const s=context(); stop();const d=await db;matches(s);
    const fence=id();
    return new Promise((resolve,reject)=>{
      const tx=d.transaction('owners','readwrite'),store=tx.objectStore('owners');
      // Keep only the account fence, never an old job/source/receipt or D4 preference.
      store.put({owner:s.owner,version:1,deleted:true,fence,generation:Date.now(),sources:{},jobs:{},adoptions:{},links:{},outbox:{}});
      tx.oncomplete=()=>resolve(fence);tx.onerror=tx.onabort=()=>reject(tx.error||Error('로컬 원문 파기 실패'));
    });
  }
  // Only the deletion attempt that installed the fence may clear it after a
  // confirmed Auth failure. A later signed-in session may recover an orphaned
  // fence after Auth reload confirms that this owner still exists.
  async function purgeFence(){
    const s=context(),d=await db;matches(s);
    return new Promise((resolve,reject)=>{
      const tx=d.transaction('owners','readonly'),r=tx.objectStore('owners').get(s.owner);
      r.onsuccess=()=>resolve(r.result?.deleted===true);
      r.onerror=()=>reject(r.error);
    });
  }
  async function recoverPurge(fence){
    const s=context(),d=await db;matches(s);
    return new Promise((resolve,reject)=>{
      const tx=d.transaction('owners','readwrite'),store=tx.objectStore('owners'),r=store.get(s.owner);
      let recovered=false,caught;
      r.onsuccess=()=>{
        try{
          matches(s);
          if(!r.result?.deleted)return;
          if(fence && r.result.fence!==fence) fail('계정 삭제 시도가 바뀌었어요');
          store.delete(s.owner);recovered=true;
        }catch(e){caught=e;tx.abort();}
      };
      tx.oncomplete=()=>{try{matches(s);resolve(recovered);}catch(e){reject(e);}};
      tx.onerror=tx.onabort=()=>reject(caught||tx.error||Error('원문 삭제 울타리 복구 실패'));
    });
  }
  async function reconnect(sourceId,file){
    const s=context(),digest=await hash(await file.arrayBuffer());matches(s);
    return transact(s,r=>{
      const old=r.sources[sourceId];
      if(!old||old.state==='deleted'||old.state==='deleting'||old.hash!==digest||old.bytes!==file.size||old.type!==file.type)
        fail('다른 파일/삭제한 원문은 새 원문으로 명시 등록해야 합니다');
      old.blob=file;old.generation++;old.state='available';return sourceId;
    });
  }
  async function adoptionStatus(adoptionId){
    const s=context();const a=await transact(s,r=>r.adoptions[adoptionId]||fail('채택 기록 없음'),false);
    const view=library.snapshot();
    return {adoption:a,results:a.results.map(result=>({
      ...result,state:view.sets.some(x=>x.id===result.setId)?result.state:view.deleted.includes(result.setId)?'deleted':result.state==='local'?'check':result.state,
      cloud:view.sets.some(x=>x.id===result.setId)?library.cloud(result.setId):null
    })),next:'list'};
  }
  async function inheritLinks(fromSetId,toSetId){
    const s=context();return transact(s,r=>{
      const from=r.links[fromSetId];if(!from)return false;
      r.links[toSetId]={sources:copy(from.sources),state:'active'};
      for(const sourceId of from.sources){
        const src=r.sources[sourceId];
        if(src?.blob&&src.state==='unlinked')src.state='available';
      }
      return true;
    });
  }
  async function detachSource(sourceId,setId){
    const s=context();return library.exclusive(async()=>{
      const view=library.snapshot(),next=copy(view.sets),set=next.find(x=>x.id===setId);
      if(!set)fail('문제집 없음');
      for(const p of set.problems||[]) if(p.intake)p.intake.sources=p.intake.sources.filter(x=>x.sourceId!==sourceId);
      // Explicit detach never couples irreversible deletion to Undoable results.
      if(!await library.commit(next,view))fail('연결 해제 로컬 저장 실패');
      return transact(s,r=>{
        const link=r.links[setId];if(link)link.sources=link.sources.filter(x=>x!==sourceId);
        return true;
      });
    });
  }
  return Object.freeze({adoptionStatus,inheritLinks,detachSource,createJob,readJob,run,recoverOutbox,adopt,impact,deleteSource,listSources,readSource,forProblem,linkSource,reconcile,finishJob,stop,purge,purgeFence,recoverPurge,reconnect,persistence});
}
function browserRenderer(){
  let pdfModule;
  async function pdf(blob){
    const module=await (pdfModule ||= import('./vendor/pdfjs/pdf.mjs'));
    module.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',location.href).href;
    const task=module.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,stopAtErrors:true,
      cMapUrl:new URL('./vendor/pdfjs/cmaps/',location.href).href,cMapPacked:true,
      standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',location.href).href,
      wasmUrl:new URL('./vendor/pdfjs/wasm/',location.href).href,
      iccUrl:new URL('./vendor/pdfjs/iccs/',location.href).href});
    try{return {doc:await task.promise,close:()=>task.destroy()};}catch(e){await task.destroy();throw e;}
  }
  async function bitmap(blob){return createImageBitmap(blob);}
  return {
    async count(blob,cap){
      if(blob.type==='application/pdf'){const doc=await pdf(blob);try{return doc.doc.numPages;}finally{await doc.close();}}
      const image=await bitmap(blob);try{if(Math.min(image.width,image.height)<cap.minDimension) fail('원문 해상도가 너무 낮습니다');return 1;}finally{image.close();}
    },
    async page(blob,pageNumber,cap){
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');let doc,image;
      try{
        if(blob.type==='application/pdf'){
          doc=await pdf(blob);const page=await doc.doc.getPage(pageNumber),base=page.getViewport({scale:1});
          const viewport=page.getViewport({scale:cap.maxDimension/Math.max(base.width,base.height)});
          canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);
          await page.render({canvasContext:ctx,viewport}).promise;
        }else{
          if(pageNumber!==1) fail('이미지는 한 쪽입니다');image=await bitmap(blob);
          const scale=Math.min(1,cap.maxDimension/Math.max(image.width,image.height));
          canvas.width=Math.floor(image.width*scale);canvas.height=Math.floor(image.height*scale);ctx.drawImage(image,0,0,canvas.width,canvas.height);
        }
        if(Math.min(canvas.width,canvas.height)<cap.minDimension) fail('쪽 해상도가 너무 낮습니다');
        const output=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.85));if(!output) fail('쪽 렌더 실패');
        if(output.size>cap.imageBytes) fail('쪽 이미지 용량 초과');
        const imageBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(output);});
        return {imageBase64,mimeType:output.type,bytes:output.size,width:canvas.width,height:canvas.height};
      }finally{image?.close();await doc?.close();canvas.width=canvas.height=0;}
    }
  };
}
global.PedagogyIntake=Object.freeze({create,browserRenderer,persistence});
})(globalThis);
