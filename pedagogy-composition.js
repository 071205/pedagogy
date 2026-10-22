/* U2 composition rules. Pure planning: no AI calls or library writes. */
(function(global){
'use strict';
const copy=value=>structuredClone(value);
const newId=()=>crypto.randomUUID();
const fail=message=>{throw Error(message);};
const PRESETS=['units','difficulty','points','books','chunks'];
function settings(value={}){
  const preset=PRESETS.includes(value.preset)?value.preset:'books';
  const count=Number(value.count??1),size=Number(value.size??20);
  if(!Number.isSafeInteger(count)||count<1||count>100
    ||!Number.isSafeInteger(size)||size<1||size>500)fail('권수는 1~100, 권당 문항 수는 1~500으로 입력해 주세요');
  return {preset,count,size,request:String(value.request||'').slice(0,2000)};
}
function validate(job,plan,{complete=false}={}){
  if(!plan||!Array.isArray(plan.destinations)||!Array.isArray(plan.excluded)||!Array.isArray(plan.unassigned))
    fail('구성안 형식을 확인해 주세요');
  const known=new Set(job.drafts.map(d=>d.id)),seen=new Map(),placements=new Set(),destIds=new Set();
  const take=(draftId,bucket,index)=>{
    if(!known.has(draftId)||seen.has(draftId))fail('문항이 누락되거나 중복된 구성이에요');
    seen.set(draftId,{bucket,index});
  };
  const destinations=plan.destinations.map(destination=>{
    if(typeof destination.id!=='string'||!destination.id||['excluded','unassigned'].includes(destination.id)||destination.id.length>100||destIds.has(destination.id)
      ||typeof destination.name!=='string'||!destination.name.trim()||destination.name.length>100
      ||!Array.isArray(destination.items)||destination.items.length>500)fail('목적지 이름이나 500문항 한도를 확인해 주세요');
    destIds.add(destination.id);
    const items=destination.items.map((item,index)=>{
      if(typeof item.placementId!=='string'||!item.placementId||item.placementId.length>100||placements.has(item.placementId))
        fail('문항 배치 식별자가 중복되었어요');
      placements.add(item.placementId);take(item.draftId,destination.id,index);
      return {draftId:item.draftId,placementId:item.placementId};
    });
    return {id:destination.id,name:destination.name.trim(),items};
  });
  for(const bucket of ['excluded','unassigned'])plan[bucket].forEach((id,index)=>take(id,bucket,index));
  if(seen.size!==known.size)fail('모든 문항의 목적지·제외·미분류 처리를 확인해 주세요');
  for(const group of job.groups){
    const positions=group.members.map(id=>seen.get(id));
    if(positions.some(p=>!p)||positions.some((p,index)=>p.bucket!==positions[0].bucket||p.index!==positions[0].index+index))
      fail('공통지문은 실제 구성원 순서대로 함께 옮기거나 제외해 주세요');
  }
  if(complete&&(plan.unassigned.length||!destinations.some(d=>d.items.length)))
    fail('미분류 문항의 목적지를 고르고 한 권 이상 구성해 주세요');
  return {destinations,excluded:copy(plan.excluded),unassigned:copy(plan.unassigned),settings:settings(plan.settings)};
}
function atoms(job){
  const byMember=new Map();
  for(const group of job.groups)for(const id of group.members)byMember.set(id,group.members);
  const seen=new Set(),out=[];
  for(const draft of job.drafts){
    if(seen.has(draft.id))continue;
    const members=byMember.get(draft.id)||[draft.id];
    members.forEach(id=>seen.add(id));out.push(members);
  }
  return out;
}
function metadata(draft){
  if(draft.problem){
    const intake=draft.problem.intake;
    return {units:intake?.units?.map(x=>x.value)||[],difficulty:intake?.difficulty?.value??null,
      points:intake?.points??null,pointsState:intake?.pointsState||'absent'};
  }
  return draft.raw;
}
function label(draft,preset){
  const data=metadata(draft);
  if(preset==='units')return data.units.length===1?data.units[0]:null;
  if(preset==='difficulty')return data.difficulty;
  return data.pointsState==='read'&&Number.isFinite(data.points)&&data.points>=0?String(data.points)+'점':null;
}
function propose(job,value){
  const opts=settings(value),plan={destinations:[],excluded:[],unassigned:[],settings:opts};
  const warnings=[],byId=new Map(job.drafts.map(d=>[d.id,d]));
  const buckets=new Map();
  const bucket=name=>{
    if(!buckets.has(name)){
      const destination={id:newId(),name,items:[]};buckets.set(name,destination);plan.destinations.push(destination);
    }
    return buckets.get(name);
  };
  const size=opts.preset==='chunks'?opts.size:Math.ceil(job.drafts.length/opts.count);
  let number=1;
  for(const members of atoms(job)){
    let name;
    if(['books','chunks'].includes(opts.preset)){
      const current=buckets.get('문제집 '+number);
      if(current?.items.length&&current.items.length+members.length>size
        &&(opts.preset==='chunks'||number<opts.count))number++;
      name='문제집 '+number;
    }else{
      const labels=members.map(id=>label(byId.get(id),opts.preset));
      name=labels[0]&&labels.every(x=>x===labels[0])?labels[0]:null;
    }
    if(!name){plan.unassigned.push(...members);continue;}
    bucket(name).items.push(...members.map(draftId=>({draftId,placementId:newId()})));
  }
  if(plan.destinations.length!==opts.count&&opts.preset!=='chunks')
    warnings.push(`요청 ${opts.count}권과 달리 ${plan.destinations.length}권 구성입니다. 합칠 기준을 고르거나 권수 변경을 확인해 주세요.`);
  if(plan.unassigned.length)warnings.push(`미분류 ${plan.unassigned.length}문항의 목적지를 골라 주세요. 배점 없음은 난이도로 대신하지 않습니다.`);
  if(plan.destinations.some(d=>d.items.length>500))warnings.push('500문항을 넘는 권을 나눠 주세요.');
  return {plan,warnings};
}
function move(job,current,draftId,destinationId){
  const plan=copy(current),members=atoms(job).find(ids=>ids.includes(draftId));
  if(!members)fail('이동할 문항이 없어요');
  const moving=new Set(members),oldItems=plan.destinations.flatMap(d=>d.items);
  plan.destinations.forEach(d=>{d.items=d.items.filter(x=>!moving.has(x.draftId));});
  plan.excluded=plan.excluded.filter(id=>!moving.has(id));plan.unassigned=plan.unassigned.filter(id=>!moving.has(id));
  if(['excluded','unassigned'].includes(destinationId))plan[destinationId].push(...members);
  else{
    const target=plan.destinations.find(d=>d.id===destinationId);
    if(!target)fail('목적지 문제집을 골라 주세요');
    target.items.push(...members.map(id=>oldItems.find(x=>x.draftId===id)||{draftId:id,placementId:newId()}));
  }
  return validate(job,plan);
}
function reorder(job,current,draftId,step){
  const plan=copy(current),destination=plan.destinations.find(d=>d.items.some(x=>x.draftId===draftId));
  if(!destination)return plan;
  const chunks=atoms({...job,drafts:destination.items.map(x=>job.drafts.find(d=>d.id===x.draftId))});
  const index=chunks.findIndex(ids=>ids.includes(draftId)),next=index+Math.sign(step);
  if(index<0||next<0||next>=chunks.length)return plan;
  [chunks[index],chunks[next]]=[chunks[next],chunks[index]];
  const items=new Map(destination.items.map(x=>[x.draftId,x]));
  destination.items=chunks.flat().map(id=>items.get(id));return validate(job,plan);
}
global.PedagogyComposition=Object.freeze({settings,validate,atoms,propose,move,reorder});
})(globalThis);
