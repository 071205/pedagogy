/* PEDAGOGY 신뢰 경계 — 정규화 (`index.html` 에서 떼어 냈다 · 구조 1단계)
 *
 * 가져온 `.json`, AI 응답, 클라우드에서 읽은 데이터가 **전부 여기를 지난다.**
 * 화이트리스트로 필드를 뽑고 타입·열거값·길이를 강제한다 — 이 단계에서 걸러야
 * 렌더가 예상 못 한 값에 닿지 않는다.
 *
 * ⚠️ **평범한 고전 스크립트다**(ESM 아님). `file://` 에서 그대로 실행되고, 그것이
 *    "파일을 열어서 쓴다" 는 이 저장소의 전제를 지키는 이유다.
 * ⚠️ **`serve.py` 의 `STATIC` 목록에 이 파일이 있어야 한다** — 빼면 로컬에서 404 다.
 * ⚠️ **자기 출처 파일이라 CSP `script-src 'self'` 로 이미 허용된다.** SRI 는 붙이지
 *    않는다(배포마다 해시가 바뀌어 관리 비용만 는다).
 *
 * 모듈 안에 두는 것과 본체에 남긴 것 (HANDOFF-2026-073 의 검토 조건):
 *   · 의존 상수(`BLOCK_TYPES` `SUBJECTS` `SHEET_COLORS` `LIB_SORTS` `IMG_HOSTS` …)는
 *     **모듈 내부 책임**이다. 밖에서도 쓰는 것만 내놓는다.
 *   · `uid()`(ID 발급)도 모듈 것이다 — `normProblem`·`normSet`·`normLibMeta` 가 쓴다.
 *   · 진단 집계(`normDropped`)는 **모듈 내부**이고 `droppedImages()` 로만 읽는다.
 *   · ⚠️ **`reportNormDropped()` 는 본체에 남았다** — `toast()` 로 화면을 건드리므로
 *     여기 두면 이 모듈이 UI 에 의존하게 된다. 순수한 집계만 여기 있다.
 */
