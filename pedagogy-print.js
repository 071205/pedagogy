/* PEDAGOGY 인쇄 배치 엔진 (`index.html` 에서 떼어 냈다 · 구조 3단계)
 *
 * 문항이 지면에서 어떻게 놓이는가 — **묶음 경계 · 번호 · 넘치는 수식 축소 · 인쇄본
 * 그림 대기**. 화면 미리보기와 인쇄가 **함께** 쓴다.
 *
 * ⚠️ **`problemGroups()` 하나만 묶음 경계를 안다.** 예전에 인쇄와 목록이 각자 훑다가
 *    이미 갈라져 있었다(그 함수 주석 참고). 사본을 만들지 말 것 — 이 파일로 옮긴 것은
 *    그 유일성을 **구조로** 못 박으려는 것이다.
 * ⚠️ **`shrinkWideMathAll()` 의 읽기·쓰기 단계 순서를 깨지 말 것.** 요소마다 쓰기·읽기를
 *    번갈아 하면 강제 동기 레이아웃이 나서 300문항 인쇄에서 1616ms → 265ms 차이가 났다.
 *
 * 여기 **없는 것**과 그 이유 — 셋은 앱에 붙어 있어 옮기지 않았다:
 *   · `buildPrintDoc()` — `activeSet()` 을 읽고 `#headerInput` 값으로 세트를 **고치며**
 *     `#printDoc` 에 쓰고 `toast()` 한다. 옮기려면 의존을 다섯 개 주입해야 하는데,
 *     그건 '옮기기' 가 아니라 '옮기기 + 고치기' 다.
 *   · `fitPrintDoc()` — `#printDoc` 을 직접 잡고 넘침을 `toast()` 로 알린다.
 *   · `doPrint()` — 진행 표시·재진입 방지(`printing`) 같은 앱 상태를 안는다.
 *   (`reportNormDropped` 를 본체에 남긴 것과 같은 판단이다 — 화면을 건드리는 것은 본체 몫.)
 *
 * ⚠️ **`serve.py` 의 `STATIC` 에 이 파일이 있어야 한다** — 빼면 로컬에서 404 다.
 * ⚠️ **평범한 고전 스크립트다**(ESM 아님). `file://` 에서 그대로 돌아야 한다.
 * ⚠️ **`pedagogy-normalize.js` 뒤에 실려야 한다** — `str()` 을 거기서 받는다.
 */
