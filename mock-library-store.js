/* 모의고사 라이브러리 저장 계층 — `docs/MOCK-LIBRARY-DESIGN.md` 의 저장 모델.
   설계는 `HANDOFF-2026-089`(Codex)가 확정했고 이 파일이 그 1단계다.

   ⚠️ **평범한 고전 스크립트다(ESM 아님).** `file://` 에서 그대로 돌아야 한다 —
      본체·모의고사 편집기가 파일로 열려도 동작해야 하고 `test:review-contracts` 가 본다.
   ⚠️ **`serve.py` 의 `STATIC` 에 이 파일이 있어야 한다.** 빼면 로컬에서 404 다.

   왜 문제집 `sets` 배열에 섞지 않았나 — 스키마·출력 엔진·이미지 수명·저장 정책이
   전부 달라서, 한 배열에 넣으면 정규화·클라우드 병합·삭제 계약까지 결합된다.

   ⚠️ **문항 속까지 정규화하지 않는다.** 모의고사 문항의 화이트리스트는 편집기의
      `sanitize(blank(n), p)` 한 곳에만 있고, 여기서 그것을 옮겨 적으면 **사본이
      갈라진다**(이 저장소에서 반복된 실패 방식 3번). 그래서 이 계층은 개수·모양
      (객체인가)·이름·선택과목만 고정하고, 문항 내용은 편집기가 `applyData()` 에서
      정규화한다. **문항을 화면에 그리는 경로를 새로 만들면 그 전제가 깨진다.** */