(function(global){

const uid=()=>'q'+Math.random().toString(36).slice(2,9);
/* HTML 이스케이프. 따옴표까지 막아야 속성값(src="…", class="…") 안에서도 안전하다.
   & 를 가장 먼저 치환해야 이중 이스케이프가 생기지 않는다.
   KaTeX 는 textContent 를 읽으므로 &amp; → & 로 되돌아가 수식의 & (cases 정렬)도 그대로 동작한다. */
const sanitize=s=>(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
                         .replaceAll('"',"&quot;").replaceAll("'","&#39;");

/* 이미지 URL 화이트리스트. 가져온 문제집(.json)에 심어진 javascript: 나
   따옴표 탈출(" onerror=…)이 src 속성에 그대로 들어가는 것을 막는다.
   허용: Firebase Storage 다운로드 URL, data:image/* (비로그인 로컬 저장분) */
const IMG_HOSTS=new Set(["firebasestorage.googleapis.com","storage.googleapis.com"]);
function safeUrl(u){
  if(typeof u!=="string") return "";
  const s=u.trim();
  // data:image 는 그대로 허용
  if(/^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]*$/i.test(s))
    return s.replaceAll('"',"&quot;");
  // 접두어 비교(startsWith)는 firebasestorage.googleapis.com.evil.example 같은
  // 남의 호스트를 통과시킨다. 반드시 호스트를 통째로 대조한다.
  try{
    const url=new URL(s);
    if(url.protocol!=="https:") return "";
    if(!IMG_HOSTS.has(url.hostname)) return "";
    return s.replaceAll('"',"&quot;");
  }catch(e){ return ""; }
}

/* ===== 가져오기 정규화 =====
   남이 만든 .json 은 신뢰하지 않는다. 알고 있는 필드만 화이트리스트로 뽑아내고
   타입·열거값·길이를 강제한다. (모의고사 편집기의 sanitize() 와 같은 취지)
   이 단계에서 걸러야 렌더 단계에서 예상 못 한 값이 DOM 에 닿지 않는다. */
const BLOCK_TYPES=["statement","conditions","examples","boxed","choices","image",
                   "passage","bogi","dialogue","table","notice"];
/* ── 과목 ──
   문제집마다 과목을 두고 '블록 메뉴'만 거른다. 파일을 과목별로 쪼개지 않는 이유:
   저장·병합·인쇄·되돌리기·이미지·인증이 전부 공유라, 과목 전용 코드(200줄 남짓)를
   떼어내려고 기반 4,500줄을 복제하게 된다. 모의고사 편집기가 렌더 경로를 둘로
   가진 대가를 이미 치르고 있다(CLAUDE.md 참고).
   ⚠️ 여기는 '보여줄 목록' 일 뿐 방어선이 아니다 — 실제 검증은 normBlock 이 한다.
   그래서 과목을 바꿔도 이미 넣어 둔 블록은 사라지지 않는다. */
/* 안내문 상자의 줄 갈래 — 화이트리스트. 모르는 값은 보통 문단으로 떨어진다. */
const NOTICE_KINDS=["text","head","bullet","note"];
const SUBJECTS=[
  {v:"math",    name:"수학",
   blocks:["statement","conditions","examples","boxed","choices","image"]},
  {v:"korean",  name:"국어",
   blocks:["statement","passage","bogi","dialogue","table","examples","boxed","choices","image"]},
  {v:"english", name:"영어",
   blocks:["statement","passage","bogi","dialogue","notice","table","boxed","choices","image"]},
  {v:"inquiry", name:"탐구 (사회·과학)",
   blocks:["statement","conditions","examples","boxed","table","choices","image"]},
  {v:"all",     name:"제한 없음",  blocks:null},
];
const SUBJECT_DEFAULT="math";
function normSubject(v){ return SUBJECTS.some(s=>s.v===v)?v:SUBJECT_DEFAULT; }

/* 지문 종류 — 산문은 줄바꿈이 문단, 운문(시)은 줄바꿈이 행이다.
   같은 텍스트라도 조판이 완전히 달라서 한 값으로 못 묶는다. */
const PASSAGE_KINDS=["prose","verse"];
/* 선지 배치 — 실물 수능 영어는 네 가지를 다 쓴다(2025 수능 영어 실물 확인).
     5열  6번 "① $100 ② $150 …"      · 3열  8·17번
     2열  5·19·31·36번               · 세로  22·23·24·26·33·34·35번 (영어 선지 대부분)
   예전에는 5열(horizontal)과 세로뿐이라, 2·3열 문항은 만들 수 없었다. */
const SET_NAME_MAX=160;   // ↔ firestore.rules 의 name.size()
/* ⚠️ `paired` 는 **열 머리글이 있는 짝 선지**다(영어 어법·낱말·요약문).
   실물 근거: 2025 수능 40번(4×8 표 · 폭 108.09mm · `(A) (B)` 머리글 · `……` 이음 ·
   한 행에 선지 둘) · 2009 수능 어법/낱말((A)(B)(C) 세 짝).
   ⚠️ `cols2` 와 다르다 — `cols2` 는 선지 다섯을 두 열로 접는 것이고, `paired` 는
      **선지 하나가 여러 칸**이다. */
const CHOICE_LAYOUTS=["horizontal","cols3","cols2","vertical","paired"];
/* 짝 선지의 열 머리글. 실물은 (A)(B) 또는 (A)(B)(C) 뿐이라 그 둘만 받는다 —
   임의 문자열을 받으면 가져온 .json 이 화면에 아무 글이나 넣는다. */
const PAIR_HEADS={2:["(A)","(B)"],3:["(A)","(B)","(C)"]};
/* 짝 선지의 평문 — 내용을 훑는 곳(`blockExcerpt`·`setHasContent`)과 다른 배치로 바꿀 때
   쓰는 `items` 값이다. ⚠️ **파생하는 곳은 여기 하나여야 한다** — 편집기도 이것을 쓴다.
   가름표를 넣지 않는다(사용자 눈에 `|` 가 닿으면 안 된다). */
function pairedItemText(cells){
  return (Array.isArray(cells)?cells:[]).map(c=>String(c||"").trim()).filter(Boolean).join(" ");
}
const IMG_SIZES=["full","large","medium","small"];
const str=(v,max=20000)=>typeof v==="string"?v.slice(0,max):"";


function normBlock(b, opts={}){
  const lossless=opts.lossless===true;
  const text=(v,max)=>str(v,lossless?Infinity:max);
  if(!b||typeof b!=="object") return null;
  const type=BLOCK_TYPES.includes(b.type)?b.type:null;
  if(!type) return null;
  const d=(b.data&&typeof b.data==="object")?b.data:{};
  if(type==="statement") return {type,data:{text:text(d.text)}};
  /* ⚠️ `small` 은 **실물에서 온 것**이다(`HANDOFF-2026-104`). 탐구 실물은 제시문·자료를
     줄여 담는다 — 사회·문화의 자료 상자가 **9.5pt**(본문 11.5pt), 신문 자료 안에는
     8.0pt 도 섞여 있다. 반면 화학Ⅰ의 자료 상자는 **11.5pt** 로 본문과 같다.
     **하나로 정할 수 없어서 사용자가 정한다** — 과목으로 강제하면 둘 중 하나는 틀린다. */
  if(type==="boxed") return {type,data:{text:text(d.text), small:!!d.small}};
  /* 지문 — 국어·영어처럼 글 하나를 여러 문항이 함께 쓰는 형식.
     lead 는 "다음 글을 읽고 물음에 답하시오." 같은 안내문이다. 본문(text)은
     지문이라 길 수 있어 상한을 넉넉히 둔다(다른 텍스트 블록은 str 기본 상한). */
  if(type==="passage"){
    /* 2025 수능 국어 실물 기준 구조.
         · 안내문([22~27] 다음 글을 읽고…)은 상자 '밖' 위에 온다
         · 지문 본문은 테두리 안 — 기본이 상자다(독서·문학·소설 모두 그렇다)
         · (가)(나)(다) 복합 지문은 '상자 하나 안에' 나란히 들어간다 → parts
         · 각 조각은 출처(– 장석남, 「배를 밀며」 –)와 각주(* 치병: …)를 가진다
       예전 형식({text,kind,label})도 그대로 읽어 parts 하나로 옮긴다. */
    const raw=Array.isArray(d.parts)&&d.parts.length ? d.parts
              : [{label:d.label, kind:d.kind, text:d.text, source:d.source, notes:d.notes}];
    const parts=raw.slice(0,lossless?undefined:6).map(x=>{
      const o=(x&&typeof x==="object")?x:{};
      return { label:text(o.label,20),
               kind:PASSAGE_KINDS.includes(o.kind)?o.kind:"prose",
               text:text(o.text,20000),
               source:text(o.source,200),
               notes:text(o.notes,1000) };
    });
    return {type,data:{
      lead:text(d.lead,200),
      boxed:d.boxed!==false,          // 기본 상자 — 평가원 실물이 그렇다
      parts:parts.length?parts:[{label:"",kind:"prose",text:"",source:"",notes:""}]
    }};
  }
  /* <보기> — 국어에서 가장 자주 쓰는 상자. 상단 가운데에 라벨이 붙는다.
     라벨을 바꿀 수 있게 둔다(<자료>, <조건> 등으로도 쓰인다). */
  if(type==="bogi"){
    /* <보기>/<자료> 안에는 설명문 뒤에 표가 붙는 형식이 매우 흔하다.
       표 블록을 밖에 따로 두면 테두리 밖으로 밀려 나가 실제 시험지 구조가 깨진다.
       구형 보기 데이터(text·label만 가진 것)는 rows=[]로 그대로 호환한다. */
    const rows=(Array.isArray(d.rows)?d.rows:[]).slice(0,lossless?undefined:20).map(r=>
      (Array.isArray(r)?r:[]).slice(0,lossless?undefined:10).map(cell=>text(cell,300)));
    return {type,data:{text:text(d.text,5000), label:text(d.label,20)||"보 기",
                       rows, header:d.header!==false}};
  }
  /* 대화문 — 화법과 작문의 학생 대화, 매체의 방송 대화가 모두 이 모양이다.
     "학생 1 : 애들아, …" 처럼 말한이와 말이 콜론으로 갈리고, 다음 줄은
     말한이 칸이 아니라 '말' 아래로 들여쓴다(내어쓰기). */
  /* 안내문 상자 — 실물 영어 27·28번의 '다음 안내문' 형식.
     ⚠️ 실물에서는 이 상자가 **1×1 표 한 칸**이다(`ctrl=tbl` → TABLE → LIST_HEADER →
        그 안의 문단들). 한글에서 상자를 만드는 관용법일 뿐이라 우리는 CSS 테두리를 쓴다.
     줄은 네 갈래다(2025 수능 영어 28번을 그대로 읽어 확인):
       title  제목      Arial Black 11.0pt · 가운데
       text   도입문    11.5pt · 첫 줄 들여쓰기 3.70mm
       head   소제목    11.0pt · **bold=True**  ← 여기서는 실물도 굵게를 쓴다
       bullet 항목      11.5pt · 마커 `∙`(U+2219) · 내어쓰기 3.53mm
       note   ※ 줄     11.5pt · 소제목과 같은 문단 모양
     ⚠️ `∙` 와 `※` 는 **렌더가 붙인다** — 출처의 `–`, 각주의 `*` 와 같은 규칙이다.
     ⚠️ 표가 들어가는 27번 형식은 아직 못 만든다(상자 안 표는 계약에 없다). */
  if(type==="notice")
    return {type,data:{
      title:text(d.title,120),
      items:(Array.isArray(d.items)?d.items:[]).slice(0,lossless?undefined:60).map(it=>{
        const o=(it&&typeof it==="object")?it:{};
        return { kind:NOTICE_KINDS.includes(o.kind)?o.kind:"text", text:text(o.text,1000) };
      })}};
  if(type==="dialogue")
    return {type,data:{items:(Array.isArray(d.items)?d.items:[]).slice(0,lossless?undefined:60).map(it=>{
      const o=(it&&typeof it==="object")?it:{};
      return { who:text(o.who,40), text:text(o.text,3000) };
    })}};
  /* 표 — 언어와 매체의 조음 위치·방법 표처럼 격자가 필요한 문항용.
     행마다 칸 수가 달라도 렌더가 알아서 맞춘다(모자란 칸은 빈칸). */
  /* 표 — `title` 은 표 **안** 맨 위에 칸을 합쳐 놓는 제목 줄이다(실물 영어 10번의
     `Plant Seed Kits`). 안내문 상자와 같은 이름을 쓴다 — `blockExcerpt`·`setHasContent`
     가 이미 `d.title` 을 보므로 훑는 곳을 또 늘리지 않는다. */
  if(type==="table"){
    const rows=(Array.isArray(d.rows)?d.rows:[]).slice(0,lossless?undefined:30).map(r=>
      (Array.isArray(r)?r:[]).slice(0,lossless?undefined:10).map(cell=>text(cell,300)));
    /* ⚠️ **그림은 `rows` 와 같은 모양의 별도 배열**이다(`images[r][c]`).
       `rows` 를 객체 배열로 바꾸지 않는다 — 내용을 훑는 곳(`blockExcerpt`·`setHasContent`)이
       전부 문자열을 가정하고, 대화문 `items` 가 객체라서 겪은 사고가 그대로 재현된다.
       실물 근거: 화학Ⅰ의 그림 20개 중 **17개가 표 칸 안**에 있다(2×2 그림+라벨,
       5×5 자료표 안 그림 등). ⚠️ 두 배열은 **늘 함께 움직인다** — 한쪽만 splice 하면
       그림이 옆 칸으로 옮겨간다. */
    const imgs=(Array.isArray(d.images)?d.images:[]).slice(0,rows.length).map((r,i)=>
      (Array.isArray(r)?r:[]).slice(0,(rows[i]||[]).length).map(u=>safeUrl(u)));
    const finalRows=rows.length?rows:[["",""],["",""]];
    while(imgs.length<finalRows.length) imgs.push([]);
    /* 칸 합치기 — `spans[r][c] = [가로, 세로]`. 실물 자료표에 **7건** 있다(화학Ⅰ 5×5 가
       가로2·세로3 을 함께 쓰고, 영어 안내표가 세로3 을 쓴다).
       ⚠️ 값은 반드시 **정수로 조인다** — 가져온 `.json` 의 큰 값 하나가 표를 통째로
          망가뜨린다(렌더는 겹친 칸을 건너뛰므로 나머지 칸이 사라진다). */
    const spans=(Array.isArray(d.spans)?d.spans:[]).slice(0,finalRows.length).map((r,i)=>
      (Array.isArray(r)?r:[]).slice(0,(finalRows[i]||[]).length).map(v=>{
        const cs=Math.max(1,Math.min(20,Math.floor(+(Array.isArray(v)?v[0]:1))||1));
        const rs=Math.max(1,Math.min(30,Math.floor(+(Array.isArray(v)?v[1]:1))||1));
        return [cs,rs];
      }));
    while(spans.length<finalRows.length) spans.push([]);
    return {type,data:{rows:finalRows, header:d.header!==false,
                       title:text(d.title,120), small:!!d.small, images:imgs, spans:spans}};
  }
  if(type==="conditions"||type==="examples")
    return {type,data:{items:(Array.isArray(d.items)?d.items:[]).slice(0,lossless?undefined:20).map(t=>text(t)),
                       label:text(d.label,20)}};   // 비우면 라벨 없음, "보 기" 면 <보기> 상자
  /* 선지 — 글과 **그림**을 함께 가질 수 있다(교과서의 그래프 이동 문항처럼 선지가
     그림인 형식). `items` 는 **문자열 배열 그대로 둔다** — 원소를 객체로 바꾸면
     `convertBlock`(조건↔보기↔선지)과 내용을 훑는 곳들이 전부 터진다(CLAUDE.md).
     그래서 그림은 **같은 자리끼리 짝을 이루는 별도 배열**로 둔다.
     ⚠️ 두 배열은 늘 같은 길이여야 한다 — 한쪽만 splice 하면 그림이 옆 선지로 옮겨간다.
        길이를 여기서 못 박는 이유가 그것이다. */
  if(type==="choices"){
    const items=(Array.isArray(d.items)?d.items:[]).slice(0,lossless?undefined:5).map(t=>text(t));
    const raw=(Array.isArray(d.images)?d.images:[]).slice(0,lossless?undefined:5);
    const images=[];
    for(let i=0;i<5;i++){
      const u=safeUrl(raw[i]);
      if(!u && raw[i]) normDropped.images++;   // 가져온 .json 의 못 믿을 주소
      images.push(u||"");
    }
    while(items.length<images.length) items.push("");
    const layout=CHOICE_LAYOUTS.includes(d.layout)?d.layout:"horizontal";
    const pairs=(+d.pairs===3?3:2);   /* 짝의 개수(2 또는 3) — 실물에 그 둘뿐이다 */
    /* ── 짝 선지의 칸은 **별도 배열**이다(`HANDOFF-2026-111` §2 지적 반영) ──────────
       예전에는 `items` 안에 `|` 로 넣었다. 코덱스가 *"구분자 이스케이프보다
       `cells:string[]` 구조가 낫다"* 고 했고 맞다 — 낱말에 `|` 가 들어가면 깨진다.
       ⚠️ **`items` 는 그대로 문자열 배열로 남는다.** `convertBlock`(조건↔보기↔선지)과
          내용을 훑는 곳(`blockExcerpt`·`setHasContent`)이 전부 문자열을 가정한다.
          그래서 `cells` 는 `images` 처럼 **평행 배열**이고, `items` 는 거기서 파생된
          **평문**이다(가름표가 사용자 눈에 닿지 않는다).
       ⚠️ **파생이 한 곳에서만 일어나야 한다** — `pairedItemText()` 를 편집기도 같이 쓴다.
       ⚠️ 예전 데이터는 `items` 에 `|` 로 들어 있다. 여기서 **한 번 이관**한다. */
    let cells=Array.isArray(d.cells)
      ? d.cells.slice(0,lossless?undefined:5).map(r=>
          (Array.isArray(r)?r:[]).slice(0,pairs).map(v=>text(v)))
      : null;
    if(layout==="paired" && !cells)
      cells=items.map(t=>String(t||"").split("|").slice(0,pairs).map(x=>x.trim()));
    if(cells){
      while(cells.length<items.length) cells.push([]);
      cells.forEach(r=>{ while(r.length<pairs) r.push(""); });
    }
    const finalItems=(layout==="paired"&&cells) ? cells.map(pairedItemText) : items;
    return {type,data:{items:finalItems, images, layout, pairs,
                       ...(cells?{cells}:{})}};
  }
  // image — safeUrl 을 통과하지 못하는 주소는 아예 버린다.
  // 예전에는 이때 아무 말 없이 이미지가 사라져서, 남이 준 문제집을 가져오면
  // 그림만 통째로 없어진 채 이유를 알 수 없었다. 몇 개가 빠졌는지 세어 두고
  // 가져오기가 끝날 때 한 번만 알린다(블록마다 알리면 화면이 덮인다).
  const safe=safeUrl(d.dataUrl);
  if(!safe && d.dataUrl) normDropped.images++;
  return {type,data:{dataUrl:safe,
                     size:IMG_SIZES.includes(d.size)?d.size:"full"}};
}
/* 정규화하면서 버린 것들의 집계. 가져오기 직전에 resetNormDropped() 로 초기화한다. */
const normDropped={images:0};
function resetNormDropped(){ normDropped.images=0; }

/* keepId=true 는 '내 클라우드에서 읽어온 내 데이터'에 쓴다.
   가져오기(남의 파일)는 항상 id 를 새로 발급해 기존 문항과 충돌하지 않게 한다. */
function normProblem(p, opts={}){
  if(!p||typeof p!=="object") return null;
  const keepId=opts.keepId===true, lossless=opts.lossless===true;
  const text=(v,max)=>str(v,lossless?Infinity:max);
  const blocks=(Array.isArray(p.blocks)?p.blocks:[]).slice(0,lossless?undefined:50)
    .map(b=>normBlock(b,{lossless})).filter(Boolean);
  return {
    id:(keepId && typeof p.id==="string" && p.id) ? p.id : uid(),
    title:text(p.title,300), desc:text(p.desc,300),
    answer:text(p.answer,5000), answerImg:safeUrl(p.answerImg),
    numLabel:text(p.numLabel,40), paired:p.paired===true,
    /* 몇 문항이 한 묶음인지(자기 자신 포함).
       · 지문 블록이 있으면 '그 지문을 함께 쓰는 문항 수' 다.
       · 지문 블록이 없으면 '안내만 공유하는 묶음' 이다 — 실물 영어 16~17·31~34·
         36~37·38~39 처럼 범위 안내 한 줄만 있고 문항마다 따로 서는 형식.
       가져온 파일이 이상한 값을 줘도 1~10 으로 묶는다. */
    groupSpan:Math.max(1,Math.min(10,Math.round(Number(p.groupSpan))||1)),
    /* 지문 없는 묶음의 안내 글([16~17] **다음을 듣고, 물음에 답하시오.**).
       지문이 있으면 그 글은 지문 블록의 lead 에 있다 — 여기는 쓰지 않는다. */
    groupLead:text(p.groupLead,200),
    span:['pair','col','page'].includes(p.span)?p.span:(p.paired===true?'pair':'col'),
    blocks:blocks.length?blocks:[{type:"statement",data:{text:""}}]
  };
}


/* ── 시험지 괘선 색 ──
   인쇄면 위·가운데·아래 선의 색. 문제집마다 따로 둔다(과목별로 구분하려고).
   ⚠️ 임의의 색 문자열을 받지 않고 '고른 목록' 으로만 제한한다. 이 값은 결국
   style 속성에 들어가므로, 자유 입력을 허용하면 가져온 .json 이나 클라우드
   데이터로 엉뚱한 CSS 가 섞여 들어올 수 있다(블록 layout·이미지 size 를
   열거값으로 고정해 둔 것과 같은 이유). 색을 추가할 때는 여기만 늘리면 된다. */
const SHEET_COLORS=[
  {v:"indigo", name:"남보라 (기본)", hex:"#3B45BF"},
  {v:"blue",   name:"파랑",          hex:"#1D5FCC"},
  {v:"teal",   name:"청록",          hex:"#0F766E"},
  {v:"green",  name:"초록",          hex:"#15803D"},
  {v:"plum",   name:"자주",          hex:"#9D2C6B"},
  {v:"brown",  name:"갈색",          hex:"#92400E"},
  {v:"gray",   name:"회색",          hex:"#444B54"},
];
const SHEET_COLOR_DEFAULT="indigo";
function normSheetColor(v){
  return SHEET_COLORS.some(c=>c.v===v) ? v : SHEET_COLOR_DEFAULT;
}

function normSet(s, opts){
  if(!s||typeof s!=="object"||!Array.isArray(s.problems)) return null;
  const keepId=opts?.keepId===true, lossless=opts?.lossless===true;
  const requested=Number(opts?.maxProblems);
  const max=opts?.maxProblems===Infinity ? Infinity
    : Number.isFinite(requested) ? Math.max(0,Math.floor(requested)) : 500;
  const problems=s.problems.slice(0,lossless?undefined:max)
    .map(p=>normProblem(p,{keepId,lossless})).filter(Boolean);
  return { id:(keepId&&typeof s.id==="string"&&s.id)?s.id:uid(),
           /* ⚠️ **이름 상한은 `firestore.rules` 와 같아야 한다.** 앱이 200자까지 받는데
              규칙이 160에서 끊고 있어, 161~200자 제목은 저장이 통째로 '권한 오류' 로
              실패했다(외부 검토가 짚었고 에뮬레이터로 재현했다). `check:static` 이 두
              숫자를 대조한다 — 한쪽만 고치면 빨간불이 난다. */
           name:str(s.name,lossless?Infinity:SET_NAME_MAX)||"제목 없음",
           header:str(s.header,lossless?Infinity:200),
           lineColor:normSheetColor(s.lineColor), subject:normSubject(s.subject),
           /* ⚠️ **가져온 파일(`keepId` 없음)의 folderId 는 버린다** — 남의 기기에서 만든
              폴더 id 는 여기서 뜻이 없고, 두면 '알 수 없는 폴더' 만 늘어난다.
              ⚠️ `lossless` 가 아니라 `keepId` 를 따른다 — 이건 '얼마나 자를까' 가 아니라
                 '이 문서가 내 것인가' 의 문제다(코덱스가 두 결정을 갈라 놓았다). */
           ...(keepId ? (Object.hasOwn(s,"folderId")?{folderId:str(s.folderId,60)}:{}) : {folderId:""}), problems };
}


const LIB_SORTS=[
  {v:"manual", name:"기본 순서"},
  {v:"name",   name:"이름순"},
  {v:"updated",name:"최근 수정순"},
  {v:"opened", name:"최근 사용순 (이 기기)"},
];
function normLibMeta(m){
  const o=(m&&typeof m==="object")?m:{};
  const folders=(Array.isArray(o.folders)?o.folders:[]).slice(0,200).map((f,i)=>{
    const x=(f&&typeof f==="object")?f:{};
    return { id:str(x.id,60)||uid(), name:str(x.name,60)||"새 폴더",
             order:Number.isFinite(Number(x.order))?Number(x.order):i };
  });
  const map=(v,max)=>{
    const out={}; let n=0;
    for(const [k,val] of Object.entries((v&&typeof v==="object")?v:{})){
      if(n++>=max) break;
      if(typeof k!=="string"||k.length>60) continue;
      out[k]=typeof val==="number"?val:str(val,60);
    }
    return out;
  };
  return { folders, syncPending:o.syncPending===true,
           folderBySetId:map(o.folderBySetId,5000),
           /* ⚠️ 폴더 삭제도 tombstone 이 필요하다 — 소속만 풀고 목록에서 지우면 다른
              기기의 예전 소속이 다음 저장 때 **삭제한 폴더를 되살린다**(코덱스 §1). */
           folderTombstones:map(o.folderTombstones,500),
           lastOpenedBySet:map(o.lastOpenedBySet,5000),
           sort:LIB_SORTS.some(x=>x.v===o.sort)?o.sort:"manual" };
}

/* 클라우드 문서의 순서 값 */
const normOrder = v => Math.max(0, Math.floor(Number(v)||0));

/* 밖에서 쓰는 것만 내놓는다. `IMG_HOSTS` 와 `normDropped` 는 여기서만 쓰이므로 뺀다. */
global.PedagogyNormalize = Object.freeze({
  uid, sanitize, safeUrl, str, normOrder,
  normSubject, normSheetColor, normBlock, normProblem, normSet, normLibMeta,
  resetNormDropped,
  /* 진단 집계는 값이 아니라 함수로 낸다 — 숫자를 내보내면 호출한 쪽이 그 시점의
     사본을 들고 있게 되어 `resetNormDropped()` 뒤에도 옛 값을 본다. */
  droppedImages: () => normDropped.images,
  BLOCK_TYPES, SUBJECTS, SUBJECT_DEFAULT, PASSAGE_KINDS, NOTICE_KINDS,
  CHOICE_LAYOUTS, PAIR_HEADS, pairedItemText, IMG_SIZES, SET_NAME_MAX, SHEET_COLORS, SHEET_COLOR_DEFAULT, LIB_SORTS,
});

})(typeof window!=="undefined" ? window : globalThis);