(function(global){

/* 정규화 모듈의 문자열 상한 도우미. 고전 스크립트 순서가 이것을 보장한다. */
const {str} = global.PedagogyNormalize;

/* 문항이 지면에서 차지하는 크기. 예전 데이터의 paired 도 그대로 읽는다. */
/* paired 와 span 을 함께 맞춘다. 두 값이 어긋나면 spanOf 가 엉뚱한 배치를 준다.
   'page' 로 지정된 문항은 묶기 대상이 아니므로 건드리지 않는다. */
function setPair(q,on){
  if(!q) return;
  if(spanOf(q)==='page' && on) return;
  q.paired=!!on;
  if(q.span==='page' && !on) return;
  q.span = on ? 'pair' : 'col';
}

/* 문항을 **인쇄에 놓이는 대로** 묶어 준다 — `[{idx:[0], full:true}, {idx:[1,2]}, …]`.
   ⚠️ **이 함수 하나만 묶음 경계를 안다.** 예전에는 인쇄(`buildPrintDoc`)와 목록
      (`renderQList`)이 각자 훑었고 **둘이 이미 갈라져 있었다** — 인쇄는 다음·셋째 문항이
      `page` 인지 보고 `spanOf()` 를 쓰는데 목록은 `page` 를 안 보고 날것 `.paired` 를
      읽었다. `pair · page · col` 을 넣으면 목록은 1·2 를 묶어 보여 주고 인쇄는 넷을
      따로 냈다(재현 확인). 새 사본을 만들지 말 것.
   ⚠️ 기준은 **인쇄 규칙**이다 — 사용자가 보는 것은 결국 인쇄물이다. */
function problemGroups(arr){
  const out=[]; let i=0;
  while(i<arr.length){
    if(spanOf(arr[i])==='page'){ out.push({idx:[i], full:true}); i++; continue; }
    if(spanOf(arr[i])==='pair' && i+1<arr.length && spanOf(arr[i+1])!=='page'){
      if(spanOf(arr[i+1])==='pair' && i+2<arr.length && spanOf(arr[i+2])!=='page'){
        out.push({idx:[i,i+1,i+2]}); i+=3;
      } else { out.push({idx:[i,i+1]}); i+=2; }
    } else { out.push({idx:[i]}); i++; }
  }
  return out;
}

/* `idx` 가 속한 묶음. 못 찾으면 자기 혼자인 묶음. */
function groupAt(arr, idx){
  return problemGroups(arr).find(g=>g.idx.includes(idx)) || {idx:[idx]};
}

function spanOf(q){
  if(!q) return 'col';
  if(q.span==='page'||q.span==='pair'||q.span==='col') return q.span;
  return q.paired ? 'pair' : 'col';
}


/* 자동 번호 부여: 묶음 여부 관계없이 순차 번호, numLabel 있으면 우선 */
/* 지문 블록을 가진 문항인가 (= 지문 세트의 첫 문항) */
function hasPassage(q){ return (q&&q.blocks||[]).some(b=>b&&b.type==="passage"); }
/* 그 지문을 함께 쓰는 문항 수(자기 포함). 지문이 없으면 언제나 1. */
/* 묶음이 실제로 몇 문항인가.
   묶음은 두 가지다 — **지문을 함께 쓰는 묶음**(국어 전부·영어 41~42·43~45)과
   **안내만 함께 쓰는 묶음**(영어 16~17·31~34·36~37·38~39. 뒤 셋은 문항마다 제 지문을 갖는다).
   ⚠️ 지문이 없을 때는 **안내 글이 있어야** 묶음으로 센다. 그러지 않으면 지문 블록을
      지우고 남은 옛 groupSpan 이 갑자기 [01~02] 를 그린다 — 예전 데이터의 뜻을 바꾸는 셈이다.
      실물도 범위만 있고 안내 글이 없는 줄은 쓰지 않는다. */
function groupSpanOf(q){
  if(!hasPassage(q) && !str(q&&q.groupLead,200).trim()) return 1;
  return Math.max(1, Math.min(10, Math.round(Number(q&&q.groupSpan))||1));
}

function computeNums(arr){
  const res=[]; let main=0;
  arr.forEach(q=>{
    main++;
    res.push({q, num: q.numLabel||String(main).padStart(2,'0')});
  });
  /* 지문 세트의 번호 범위([01~03]). 지문 블록을 렌더할 때 머리에 붙인다.
     끝 번호는 배열 밖으로 나가지 않게 자른다 — 마지막 문항에 span 을 크게
     잡아 두고 뒤 문항을 지우면 범위가 없는 번호를 가리킬 수 있다. */
  res.forEach((r,i)=>{
    const span=groupSpanOf(r.q);
    if(span>1){
      const last=res[Math.min(i+span-1, res.length-1)];
      if(last && last!==r) r.range=r.num+"~"+last.num;
    }
  });
  return res;
}


/* 지금 문항부터 끝까지 `n` 개씩 묶는다(`n<=1` 이면 모두 푼다).
   ⚠️ 시작점이 **기존 묶음의 가운데면 그 묶음 시작부터** 적용한다 — 안 그러면 범위 앞의
      묶음을 몰래 끊는다. 돌려주는 것은 실제로 시작한 자리다(화면에 알리려고).
   ⚠️ `page` 문항은 묶지 않고 **거기서 끊는다** — 인쇄가 그렇게 하므로 맞춰야 한다. */
function pairEveryN(arr, from, n){
  const start = Math.min(...groupAt(arr, Math.max(0, from)).idx);
  let i=start, k=0;
  while(i<arr.length){
    if(spanOf(arr[i])==='page'){ k=0; i++; continue; }
    // 묶음의 마지막 자리이거나, 다음이 없거나 `page` 면 여기서 끊는다
    const last = k>=n-1 || i+1>=arr.length || spanOf(arr[i+1])==='page';
    setPair(arr[i], n>1 && !last);
    k = last ? 0 : k+1;
    i++;
  }
  return start;
}


/* ══════════ 넘치는 수식 가로 축소 — 미리보기·인쇄 공용 ══════════
   예전에는 화면용(fitMathIn)과 인쇄용(fitPrintDoc)이 각자 다른 방법으로
   '넘쳤는지' 를 판단했다. 그래서 미리보기에서는 잘 줄어드는데 인쇄에서는
   아무 일도 일어나지 않고 잘려 나갔다. 두 경로가 이 함수 하나를 쓴다.

   ⚠️ 넘침을 잴 때 getBoundingClientRect().width 를 쓰면 안 된다.
      그 값은 '칸에 맞춰 이미 잘린 폭' 이라 칸 폭을 절대 넘지 않는다
      (실측: rect 334px / 실제 내용 555px → 334 > 334 가 거짓이라 축소 안 됨).
      실제 내용 폭은 scrollWidth 로 재야 한다.

   ⚠️ 축소만 하면 안 되고 width 도 함께 줘야 한다. scale 은 '그리는 크기' 만
      줄이므로, 박스 폭이 칸에 묶여 있으면 내용은 여전히 그 폭에서 잘린다.
      실제 내용 폭을 width 로 준 뒤 scale 로 줄여야 전체가 보인다.
      (그러면 레이아웃 박스가 칸보다 넓어지지만 transform-origin 이 왼쪽이고
       부모가 overflow:hidden 이라 옆 칸을 침범하지 않는다 — 실측 확인)
   높이는 scale 만큼 줄여 다시 지정한다. 안 그러면 밑에 '유령 여백' 이 남는다. */
/* 여러 수식을 한꺼번에 축소한다 — 읽기와 쓰기를 단계로 나눈다.
   요소마다 '스타일 쓰기 → 크기 읽기' 를 번갈아 하면 브라우저가 그때마다
   레이아웃을 다시 계산한다(강제 동기 레이아웃). 300문항 인쇄 문서(수식 2100개)
   에서 실측 1616ms 가 걸렸다. 전부 지우고 → 전부 재고 → 전부 적용하면
   레이아웃 계산이 사실상 한 번으로 줄어든다.
   pairs: [{disp, inner, avail}] — avail 은 이 수식이 쓸 수 있는 폭(px) */
function shrinkWideMathAll(pairs){
  if(!pairs.length) return;
  // ① 쓰기 단계 — 이전 축소를 전부 해제
  for(const {inner} of pairs){
    inner.style.transform=""; inner.style.display=""; inner.style.height=""; inner.style.width="";
  }
  // ② 읽기 단계 — 한 번의 레이아웃으로 전부 측정
  //    (display 수식은 줄바꿈되지 않으므로, 아래에서 width 를 줘도 높이는 그대로다)
  const m=pairs.map(({inner})=>({natural:inner.scrollWidth, h:inner.offsetHeight}));
  // ③ 쓰기 단계 — 계산해 둔 값으로 일괄 적용
  pairs.forEach(({disp,inner,avail},i)=>{
    const {natural,h}=m[i];
    if(!avail || !natural || natural<=avail+3) return;
    const k=(avail*0.99)/natural;
    inner.style.display="inline-block";
    inner.style.width=natural+"px";     // 내용이 잘리지 않게 실제 폭을 준다
    inner.style.transformOrigin="left top";
    inner.style.transform=`scale(${k.toFixed(4)})`;
    inner.style.height=(h*k)+"px";      // 유령 여백 제거
    disp.style.overflow="hidden";
  });
}

/* ── 넘치는 표를 줄인다 (`REV-2026-078`) ─────────────────────────────────────
   ⚠️ **표는 `width:100%` 라도 넘친다.** 표는 min-content 아래로 못 줄어서, 줄바꿈할 수
      없는 긴 값이나 그림이 든 칸이 있으면 단 밖으로 나간다. 코덱스가 실측했다 —
      표 오른쪽이 단 오른쪽보다 **1897.53px** 밖인데 보정이 하나도 안 걸렸다.
   ⚠️ **변형(`transform`)은 자리를 줄이지 않는다.** 그대로 두면 남는 높이만큼 세로 넘침
      판정(`fitPrintDoc` 3단계)이 과대평가돼 멀쩡한 쪽에 '안 담김' 경고가 뜬다.
      그래서 아래 여백에서 그만큼 뺀다. 여백 기준값은 **CSS 에서 읽는다** — 2mm 를
      코드에 박으면 CSS 를 고칠 때 조용히 어긋난다.
   ⚠️ 읽기·쓰기 단계를 나눈다(`shrinkWideMathAll` 과 같은 이유). 요소마다 번갈아 하면
      300문항에서 강제 동기 레이아웃으로 1.6초가 걸렸다. */
function shrinkWideTablesAll(pairs){
  if(!pairs.length) return;
  // ① 쓰기 — 이전 축소를 전부 해제
  for(const {tbl} of pairs){
    tbl.style.transform=""; tbl.style.transformOrigin=""; tbl.style.marginBottom="";
  }
  // ② 읽기 — 한 번의 레이아웃으로 전부 측정
  const m=pairs.map(({tbl})=>{
    const r=tbl.getBoundingClientRect();
    const mb=parseFloat(getComputedStyle(tbl).marginBottom)||0;
    return {w:Math.max(tbl.scrollWidth, r.width), h:r.height, mb};
  });
  // ③ 쓰기 — 계산해 둔 값으로 일괄 적용
  pairs.forEach(({tbl,avail},i)=>{
    const {w,h,mb}=m[i];
    if(!avail || !w || w<=avail+1) return;
    const k=(avail*0.99)/w;
    tbl.style.transformOrigin="left top";
    tbl.style.transform=`scale(${k.toFixed(4)})`;
    tbl.style.marginBottom=(mb - h*(1-k))+"px";   // 유령 높이 제거
  });
}

/* 한 개짜리 편의 래퍼 (호출부가 하나뿐일 때) */
function shrinkWideMath(disp, avail){
  const inner=disp.querySelector(".katex")||disp.firstElementChild;
  if(inner) shrinkWideMathAll([{disp, inner, avail}]);
}

function fitMathIn(root){
  if(!root) return;
  const avail=root.clientWidth;
  if(!avail) return;
  const pairs=[...root.querySelectorAll(".katex-display")].map(disp=>{
    const inner=disp.querySelector(".katex")||disp.firstElementChild;
    if(!inner) return null;
    return {disp, inner, avail:Math.min(disp.clientWidth||avail, avail)};
  }).filter(Boolean);
  shrinkWideMathAll(pairs);
}


/* 인쇄본의 <img> 가 다 도착할 때까지 기다린다(상한 있음).
   반환: 기다린 장수. 실패했거나 상한 안에 못 받은 것이 있으면 **음수**로 그 개수를 준다.
   ⚠️ `complete` 는 성공과 실패 양쪽에서 true 다. 이미 error 이벤트까지 끝난 그림을
      pending 으로 다시 넣으면 이벤트가 돌아오지 않아 매번 8초를 기다리게 된다. */
const PRINT_IMG_WAIT_MS=8000;
function awaitPrintImages(root, onProgress){
  if(!root) return Promise.resolve(0);
  const imgs=[...root.querySelectorAll("img")];
  let failed=imgs.filter(im=>im.complete && im.naturalWidth<=0).length;
  const pending=imgs.filter(im=>!im.complete);
  /* ⚠️ 진행 콜백은 **모든 길**에서 한 번은 불려야 한다 — 캐시로 이미 다 온 경우,
     한 장도 없는 경우, 실패, 시간 초과. 안 그러면 진행 표시가 그 단계에서 멈춘 채
     남는다. 실패한 그림도 **끝난 것으로 센다**(기다릴 것이 없으므로). */
  const total=imgs.length;
  let settled=total-pending.length;
  const tick=()=>{ try{ onProgress && onProgress(settled, total); }catch(e){ console.error(e); } };
  tick();
  if(!pending.length) return Promise.resolve(failed?-failed:0);
  return new Promise(resolve=>{
    let left=pending.length, finished=false, timer=null;
    const removers=[];
    const finish=value=>{
      if(finished) return;
      finished=true;
      if(timer!==null) clearTimeout(timer);
      removers.forEach(remove=>remove());
      resolve(value);
    };
    const arrived=im=>{
      if(finished) return;
      if(im.naturalWidth<=0) failed++;
      settled++; tick();
      if(--left<=0) finish(failed?-failed:pending.length);
    };
    // load·error 둘 다 받아야 한다 — 깨진 그림 하나에 인쇄가 멈추면 안 된다
    pending.forEach(im=>{
      const onLoad=()=>arrived(im), onError=()=>arrived(im);
      im.addEventListener("load",onLoad,{once:true});
      im.addEventListener("error",onError,{once:true});
      removers.push(()=>{
        im.removeEventListener("load",onLoad);
        im.removeEventListener("error",onError);
      });
    });
    timer=setTimeout(()=>{
      const missing=imgs.filter(im=>!im.complete || im.naturalWidth<=0).length;
      settled=total; tick();               // 시간 초과도 '이 단계는 끝' 이다
      finish(missing?-missing:pending.length);
    }, PRINT_IMG_WAIT_MS);
  });
}


/* ⚠️ **`window` 표면을 옮기기 전 그대로 유지한다.** 이 열둘은 옮기기 전 최상위
   `function` 선언이라 자동으로 `window` 속성이었고 회귀 검사가 그것에 기댄다.
   `PRINT_IMG_WAIT_MS` 는 `const` 였으므로 **올리지 않는다**(표면을 넓히는 것도 회귀다). */
global.PedagogyPrint = Object.freeze({
  hasPassage, groupSpanOf, computeNums, pairEveryN,
  shrinkWideMathAll, shrinkWideTablesAll, shrinkWideMath, fitMathIn,
  setPair, problemGroups, groupAt, spanOf, awaitPrintImages,
});

})(typeof window!=="undefined" ? window : globalThis);