(function(global){
'use strict';

var V=1;
var NAME_MAX=80;
var MAX_ENTRIES=200;      /* 카드 개수 상한 — 가져온 .json 하나로 화면이 멈추지 않게 */
var MAX_PROBLEMS=60;      /* 편집기 slot 상한과 같다 (blank(n) 30~60) */
var ELECTIVES=['확률과 통계','미적분','기하'];
var LEGACY_KEY='MOCK_DRAFT_V1';

function str(v,max){ return typeof v==='string' ? v.slice(0,max) : ''; }
function num(v,dflt){ return (typeof v==='number' && isFinite(v) && v>=0) ? v : dflt; }

/* id 는 저장 키가 아니라 값이지만, 화면 selector·`data-` 속성에 들어가므로
   모양을 고정한다(가져온 .json 의 임의 문자열을 그대로 쓰지 않는다). */
var ID_RE=/^mock_[A-Za-z0-9]{6,32}$/;
/* ⚠️ **crypto 가 없을 때도 서로 달라야 한다.** 처음에는 `getRandomValues` 가 없으면
   영바이트 배열을 그대로 썬서 **모든 id 가 `mock_00000000` 으로 같았다** — 같은 id 가
   둘이면 카드 하나를 열었는데 다른 것이 저장된다. 검사가 잡았다. */
function newId(){
  var r=Math.random().toString(36).slice(2)+Date.now().toString(36);
  try{
    if(global.crypto && global.crypto.getRandomValues){
      var a=new Uint8Array(6); global.crypto.getRandomValues(a);
      for(var i=0;i<a.length;i++) r+=a[i].toString(36);
    }
  }catch(e){}
  return 'mock_'+r.replace(/[^A-Za-z0-9]/g,'').slice(0,24);
}

function normElective(v){ return ELECTIVES.indexOf(v)>=0 ? v : ELECTIVES[0]; }

/* 하나의 모의고사 문서. `raw` 는 신뢰하지 않는다(가져온 파일·저장소·구형 임시본). */
function normMock(raw,opts){
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) return null;
  var o=opts||{};
  var now=(typeof o.now==='number')?o.now:Date.now();
  var problems=[];
  if(Array.isArray(raw.problems)){
    for(var i=0;i<raw.problems.length && problems.length<MAX_PROBLEMS;i++){
      var p=raw.problems[i];
      if(p && typeof p==='object' && !Array.isArray(p)) problems.push(p);
    }
  }
  var round=str(raw.round,NAME_MAX).trim();
  var name=str(raw.name,NAME_MAX).trim() || round || '새 모의고사';
  var id=(o.keepId && typeof raw.id==='string' && ID_RE.test(raw.id)) ? raw.id : newId();
  var created=num(raw.createdAt,now);
  return {v:V,id:id,name:name,round:round||name,elective:normElective(raw.elective),
          problems:problems,createdAt:created,updatedAt:num(raw.updatedAt,created)};
}

/* 저장소·파일에서 읽은 목록. 같은 id 가 둘이면 뒤엣것을 버린다 —
   id 로 문서를 찾는 곳이 많아 중복되면 엉뚱한 카드를 열게 된다. */
function normMockList(raw,opts){
  if(!Array.isArray(raw)) return [];
  var o=opts||{}, seen={}, out=[];
  for(var i=0;i<raw.length && out.length<MAX_ENTRIES;i++){
    var e=normMock(raw[i],{keepId:o.keepId!==false,now:o.now});
    if(!e) continue;
    if(seen[e.id]) continue;
    seen[e.id]=1; out.push(e);
  }
  return out;
}

function newMock(seed,now){
  var e=normMock(seed||{},{now:now});
  e.problems=[];                       /* 편집기가 자기 규칙(blank)으로 채운다 */
  return e;
}

/* 복제 — 새 id 를 발급하고 내용은 깊은 사본을 쓴다. 얕게 두면 원본과 복제본이
   같은 문항 객체를 공유해 한쪽 편집이 다른 쪽까지 바꾼다. */
function duplicateMock(entry,now){
  var src=normMock(entry,{keepId:true,now:now});
  if(!src) return null;
  var t=(typeof now==='number')?now:Date.now();
  var cp=JSON.parse(JSON.stringify(src));
  cp.id=newId();
  cp.name=(src.name||'모의고사').slice(0,NAME_MAX-3)+' 복제';
  cp.createdAt=t; cp.updatedAt=t;
  return cp;
}

function upsertMock(list,entry){
  var out=normMockList(list,{}), i;
  if(!entry || !entry.id) return out;
  for(i=0;i<out.length;i++) if(out[i].id===entry.id){ out[i]=entry; return out; }
  if(out.length>=MAX_ENTRIES) return out;      /* 상한 초과는 조용히 늘리지 않는다 */
  out.push(entry); return out;
}
function removeMock(list,id){
  return normMockList(list,{}).filter(function(e){ return e.id!==id; });
}
function findMock(list,id){
  var out=Array.isArray(list)?list:[];
  for(var i=0;i<out.length;i++) if(out[i] && out[i].id===id) return out[i];
  return null;
}

var SORTS=['updated','created','name'];
function sortMocks(list,mode){
  var out=(Array.isArray(list)?list:[]).slice();
  var m=SORTS.indexOf(mode)>=0?mode:'updated';
  out.sort(function(a,b){
    if(m==='name') return String(a.name||'').localeCompare(String(b.name||''),'ko');
    return (b[m==='created'?'createdAt':'updatedAt']||0)-(a[m==='created'?'createdAt':'updatedAt']||0);
  });
  return out;
}

/* ── 저장 어댑터 ──────────────────────────────────────────────────────────
   ⚠️ **저장소 접근은 던질 수 있다**(사파리 '모든 쿠키 차단' 등 · `REV-2026-022`).
      맨몸으로 부르면 예외 하나로 그 뒤 줄이 전부 안 돈다. 전부 감싸고 결과로 답한다.
   ⚠️ **키는 계정별이다.** 공용 키로 두면 한 브라우저에서 계정을 바꿨을 때 자료가 샌다. */
function ownerOf(owner){
  var s=str(owner,64).replace(/[^A-Za-z0-9_.:-]/g,'');
  return s||'guest';
}
function keysFor(owner){
  var o=ownerOf(owner);
  return {list:'PM_MOCK_SETS_V1:'+o, last:'PM_MOCK_LAST_V1:'+o, migrated:'PM_MOCK_MIGRATED_V1:'+o};
}
function store(s){ return s || (global.localStorage); }

function readMocks(owner,s){
  var k=keysFor(owner), st=store(s), raw=null;
  try{ raw=st.getItem(k.list); }
  catch(e){ return {ok:false,list:[],error:e}; }
  if(!raw) return {ok:true,list:[]};
  try{ return {ok:true,list:normMockList(JSON.parse(raw),{})}; }
  catch(e){ return {ok:false,list:[],error:e,corrupt:true}; }
}
function writeMocks(owner,list,s){
  var k=keysFor(owner), st=store(s);
  try{ st.setItem(k.list, JSON.stringify(normMockList(list,{}))); return {ok:true}; }
  catch(e){ return {ok:false,error:e}; }
}
function readLastMock(owner,s){
  try{ return str(store(s).getItem(keysFor(owner).last),64)||''; }catch(e){ return ''; }
}
function writeLastMock(owner,id,s){
  try{
    var st=store(s), k=keysFor(owner).last;
    if(id) st.setItem(k,String(id)); else st.removeItem(k);
    return {ok:true};
  }catch(e){ return {ok:false,error:e}; }
}

/* ── 구형 임시본(`MOCK_DRAFT_V1`) 이전 ───────────────────────────────────
   설계의 다섯 조건을 그대로 지킨다.
   ⚠️ **구형 키를 여기서 지우지 않는다.** 새 저장을 다시 읽어 같은지 확인한 뒤에도
      한 릴리스 동안 남긴다 — 이전이 잘못돼도 사용자가 예전 것을 꺼낼 수 있어야 한다.
   ⚠️ **멱등해야 한다.** 마커와 '목록이 비어 있을 때만' 두 조건을 함께 본다.
      한쪽만 두면 마커 저장이 실패한 브라우저에서 카드가 매번 하나씩 늘어난다. */
function migrateLegacyDraft(owner,s,now){
  var k=keysFor(owner), st=store(s);
  try{ if(st.getItem(k.migrated)) return {status:'already'}; }
  catch(e){ return {status:'error',error:e}; }

  var cur=readMocks(owner,st);
  if(!cur.ok) return {status:'error',error:cur.error};
  if(cur.list.length) return {status:'skip'};

  var raw=null;
  try{ raw=st.getItem(LEGACY_KEY); }catch(e){ return {status:'error',error:e}; }
  if(!raw) return {status:'none'};
  var d=null;
  try{ d=JSON.parse(raw); }catch(e){ return {status:'corrupt',error:e}; }
  if(!d || !Array.isArray(d.problems) || !d.problems.length) return {status:'none'};

  var t=(typeof now==='number')?now:Date.now();
  var entry=normMock({name:'복구된 모의고사',round:d.round,elective:d.elective,
                      problems:d.problems,createdAt:num(d.savedAt,t),updatedAt:num(d.savedAt,t)},{now:t});

  var w=writeMocks(owner,[entry],st);
  if(!w.ok) return {status:'error',error:w.error};

  /* 3. 다시 읽어 같은지 확인한 뒤에만 마커를 남긴다. */
  var back=readMocks(owner,st);
  if(!back.ok || back.list.length!==1 || back.list[0].id!==entry.id ||
     back.list[0].problems.length!==entry.problems.length){
    return {status:'error',error:new Error('이전 결과를 다시 읽지 못했습니다')};
  }
  try{ st.setItem(k.migrated,String(t)); }
  catch(e){ return {status:'unmarked',entry:back.list[0],error:e}; }
  return {status:'done',entry:back.list[0]};
}

var API={
  V:V, NAME_MAX:NAME_MAX, MAX_ENTRIES:MAX_ENTRIES, MAX_PROBLEMS:MAX_PROBLEMS,
  ELECTIVES:ELECTIVES, SORTS:SORTS, LEGACY_KEY:LEGACY_KEY,
  newId:newId, normMock:normMock, normMockList:normMockList, newMock:newMock,
  duplicateMock:duplicateMock, upsertMock:upsertMock, removeMock:removeMock,
  findMock:findMock, sortMocks:sortMocks,
  keysFor:keysFor, readMocks:readMocks, writeMocks:writeMocks,
  readLastMock:readLastMock, writeLastMock:writeLastMock,
  migrateLegacyDraft:migrateLegacyDraft
};
global.MockLibraryStore=API;
})(typeof window!=='undefined'?window:globalThis);
