/* U2: device-local composition workspace. All writes go through the B6 engine. */
(function(global){
'use strict';
const copy=value=>structuredClone(value);
function node(tag,text,className){
  const value=document.createElement(tag);if(text!==undefined)value.textContent=text;
  if(className)value.className=className;return value;
}
function field(parent,label,value,{type='text',multiline=false}={}){
  const wrap=node('label',undefined,'cmp-field'),input=node(multiline?'textarea':'input');
  wrap.append(node('span',label),input);input.setAttribute('aria-label',label);
  if(!multiline)input.type=type;input.value=value??'';parent.append(wrap);return input;
}
function select(parent,label,options,value){
  const wrap=node('label',undefined,'cmp-field'),input=node('select');
  input.setAttribute('aria-label',label);
  options.forEach(([id,name])=>{const option=node('option',name);option.value=id;input.append(option);});
  input.value=value;wrap.append(node('span',label),input);parent.append(wrap);return input;
}
function check(parent,label){
  const wrap=node('label',undefined,'cmp-check'),input=node('input');input.type='checkbox';
  wrap.append(input,node('span',label));parent.append(wrap);return input;
}
function requestSettings(value){
  const result={...value},text=value.request.trim();if(!text)return result;
  const count=/(\d+)\s*권/.exec(text),size=/(\d+)\s*(?:문항|문제)씩/.exec(text);
  if(count)result.count=Number(count[1]);
  if(size){result.preset='chunks';result.size=Number(size[1]);}
  else if(/단원/.test(text))result.preset='units';
  else if(/난이도/.test(text))result.preset='difficulty';
  else if(/배점/.test(text))result.preset='points';
  else if(count)result.preset='books';
  else throw Error('이 요청은 자동으로 해석할 수 없어요 · 분류 기준과 권수를 직접 골라 주세요');
  const leftover=text.replace(/\d+\s*(?:권|(?:문항|문제)씩)|단원별로?|난이도별로?|배점별로?|나눠\s*줘|만들어\s*줘|구성해\s*줘|[\s,.]/g,'');
  if(leftover)throw Error('요청의 일부를 해석하지 못했어요 · 단원별로 5권, 20문항씩처럼 입력하거나 기준을 직접 골라 주세요');
  return result;
}
function textLeaves(value,path=[],out=[]){
  if(Array.isArray(value)){value.forEach((item,i)=>textLeaves(item,[...path,i],out));return out;}
  if(!value||typeof value!=='object')return out;
  for(const [key,item] of Object.entries(value)){
    const next=[...path,key];
    if(typeof item==='string'&&['text','title','who','label','source','note','intro'].includes(key))out.push({path:next,value:item});
    else if(Array.isArray(item)&&['items','lines','cells'].includes(key))item.forEach((part,i)=>{
      if(typeof part==='string')out.push({path:[...next,i],value:part});else textLeaves(part,[...next,i],out);
    });
    else if(item&&typeof item==='object')textLeaves(item,next,out);
  }
  return out;
}
function create(bridge){
  const dialog=node('dialog',undefined,'cmp-dialog');dialog.id='compositionDialog';
  dialog.setAttribute('aria-labelledby','compositionTitle');
  const header=node('header',undefined,'cmp-header'),title=node('h2','여러 권으로 새로 구성');title.id='compositionTitle';
  const closeButton=node('button','라이브러리로'),message=node('p','', 'cmp-message');
  message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  const content=node('fieldset',undefined,'cmp-content');header.append(title,closeButton);dialog.append(header,message,content);document.body.append(dialog);
  let client,session,job,report,selectedId=null,bucketId='unassigned',proposal=null,busy=false,dirty=false,opener,sourceView=null,sourceToken=0,serial=0;
  const sameSession=()=>session===bridge.session();
  function current(lease){if(lease!==serial||!dialog.open||!sameSession())throw Error('계정이 바뀌었어요 · 구성 화면을 다시 열어 주세요');}
  function feedback(text,bad=false){message.textContent=text;message.classList.toggle('cmp-error',bad);}
  function cleanRequired(){if(dirty)throw Error('수정한 문항을 먼저 저장하거나 되돌려 주세요');}
  function clearSource(){sourceToken++;sourceView?.close();sourceView=null;}
  function close(force=false){
    if(busy&&!force)return;
    if(dirty&&!force&&!confirm('저장하지 않은 문항 수정을 버리고 닫을까요?'))return;
    serial++;busy=false;content.disabled=false;closeButton.disabled=false;clearSource();dialog.close();content.replaceChildren();job=null;report=null;proposal=null;dirty=false;
    if(opener?.isConnected)opener.focus();
  }
  async function action(run){
    const lease=serial;
    if(busy)return;busy=true;content.disabled=true;closeButton.disabled=true;feedback('처리 중…');
    try{current(lease);await run();current(lease);}
    catch(error){if(lease===serial&&dialog.open&&sameSession())feedback(error.message,true);}
    finally{if(lease===serial){busy=false;content.disabled=false;closeButton.disabled=false;}}
  }
  function button(parent,label,run,{disabled=false,accent=false}={}){
    const b=node('button',label,accent?'btn-accent':'btn-ghost');b.type='button';b.disabled=disabled;
    b.onclick=()=>action(run);parent.append(b);return b;
  }
  closeButton.onclick=()=>close();dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  window.addEventListener('beforeunload',e=>{if(dialog.open&&dirty){e.preventDefault();e.returnValue='';}});
  function changed(){dirty=true;feedback('문항 수정 중 · 저장을 눌러 주세요');}
  async function reload(jobId=job.id){
    const lease=serial;
    const next=await client.readComposition(jobId);current(lease);
    const listed=await client.listJobs();current(lease);
    const adoptionId=listed.find(x=>x.id===jobId)?.adoptionId;
    const nextReport=adoptionId?await client.adoptionStatus(adoptionId):null;current(lease);
    job=next;report=nextReport;dirty=false;clearSource();
    if(!options().some(([id])=>id===bucketId))bucketId='unassigned';
    const visible=bucketItems(bucketId);
    if(!visible.includes(selectedId))selectedId=visible[0]||null;
    renderWorkspace();
  }
  async function persist(plan,patches=[]){
    const lease=serial;
    await client.saveComposition(job.id,{draftVersion:job.draftVersion,plan,patches});current(lease);await reload();current(lease);
    feedback('구성 초안을 이 브라우저에 저장했어요 · 기존 문제집은 그대로예요');
  }
  async function open(ids=[]){
    if(dialog.open)return;const lease=++serial;busy=false;session=bridge.session();opener=document.activeElement;
    client=bridge.client(false);job=null;report=null;proposal=null;dirty=false;selectedId=null;bucketId='unassigned';
    dialog.showModal();feedback('이 브라우저의 구성 작업을 읽는 중…');
    await action(()=>renderStart(ids));if(lease===serial&&dialog.open)closeButton.focus();
  }
  async function renderStart(ids){
    const lease=serial;
    const jobs=await client.listJobs();current(lease);content.replaceChildren();
    const setup=node('section',undefined,'cmp-start');setup.append(node('h3','기존 문제집에서 시작'));
    setup.append(node('p','원본은 그대로 두고 새 문제집을 만듭니다. 구성 초안과 연결한 원문은 이 브라우저에만 보관돼요.'));
    const selected=new Set(ids),list=node('div',undefined,'cmp-source-list');
    bridge.sets().forEach(set=>{
      const input=check(list,`${set.name||'제목 없음'} · ${Array.isArray(set.problems)?set.problems.length:'?'}문항`);
      input.checked=selected.has(set.id);input.onchange=()=>input.checked?selected.add(set.id):selected.delete(set.id);
    });setup.append(list);
    const confirmed=check(setup,'같은 브라우저의 다른 PEDAGOGY 탭을 닫았어요');
    button(setup,'선택한 문제집으로 구성 시작',async()=>{const lease=serial;
      if(!confirmed.checked)throw Error('다른 탭을 닫았는지 먼저 확인해 주세요');
      client=bridge.client(true);const made=await client.createComposition([...selected]);current(lease);await reload(made.jobId);current(lease);
      feedback('문항 목적지를 고르거나 새 구성안을 미리 확인하세요 · AI 호출 0회');
    },{accent:true});
    const material=node('section',undefined,'cmp-start');material.append(node('h3','PDF·사진으로 새로 추출'));
    material.append(node('p','일괄 AI 추출은 준비 중입니다. 현재는 기존 문제집과 이 브라우저에 남은 추출 결과로 구성할 수 있어요.'));
    const disabled=node('button','PDF·사진 일괄 추출 준비 중');disabled.disabled=true;material.append(disabled);
    const resume=node('section',undefined,'cmp-start');resume.append(node('h3','이 브라우저에서 이어하기'));
    if(!jobs.length)resume.append(node('p','아직 저장한 구성 작업이 없어요.'));
    jobs.sort((a,b)=>b.createdAt-a.createdAt).forEach(item=>button(resume,`${item.name} · ${item.count}문항${item.adoptionId?' · 만들기 결과 있음':''}`,async()=>{const lease=serial;
      if(!confirmed.checked)throw Error('다른 탭을 닫았는지 먼저 확인해 주세요');
      client=bridge.client(true);await reload(item.id);current(lease);feedback('이 브라우저에 저장한 작업을 열었어요');
    }));content.append(setup,material,resume);feedback('기존 문제집 선택 또는 남은 작업 이어하기 · AI 호출 없음');
  }
  function options(){return [...job.composition.destinations.map(d=>[d.id,d.name]),['unassigned','미분류'],['excluded','제외']];}
  function bucketItems(id){
    if(['unassigned','excluded'].includes(id))return job.composition[id];
    return job.composition.destinations.find(d=>d.id===id)?.items.map(x=>x.draftId)||[];
  }
  function renderWorkspace(){
    content.replaceChildren();const bar=node('div',undefined,'cmp-toolbar');
    button(bar,'작업 목록',async()=>{const lease=serial;cleanRequired();proposal=null;await renderStart([]);current(lease);});
    button(bar,'실행취소',async()=>{const lease=serial;cleanRequired();await client.undoComposition(job.id,{draftVersion:job.draftVersion});current(lease);await reload();current(lease);feedback('이전 구성과 문항을 복구했어요');},{disabled:!!report||!job.canUndo});
    button(bar,'다시실행',async()=>{const lease=serial;cleanRequired();await client.undoComposition(job.id,{draftVersion:job.draftVersion,redo:true});current(lease);await reload();current(lease);feedback('구성과 문항을 다시 적용했어요');},{disabled:!!report||!job.canRedo});
    bar.append(node('span',`${job.drafts.length}문항 · 미분류 ${job.composition.unassigned.length} · 제외 ${job.composition.excluded.length}`));content.append(bar);
    if(report){renderResults();return;}
    renderRequest();const workspace=node('div',undefined,'cmp-workspace');
    renderDestinations(workspace);renderQuestions(workspace);renderDetail(workspace);content.append(workspace);
    renderProposal();renderAdoption();
  }
  function renderRequest(){
    const panel=node('section',undefined,'cmp-request'),opts=job.composition.settings||{};
    const preset=select(panel,'분류 기준',[['books','권수에 맞춰 나누기'],['units','단원별'],['difficulty','난이도별'],['points','배점별'],['chunks','문항 수씩 나누기']],opts.preset||'books');
    const count=field(panel,'원하는 권수',opts.count||1,{type:'number'});count.min='1';count.max='100';
    const size=field(panel,'권당 목표 문항 수',opts.size||20,{type:'number'});size.min='1';size.max='500';
    const request=field(panel,'구성 요청',opts.request||'');request.placeholder='단원별로 5권 / 20문항씩';request.maxLength=2000;
    button(panel,'새 구성안 미리보기',async()=>{
      cleanRequired();const settings=requestSettings({preset:preset.value,count:Number(count.value),size:Number(size.value),request:request.value});
      const next=global.PedagogyComposition.propose(job,settings);
      proposal={...next,draftVersion:job.draftVersion};renderWorkspace();feedback('새 구성안은 아직 적용하지 않았어요 · 수동 수정한 본문은 유지됩니다');
    });panel.append(node('p','단순 분류·이동은 AI 호출 0회입니다. 꼬리표가 없거나 묶음 안의 분류가 다르면 미분류로 남깁니다.'));content.append(panel);
  }
  function renderDestinations(parent){
    const panel=node('section',undefined,'cmp-destinations');panel.setAttribute('aria-label','목적지 문제집');panel.append(node('h3','목적지'));
    options().forEach(([id,name])=>{
      const b=button(panel,`${name} · ${bucketItems(id).length}`,async()=>{cleanRequired();bucketId=id;selectedId=bucketItems(id)[0]||null;clearSource();renderWorkspace();});
      b.setAttribute('aria-pressed',String(id===bucketId));
    });
    const name=field(panel,'새 목적지 이름','');name.maxLength=100;
    button(panel,'목적지 추가',async()=>{const lease=serial;
      cleanRequired();const plan=copy(job.composition),id=crypto.randomUUID();plan.destinations.push({id,name:name.value,items:[]});
      bucketId=id;await persist(plan);current(lease);
    });
    const dest=job.composition.destinations.find(d=>d.id===bucketId);
    if(dest){
      const rename=field(panel,'선택 목적지 이름',dest.name);rename.maxLength=100;
      button(panel,'목적지 이름 저장',async()=>{const lease=serial;cleanRequired();const plan=copy(job.composition);plan.destinations.find(d=>d.id===dest.id).name=rename.value;await persist(plan);current(lease);});
      button(panel,'빈 목적지 삭제',async()=>{const lease=serial;cleanRequired();const plan=copy(job.composition);plan.destinations=plan.destinations.filter(d=>d.id!==dest.id);bucketId='unassigned';await persist(plan);current(lease);},{disabled:!!dest.items.length});
    }parent.append(panel);
  }
  function renderQuestions(parent){
    const panel=node('section',undefined,'cmp-questions');panel.setAttribute('aria-label','구성 문항');panel.append(node('h3','문항'));
    const ids=bucketItems(bucketId),byId=new Map(job.drafts.map(d=>[d.id,d]));
    if(!ids.length)panel.append(node('p','이 목적지에는 아직 문항이 없어요.'));
    ids.forEach(id=>{
      const draft=byId.get(id),group=job.groups.find(g=>g.members.includes(id));
      const title=draft.problem.title||global.PedagogyRender.blockExcerpt(draft.problem.blocks?.[0])||'제목 없음';
      const b=button(panel,`${job.drafts.findIndex(d=>d.id===id)+1}. ${title}${group?' · 지문 묶음':''}`,async()=>{cleanRequired();selectedId=id;clearSource();renderWorkspace();});
      b.setAttribute('aria-pressed',String(id===selectedId));b.title=draft.originalSetName||'';
    });parent.append(panel);
  }
  function renderDetail(parent){
    const panel=node('section',undefined,'cmp-detail');panel.setAttribute('aria-label','문항 상세');panel.append(node('h3','문항 상세'));
    const draft=job.drafts.find(d=>d.id===selectedId);if(!draft){panel.append(node('p','문항을 선택하면 본문과 원문을 볼 수 있어요.'));parent.append(panel);return;}
    const problem=draft.problem,group=job.groups.find(g=>g.members.includes(draft.id));
    panel.append(node('p',draft.originalSetName?`${draft.originalSetName} · ${draft.ordinal||''}번에서 가져온 독립 사본`:'AI 추출 초안 · 본문과 분류 확인 필요'));
    if(group)panel.append(node('p',`공통지문 ${group.members.length}문항을 함께 옮기고 제외합니다.`));
    const destination=select(panel,'문항 목적지',options(),bucketId);
    button(panel,'이 목적지로 이동',async()=>{const lease=serial;cleanRequired();bucketId=destination.value;await persist(global.PedagogyComposition.move(job,job.composition,draft.id,bucketId));current(lease);});
    const order=node('div',undefined,'cmp-toolbar');
    for(const [text,step] of [['앞으로',-1],['뒤로',1]])button(order,text,async()=>{const lease=serial;cleanRequired();await persist(global.PedagogyComposition.reorder(job,job.composition,draft.id,step));current(lease);});panel.append(order);
    const preview=node('div',undefined,'cmp-preview');
    preview.innerHTML=global.PedagogyRender.groupHeadHTML(problem,'')+problem.blocks.map(block=>global.PedagogyRender.blockHTML(block,{subject:draft.subject||'math'})).join('');
    bridge.math(preview);panel.append(preview);
    panel.append(node('p',`본문 ${reviewLabel(problem.intake?.contentReview)} · 분류 ${reviewLabel(problem.intake?.classificationReview)}`));
    renderEdit(panel,draft);renderSources(panel,draft);parent.append(panel);
  }
  function reviewLabel(value){return value==='reviewed'?'확인됨':value==='unreviewed'?'확인 필요':'확인 여부 모름';}
  function renderEdit(panel,draft){
    const p=draft.problem,form=node('div',undefined,'cmp-edit');
    const titleInput=field(form,'문항 제목',p.title),answer=field(form,'정답',p.answer,{multiline:true});
    const desc=field(form,'문항 설명',p.desc,{multiline:true});
    const units=field(form,'단원 (쉼표로 구분)',p.intake?.units?.map(x=>x.value).join(', ')||'');
    const difficulty=field(form,'난이도 (모르면 비움)',p.intake?.difficulty?.value||'');
    const points=field(form,'배점 (없으면 비움)',p.intake?.points??'',{type:'number'});points.min='0';
    const blocks=copy(p.blocks),editors=textLeaves(blocks).map((leaf,i)=>({...leaf,input:field(form,`본문 ${i+1}`,leaf.value,{multiline:true})}));
    form.addEventListener('input',changed);form.addEventListener('change',changed);
    button(form,'문항 수정 저장',async()=>{const lease=serial;
      editors.forEach(({path,input})=>{let target=blocks;for(const key of path.slice(0,-1))target=target[key];target[path.at(-1)]=input.value;});
      const changes={title:titleInput.value,answer:answer.value,desc:desc.value,blocks};
      // Do not replace original model provenance merely by saving a body edit.
      if(units.value!==(p.intake?.units?.map(x=>x.value).join(', ')||''))changes.units=units.value.split(',').map(x=>x.trim()).filter(Boolean);
      if(difficulty.value!==(p.intake?.difficulty?.value||''))changes.difficulty=difficulty.value||null;
      if(points.value!==String(p.intake?.points??'')){changes.points=points.value===''?null:Number(points.value);changes.pointsState=points.value===''?'absent':'read';}
      await persist(job.composition,[{id:draft.id,changes}]);current(lease);
    },{accent:true});
    button(form,'문항 수정 되돌리기',async()=>{dirty=false;renderWorkspace();feedback('저장하지 않은 문항 수정을 되돌렸어요');});panel.append(form);
  }
  function renderSources(panel,draft){
    const ids=draft.sourceIds||[draft.sourceId].filter(Boolean);
    if(!ids.length){panel.append(node('p','이 문항에 연결된 원문이 없어요.'));return;}
    const box=node('div',undefined,'cmp-original');
    ids.forEach((id,i)=>button(panel,`원문 ${i+1} 열기`,async()=>{const lease=serial;
      clearSource();const token=sourceToken,source=await client.readSource(id);current(lease);
      if(!source.blob||!['available','unlinked'].includes(source.state))throw Error('이 브라우저에서 원문을 찾을 수 없어요');
      const view=await bridge.source(source.blob);
      if(!dialog.open||!sameSession()||token!==sourceToken){view.close();return;}sourceView=view;
      box.replaceChildren(node('p',source.name||'연결 원문'));
      const pages=draft.problem.intake?.sources?.find(x=>x.sourceId===id)?.pages||[1];
      const pageInput=field(box,'원문 쪽',pages[0]||1,{type:'number'});pageInput.min='1';pageInput.max=String(view.total);
      const output=node('div');box.append(output);
      const draw=async()=>{const lease=serial;const n=Number(pageInput.value);if(!Number.isInteger(n)||n<1||n>view.total)throw Error('원문 쪽 범위를 확인해 주세요');await drawSource(view,n,output,token);current(lease);};
      button(box,'원문 쪽 보기',draw);await draw();current(lease);
    }));panel.append(box);
  }
  async function drawSource(view,pageNumber,output,token){
    const lease=serial;
    if(view.kind==='image'){const img=node('img');img.src=view.url;img.alt='연결 원문';output.replaceChildren(img);return;}
    const page=await view.doc.getPage(pageNumber);current(lease);if(token!==sourceToken)return;
    const size=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,1000/size.width)}),canvas=node('canvas');
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`원문 ${pageNumber}쪽`);
    view.render=page.render({canvasContext:canvas.getContext('2d'),viewport});await view.render.promise;current(lease);if(token===sourceToken)output.replaceChildren(canvas);
  }
  function placementNames(plan){
    const map=new Map();plan.destinations.forEach(d=>d.items.forEach((x,index)=>map.set(x.draftId,`${d.name} ${index+1}번`)));
    for(const [key,label] of [['excluded','제외'],['unassigned','미분류']])plan[key].forEach(id=>map.set(id,label));
    return map;
  }
  function proposalChanges(panel,before,after){
    const old=placementNames(before),next=placementNames(after),details=node('details'),rows=node('ul');
    const changes=job.drafts.filter(d=>old.get(d.id)!==next.get(d.id));
    details.append(node('summary',`문항별 목적지·순서 변경 ${changes.length}건 보기`));
    changes.forEach(d=>rows.append(node('li',`${d.problem.title||'문항 '+(job.drafts.findIndex(x=>x.id===d.id)+1)}: ${old.get(d.id)} → ${next.get(d.id)}`)));
    details.append(rows);panel.append(details);
  }
  function renderProposal(){
    if(!proposal)return;const panel=node('section',undefined,'cmp-proposal');panel.setAttribute('aria-label','새 구성안 변경 확인');panel.append(node('h3','새 구성안 변경 확인'));
    const before=job.composition,after=proposal.plan;
    panel.append(node('p',`현재 ${before.destinations.length}권 → 제안 ${after.destinations.length}권 · 미분류 ${before.unassigned.length} → ${after.unassigned.length} · 제외 ${before.excluded.length} → ${after.excluded.length}`));
    const list=node('ul');after.destinations.forEach(d=>list.append(node('li',`${d.name} · ${d.items.length}문항`)));panel.append(list);
    proposalChanges(panel,before,after);
    proposal.warnings.forEach(text=>panel.append(node('p',text,'cmp-error')));
    const approve=check(panel,`요청한 권수와 다른 ${after.destinations.length}권으로 적용할게요`);
    const mismatch=after.settings.preset!=='chunks'&&after.destinations.length!==after.settings.count;approve.parentElement.hidden=!mismatch;
    button(panel,'새 구성안 적용',async()=>{const lease=serial;
      cleanRequired();if(mismatch&&!approve.checked)throw Error('권수 변경을 확인하거나 직접 목적지를 합쳐 주세요');
      await client.saveComposition(job.id,{draftVersion:proposal.draftVersion,plan:after});current(lease);proposal=null;bucketId=after.destinations[0]?.id||'unassigned';await reload();current(lease);feedback('새 구성안을 적용했어요 · 문항 본문은 유지했어요');
    },{accent:true});button(panel,'제안 닫기',async()=>{proposal=null;renderWorkspace();});content.append(panel);
  }
  function renderAdoption(){
    const panel=node('section',undefined,'cmp-adoption'),nonempty=job.composition.destinations.filter(d=>d.items.length);
    const partial=job.pages.some(p=>p.state!=='success'),confirmPartial=check(panel,'성공한 쪽의 문항만 먼저 만들게요');confirmPartial.parentElement.hidden=!partial;
    panel.append(node('p',`새 문제집 ${nonempty.length}권을 독립 사본으로 만듭니다. 제외 ${job.composition.excluded.length}문항은 초안에 남고, 기존 문제집은 바뀌지 않습니다.`));
    button(panel,`문제집 ${nonempty.length}권 만들기`,async()=>{const lease=serial;
      cleanRequired();global.PedagogyComposition.validate(job,job.composition,{complete:true});
      if(partial&&!confirmPartial.checked)throw Error('실패하거나 대기 중인 쪽이 있어요 · 성공한 쪽만 만들지 확인해 주세요');
      const nextReport=await client.adopt(job.id,{draftVersion:job.draftVersion,destinations:nonempty,partial});current(lease);report=nextReport;renderWorkspace();feedback('권별 결과를 확인해 주세요 · 새로고침해도 같은 결과로 이어집니다');
      const route=bridge.route(report);if(route.view==='editor'){close(true);bridge.editor(route.setId);}
    },{disabled:!nonempty.length||!!job.composition.unassigned.length,accent:true});content.append(panel);
  }
  function renderResults(){
    const panel=node('section',undefined,'cmp-results');panel.append(node('h3','만들기 결과'));
    const status={ack:'계정 저장 확인됨',pending:'계정 저장 대기',tooBig:'클라우드 크기 초과 · 이 기기 보존',error:'계정 저장 실패 · 이 기기 보존',conflict:'충돌 확인 필요',check:'저장 상태 확인 필요'};
    report.results.forEach(result=>{
      const row=node('div',undefined,'cmp-result');row.append(node('strong',result.name));
      const local=result.state==='local';let text=local?'이 기기 저장됨':({failed:'이 기기 저장 실패',deleted:'삭제된 결과 · 다시 만들지 않음',check:'라이브러리 확인 필요',mapped:'저장 재시도 필요'}[result.state]||result.state);
      if(local)text+=' · '+(bridge.signedIn()?status[result.cloud]||'계정 상태 확인 필요':'로그인 전 · 이 기기에만 저장');
      row.append(node('p',text));button(row,'편집기 열기',async()=>{close(true);bridge.editor(result.setId);},{disabled:!local});panel.append(row);
    });
    button(panel,'저장 상태 새로 확인',async()=>{const lease=serial;const nextReport=await client.adoptionStatus(report.adoption.id);current(lease);report=nextReport;renderWorkspace();feedback('권별 저장 상태를 다시 확인했어요');});
    button(panel,'실패한 저장 다시 시도',async()=>{const lease=serial;
      const nextReport=await client.adopt(job.id,{adoptionId:report.adoption.id,draftVersion:report.adoption.draftVersion});current(lease);report=nextReport;renderWorkspace();feedback('기존 결과 ID로 저장을 다시 확인했어요');
    },{disabled:!report.results.some(r=>['failed','mapped'].includes(r.state))});
    const direct=check(panel,'다음부터 한 권이면 바로 편집기로 가기');direct.checked=bridge.readPrefs();direct.onchange=()=>{if(!bridge.writePrefs(direct.checked))feedback('이 브라우저에 설정을 저장하지 못했어요',true);};
    const taken=new Set(report.adoption.results.flatMap(r=>r.items.map(x=>x.draftId))),remaining=job.drafts.filter(d=>!taken.has(d.id)).map(d=>d.id);
    panel.append(node('p',`미채택 ${remaining.length}문항은 새 구성으로 넘길 수 있어요. 만들기 시작 후 이 구성과 추가 유료 처리는 고정됩니다.`));
    button(panel,'미채택 문항으로 새 구성',async()=>{const lease=serial;const next=await client.forkComposition(job.id,{draftVersion:job.draftVersion,draftIds:remaining});current(lease);await reload(next.jobId);current(lease);feedback('미채택 문항만 새 구성으로 넘겼어요 · AI 호출 없음');},{disabled:!remaining.length});content.append(panel);
  }
  return Object.freeze({open,close,sessionChanged(){if(dialog.open&&!sameSession())close(true);}});
}
global.PedagogyCompositionUI=Object.freeze({create});
})(globalThis);
