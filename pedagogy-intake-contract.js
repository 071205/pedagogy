/* B6 task schema, shared by browser and Worker. No legacy AI schema changes. */
(function(global){
'use strict';
const TASK='problem-intake-v1';
const PROMPT=`한국 시험지 한 쪽에서 보이는 문항만 추출한다. 설명 없이 JSON 하나를 반환한다.
{"task":"problem-intake-v1","problems":[{"title":"","answer":"","blocks":[{"type":"statement","text":""}],"units":[],"difficulty":null,"points":null,"pointsState":"absent","group":null}]}
blocks type: statement, boxed (text), conditions, examples, choices (items).
수식은 $...$ 또는 $$...$$ LaTeX. units는 단원 문자열 배열, difficulty는 문자열 또는 null.
배점은 읽힌 숫자만 points에 넣는다. 없으면 absent, 판독 불가면 unreadable. 추측하지 않는다.
공통지문은 첫 문항의 statement에 포함하고 같은 쪽의 모든 구성원에 같은 group 문자열을 넣는다.
다른 쪽까지 이어지는 지문이나 그림/표를 텍스트로 보존할 수 없으면 unsupported를 true로 넣는다.
정답은 보이는 경우만 쓴다. 미확인 상태를 확인 완료로 바꾸지 않는다.`;
const LIMIT_KEYS=['files','fileBytes','totalBytes','pages','minDimension','maxDimension','imageBytes','requestBytes','calls','retries','problemsPerPage','problemsPerJob','problemsPerSet','fieldChars','blocks','items'];
function limits(v){
  if(!v || LIMIT_KEYS.some(k=>!Number.isSafeInteger(v[k])||v[k]<1)
    || v.minDimension>v.maxDimension || v.pages>500 || v.problemsPerSet>500 || v.blocks>50 || v.items>100) throw Error('처리 한도 설정 필요');
  return Object.fromEntries(LIMIT_KEYS.map(k=>[k,v[k]]));
}
function validateResponse(raw,config){
  const cap=limits(config);
  const text=(v,nullable=false)=>nullable&&v===null?null:typeof v==='string'&&v.length<=cap.fieldChars?v:(()=>{throw Error('추출 텍스트 형식/한도 오류');})();
  if(!raw || raw.task!==TASK || !Array.isArray(raw.problems) || !raw.problems.length
    || raw.problems.length>cap.problemsPerPage) throw Error('추출 문항 수/스키마 오류');
  return raw.problems.map(p=>{
    if(!p || p.unsupported===true || !Array.isArray(p.blocks) || !p.blocks.length || p.blocks.length>cap.blocks
      || !p.blocks.some(b=>b.type==='statement')) throw Error('본문/그림/쪽 경계 확인 필요');
    const blocks=p.blocks.map(b=>{
      if(['statement','boxed'].includes(b.type)) return {type:b.type,text:text(b.text)};
      if(!['conditions','examples','choices'].includes(b.type)||!Array.isArray(b.items)
        || !b.items.length||b.items.length>cap.items || (b.type==='choices'&&b.items.length!==5)) throw Error('블록 형식 오류');
      return {type:b.type,items:b.items.map(x=>text(x))};
    });
    if(!Array.isArray(p.units)||p.units.length>30 || !['read','absent','unreadable'].includes(p.pointsState)
      || (p.points!==null&&(!Number.isFinite(p.points)||p.points<0))
      || (p.pointsState==='read')!==(p.points!==null)) throw Error('분류/배점 형식 오류');
    if(p.title?.length>300||p.answer?.length>5000||p.units.some(x=>typeof x!=='string'||x.length>120)||p.difficulty?.length>80)throw Error('분류/제목 길이 한도 오류');
    return {title:text(p.title),answer:text(p.answer),blocks,units:p.units.map(x=>text(x)),
      difficulty:text(p.difficulty,true),points:p.points,pointsState:p.pointsState,group:text(p.group,true)};
  });
}
global.PedagogyIntakeContract=Object.freeze({TASK,PROMPT,LIMIT_KEYS,limits,validateResponse});
})(globalThis);
