/* PEDAGOGY HTML 렌더 — index.html 구조 분리 2단계
 *
 * 정규화된 문제집 데이터를 안전한 미리보기·인쇄 HTML로 바꾼다.
 * 사용자 문자열은 반드시 sanitize() 뒤에 제한된 인라인 표지만 적용한다.
 * blockHTML()의 ctx.subject와 ctx.range는 미리보기와 인쇄가 공유하는 계약이다.
 *
 * 평범한 고전 스크립트라 file://에서도 실행된다. pedagogy-normalize.js 뒤에 불러야 한다.
 */
(function(global){

const normalize=global.PedagogyNormalize;
if(!normalize)
  throw new Error("pedagogy-normalize.js 를 먼저 불러와야 합니다");
const {sanitize, safeUrl, str, NOTICE_KINDS, CHOICE_LAYOUTS, PAIR_HEADS}=normalize;

const HANGULS=["가","나","다","라","마","바","사","아","자","차","카","타","파","하"];
const HSMALL=["ㄱ","ㄴ","ㄷ","ㄹ","ㅁ","ㅂ","ㅅ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const condLabel=i=>`(${HANGULS[i%HANGULS.length]})`;
const circled=n=>"①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳".split("")[n-1]||n+'.';

// 한 문제집이 "실제 작업물"인지 판단: 이름이 기본값이 아니거나, 내용 있는 문제가 하나라도 있으면 true
function setHasContent(s){
  if(!s) return false;
  if(s.name && s.name!=="새 문제집") return true;
  return (s.problems||[]).some(q=>{
    /* groupLead 는 '지문 없는 묶음' 의 안내 글이다 — 이것만 적어 둔 문항도 내용이 있다. */
    if(q.title || q.desc || q.answer || q.answerImg || q.numLabel || q.groupLead) return true;
    return (q.blocks||[]).some(b=>{
      const d=b.data||{};
      /* 이미지 블록의 주소 필드는 이 파일에서 'dataUrl' 이다. 예전에는 여기서만
         모의고사 편집기 쪽 이름인 'src' 를 보고 있어서 항상 undefined 였고,
         그 결과 '이미지만 있는 문제집'이 내용 없음으로 판정돼 로그인할 때
         병합 대상에서 빠지고 로컬까지 덮어써져 사라졌다.
         두 이름을 다 받아 예전 파일에서 넘어온 데이터도 인식한다.

         이 판정은 '병합할 가치가 있는가'를 묻는 것이라, 애매하면 '있다' 쪽으로
         기운다. 잘못 포함하면 빈 문제집이 하나 남을 뿐이지만 잘못 제외하면
         사용자 데이터가 사라진다. */
      /* ⚠️ 새 블록을 만들면 그 내용이 담긴 자리를 여기에도 더할 것.
         지문(parts)·표(rows)를 빠뜨리면 '지문만 있는 국어 문제집' 이 내용 없음으로
         판정돼 위와 똑같은 방식으로 사라진다. */
      return (d.text&&d.text.trim()) || (d.items&&d.items.length)
          || (Array.isArray(d.images)&&d.images.some(Boolean))   // 그림만 있는 선지
          || (d.title&&d.title.trim())                      // 안내문 상자의 제목
          || (Array.isArray(d.parts)&&d.parts.length)
          || (Array.isArray(d.rows)&&d.rows.length)
          || d.dataUrl || d.src;
    });
  });
}


/* 목록에서 문항을 알아보기 쉽게 — 본문 첫 줄을 수식·마크업 없이 짧게 뽑는다 */
/* 블록 하나에서 '보여줄 만한 첫 글' 을 뽑는다.
   ⚠️ 블록마다 내용이 담긴 자리가 다르다 — text / parts[].text / items[](문자열)
   / items[].text(대화문, 객체!) / rows[][](표). 대화문을 넣었을 때 items[0] 이
   객체라 String 이 아닌 값이 흘러들어 문항 목록이 통째로 죽었다(실제로 터졌다).
   새 블록을 추가하면 여기도 같이 볼 것. */
function blockExcerpt(b){
  if(!b||!b.data) return "";
  const d=b.data;
  if(typeof d.text==="string" && d.text.trim()) return d.text;
  if(Array.isArray(d.parts)){                       // 지문
    const pt=d.parts.find(x=>x&&typeof x.text==="string"&&x.text.trim());
    if(pt) return pt.text;
  }
  if(Array.isArray(d.items)){
    for(const it of d.items){
      if(typeof it==="string" && it.trim()) return it;            // 조건·보기·선지
      if(it&&typeof it==="object"&&typeof it.text==="string"&&it.text.trim())
        return it.text;                                           // 대화문
    }
  }
  if(typeof d.title==="string" && d.title.trim()) return d.title;   // 안내문 상자
  if(Array.isArray(d.rows)){                        // 표
    for(const r of (d.rows||[])) for(const cell of (Array.isArray(r)?r:[]))
      if(typeof cell==="string" && cell.trim()) return cell;
  }
  return "";
}


/* ─── 텍스트 전처리: \[Npt] 줄간격 + \n 자동 6pt + \displaystyle 자동 주입 ─── */
function autoDisplayStyle(raw){
  // 인라인 $...$ 안에 \int \sum \prod \lim 있으면 \displaystyle 자동 삽입
  return raw.replace(/\$((?:[^$\\]|\\[\s\S])+?)\$/g,(match,inner)=>{
    if(/\\(int|sum|prod|lim)\b/.test(inner)&&!/\\displaystyle/.test(inner))
      return '$\\displaystyle '+inner+'$';
    return match;
  });
}
/* cases 환경의 행간을 넓혀 위/아래 수식이 붙어 보이지 않게.
   각 행 시작에 보이지 않는 세로 버팀목(\rule)을 삽입.
   - \hline이 든 표(array)는 건드리지 않음(표는 행간 조정 불필요/깨질 수 있음)
   - 이미 \rule이 있으면 중복 삽입 안 함 */
function addCasesRowGap(src){
  if(!src || src.indexOf("\\begin{cases}")<0) return src;
  const STRUT="\\rule[-0.45em]{0pt}{1.45em}";
  return src.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (whole, body)=>{
    if(body.indexOf("\\rule")>=0 || body.indexOf("\\hline")>=0) return whole; // 이미 손댄 것/표는 패스
    // 행을 \\ 기준으로 나눠 각 행 앞에 버팀목 삽입
    const rows=body.split(/\\\\/);
    const newBody=rows.map(r=>{
      if(r.trim()==="") return r;
      // 행 맨 앞 공백 뒤에 버팀목 추가
      return r.replace(/^(\s*)/, "$1"+STRUT+" ");
    }).join("\\\\");
    return "\\begin{cases}"+newBody+"\\end{cases}";
  });
}

/* ── 지문 안 인라인 서식 ──
   실제 N제(이감 간쓸개 등)를 보면 지문 안에서 이 세 가지가 계속 쓰인다.
     **굵게**   → 강조할 시어·구절
     __밑줄__   → ㉠㉡ 기호로 가리키는 부분 (기호 자체는 밑줄 밖에 둔다: ㉠__뱃머리__)
     [[네모]]   → 개념어를 상자로 묶어 강조 (예: 항상적 연접성)

   ⚠️ 반드시 sanitize() 를 통과한 '이미 이스케이프된' 문자열에만 적용할 것.
   그래야 <b> 같은 태그를 새로 만들어도 본문에서 온 < > 가 이미 &lt; &gt; 로
   바뀐 뒤라 주입이 불가능하다. 순서를 바꾸면(마크업 먼저, 이스케이프 나중)
   우리가 만든 태그까지 이스케이프돼 서식이 글자로 보인다.
   여는/닫는 표시 사이에 줄바꿈 표시가 끼면 안 되므로 한 조각 안에서만 맞춘다. */
function inlineMarks(esc){
  return String(esc)
    /* 네모 앞에 (A)·(B) 같은 라벨이 바로 붙어 있으면 **함께 묶는다.**
       영어 어휘 문항이 그 모양인데(“(A)[[strengthened / weakened]]”), 묶지 않으면
       줄 끝에서 라벨과 상자가 다른 줄로 갈린다(실제로 그렇게 나왔다).
       ⚠️ 이 함수는 sanitize() 를 거친 글에만 쓴다 — 순서를 바꾸면 서식이 글자로 보이거나
          본문의 < > 가 살아남는다. */
    .replace(/(\((?:[A-Za-z]|[가-힣])\))?\[\[([^\[\]\n]{1,80})\]\]/g,
             (m, label, inner) => label
               ? `<span class="wbox-set">${label}<span class="wbox">${inner}</span></span>`
               : `<span class="wbox">${inner}</span>`)
    .replace(/\*\*([^*\n]{1,200})\*\*/g,     '<b>$1</b>')
    .replace(/__([^_\n]{1,200})__/g,          '<u>$1</u>');
}

function processText(raw){
  const text=addCasesRowGap(autoDisplayStyle(raw||""));

  // ① $$...$$ 블록을 먼저 플레이스홀더로 교체 (sanitize에 넘기지 않음)
  const displayBlocks=[];
  const withPH=text.replace(/\$\$([\s\S]+?)\$\$/g,(match,math)=>{
    const i=displayBlocks.length;
    displayBlocks.push(math);
    return `\x01PDM${i}\x01`;
  });

  // ② \n → \[6pt], split → spacer HTML
  const normalized=withPH.replace(/\r?\n/g,'\\[6pt]');
  const parts=normalized.split(/\\{1,2}\[(\d+(?:\.\d+)?pt)\]/);
  let html='';
  parts.forEach((chunk,i)=>{
    if(i%2===0) html+=inlineMarks(sanitize(chunk));
    else html+=`<span class="vspace" style="display:block;height:${chunk}"></span>`;
  });

  // ③ 플레이스홀더를 .pdm 래퍼로 복원
  /* ⚠️ 여기가 이 파일에서 가장 조심해야 하는 지점이다.
     예전에는 displayBlocks[i] 를 '원본 그대로' 되돌려 넣었다. 본문은 sanitize()
     를 거치는데 $$...$$ 안쪽만 그 검사를 통째로 건너뛰었고, 그래서
        $$</div><img src=x onerror=...>$$
     한 줄이면 innerHTML 대입 시점에 태그가 진짜 요소로 파싱돼 실행됐다.
     (가져온 .json / AI 응답 / 클라우드 데이터 어느 쪽으로도 들어올 수 있었다)

     sanitize() 를 한 번 더 통과시켜도 수식은 깨지지 않는다 — KaTeX 는
     textContent 를 읽으므로 &amp; → & 로 되돌아가고, cases 정렬용 &,
     부등호 < >, array 표까지 모두 그대로 렌더된다. */
  html=html.replace(/\x01PDM(\d+)\x01/g,(m,i)=>{
    return `<div class="pdm">$$${sanitize(displayBlocks[+i])}$$</div>`;
  });

  return html;
}

/* Preview */
/* ctx 로 범위 라벨(range)을 넘겨받는다 — 지문 블록만 쓴다.
   지문은 블록이지만 '이 문항 하나' 가 아니라 '문항 묶음' 을 대표하므로
   블록 안에서는 알 수 없는 번호 범위를 바깥에서 받아야 한다. */
/* 운문(시) 조판 — 줄바꿈이 '행', 빈 줄이 '연' 이다.
   산문용 processText 는 줄바꿈을 6pt 문단 간격으로 바꾸기 때문에 시에 쓰면
   행 사이가 문단처럼 벌어진다(실제로 그렇게 나왔다). 행마다 따로 조판하고
   빈 줄에서만 연 간격을 준다. 각 행은 그대로 processText 를 태워서
   이스케이프와 수식 처리를 똑같이 받는다. */
function verseHTML(raw){
  const paint = l => {
    if(!l.trim()) return '<div class="v-gap"></div>';
    if(isEllipsisLine(l)) return `<div class="psg-mid">${sanitize(l.trim())}</div>`;
    return `<div class="v-line">${processText(l)}</div>`;
  };
  return splitRanges(String(raw||"").split(/\r?\n/)).map(seg=>{
    const inner=seg.lines.map(paint).join("");
    return seg.label===null ? inner : rangeWrap(inner, seg.label);
  }).join("");
}

/* 한 줄이 통째로 (중략)·(하략)·(전략) 이면 가운데 정렬한다 — 실제 시험지가
   장편을 줄일 때 늘 이렇게 조판한다(2025 수능 국어 10쪽에서 확인). */
function isEllipsisLine(l){ return /^\(\s*(중략|하략|전략)\s*\)$/.test(String(l).trim()); }

/* ── 구간 표시 ([A] [B] [C]) ──
   실물 N제에서 여러 줄을 오른쪽 세로 괄호로 묶고 옆에 [A] 를 단다.
   문항이 "[A]에서 …" 하고 그 구간을 가리키는 형식이 국어에 아주 흔하다.
   한 줄이 통째로 <<A 면 시작, >> 면 끝이다 — 한 줄이 정확히 이 모양일 일은
   없어서 본문과 충돌하지 않는다. 라벨은 영숫자 3자까지만 받는다. */
function rangeOpen(l){ const m=/^<<\s*([A-Za-z0-9]{1,3})\s*$/.exec(String(l).trim()); return m?m[1]:null; }
function isRangeClose(l){ return /^>>$/.test(String(l).trim()); }

/* 줄 목록을 <<A … >> 기준으로 토막 낸다 → [{label, lines}]
   label 이 null 이면 보통 구간, 아니면 그 라벨로 묶인 구간이다.
   닫는 표시가 없으면 끝까지를 그 구간으로 본다(입력하다 만 상태에서도
   화면이 깨지지 않게). 산문·운문이 이 함수를 함께 쓰므로 '어디서 끊을지' 는
   한 곳에만 있다. */
function splitRanges(lines){
  const segs=[{label:null, lines:[]}];
  lines.forEach(l=>{
    const open=rangeOpen(l);
    if(open!==null){ segs.push({label:open, lines:[]}); return; }
    if(isRangeClose(l)){ segs.push({label:null, lines:[]}); return; }
    segs[segs.length-1].lines.push(l);
  });
  return segs.filter(s=>s.lines.length);
}
/* 구간 하나를 오른쪽 세로 괄호로 감싼다 */
function rangeWrap(inner, label){
  return `<div class="psg-range">${inner}<span class="psg-range-tag">[${sanitize(label)}]</span></div>`;
}

/* 지문을 문단으로 나눈다.
   ⚠️ **`$$…$$` 안의 줄바꿈에서 자르면 안 된다.** 표시 수식은 여러 줄에 걸칠 수 있어서
      (`processText` 의 `[\s\S]+?`), 가운데서 자르면 수식이 두 조각으로 깨진다.
      그래서 그냥 split 하지 않고 `$$` 밖의 `\n` 만 경계로 삼는다. */
function splitParagraphs(raw){
  const s=String(raw||""), out=[];
  let buf="", i=0;
  while(i<s.length){
    if(s.startsWith("$$",i)){
      const end=s.indexOf("$$",i+2);
      if(end<0){ buf+=s.slice(i); break; }     // 닫히지 않은 $$ — 통째로 둔다
      buf+=s.slice(i,end+2); i=end+2; continue;
    }
    if(s[i]==="\n"){ out.push(buf); buf=""; i++; continue; }
    buf+=s[i++];
  }
  out.push(buf);
  return out;
}

/* lead 는 **첫 문단 첫머리에 인라인으로** 들어갈 라벨이다((A)(B)(C) 순서 문항).
   ⚠️ 호출하는 쪽에서 이미 sanitize 된 문자열을 넘긴다 — 여기서 다시 이스케이프하면
      우리가 만든 표시가 글자로 보인다(CLAUDE.md 의 sanitize → inlineMarks 순서와 같은 이야기). */
function proseHTML(raw, lead){
  const lines=splitParagraphs(raw);
  /* 산문은 줄바꿈이 '문단' 이다. 실물은 **문단마다 첫 줄을 들여쓰므로**(국어 3.56mm ·
     영어 3.72mm — 둘 다 약 한 글자) 문단이 각각 요소여야 한다.
     ⚠️ 예전에는 덩어리째 `processText` 에 넘겼다. `\n` 이 6pt 간격 span 이 되어 문단이라는
        상자가 없었고, 그래서 들여쓸 곳이 없었다. 나눈 대신 그 6pt 는 CSS 로 되살린다
        (`.psg-p + .psg-p`) — 안 그러면 문단 간격이 사라진다. */
  let pending = lead || "";   // 첫 산문 문단 하나에만 붙인다
  const paintSeg = segLines => segLines.map(l => {
      if(isEllipsisLine(l)) return `<div class="psg-mid">${sanitize(l.trim())}</div>`;
      if(!pending) return `<div class="psg-p">${processText(l)}</div>`;
      const lab=`<span class="psg-lab-in">${pending}</span>`; pending="";
      return `<div class="psg-p psg-p-lab">${lab}${processText(l)}</div>`;
    }).join("");
  return splitRanges(lines).map(seg=>{
    const inner=paintSeg(seg.lines);
    return seg.label===null ? inner : rangeWrap(inner, seg.label);
  }).join("");
}

/* 독립 표와 <보기> 안 표가 같은 안전한 텍스트·칸 수 보정을 공유한다. */
function tableHTML(data, cls){
  const rows=(data&&data.rows)||[];
  const wide=Math.max(0,...rows.map(r=>r.length));
  const body=rows.map((r,i)=>{
    const tag=(data.header!==false && i===0) ? "th" : "td";
    const cells=[];
    for(let j=0;j<wide;j++) cells.push(`<${tag}>${processText(r[j]||"")}</${tag}>`);
    return `<tr>${cells.join("")}</tr>`;
  }).join("");
  if(!body) return "";
  /* 제목 줄 — 실물 영어 10번은 표 **안** 맨 위에 칸을 합쳐 표 이름을 둔다
     (7행 6열 중 0행이 `(0,1) 열병합 5` 로 'Plant Seed Kits').
     ⚠️ 실물은 ①~⑤ 가 들어가는 **첫 칸을 비워 두고 나머지 5칸만** 합친다. 우리는 전부
        합친다 — 첫 칸이 늘 선지 열이라는 보장이 없기 때문이다(국어 표에는 그 열이 없다).
        제목이 반 칸쯤 왼쪽으로 오는 차이뿐이고, 지어낸 규칙을 두는 것보다 낫다. */
  const title=str(data&&data.title,120);
  const cap = title ? `<tr><th class="ktbl-title" colspan="${wide}">${sanitize(title)}</th></tr>` : "";
  return `<table class="ktbl${cls?" "+cls:""}">${cap}${body}</table>`;
}

/* 지문 없는 묶음의 안내 줄.
   실물 영어에는 지문을 공유하지 않고 **안내 한 줄만 공유하는** 묶음이 있다
   (16~17 듣기 · 31~34 빈칸 · 36~37 순서 · 38~39 삽입 — 뒤 셋은 문항마다 제 지문을 갖는다).
   국어에는 이런 묶음이 없다(실물의 모든 안내 뒤에 지문이 온다) — 그래서 과목을 가르지
   않는다. '지문 없이 묶였다' 는 뜻은 어느 과목에서나 같다.
   ⚠️ 지문이 있으면 그 블록이 psg-head 로 이미 그리므로 여기서는 그리지 않는다 —
      안 막으면 안내가 두 번 나온다.
   ⚠️ 겉모습은 psg-head 를 그대로 쓴다. 따로 만들면 같은 문서 안에서 두 안내 줄이
      다르게 보이고, 나중에 한쪽만 고쳐 갈라진다. */
function groupHeadHTML(q, range){
  if(!range) return "";
  if((q&&q.blocks||[]).some(b=>b&&b.type==="passage")) return "";
  const lead=str(q&&q.groupLead,200);
  return `<div class="grp-head psg-head">[${sanitize(range)}] ${sanitize(lead)}</div>`;
}

function blockHTML(blk, ctx){
  const english=(ctx&&ctx.subject)==="english";
  if(blk.type==="dialogue"){
    /* 말한이의 조판은 과목이 정한다 (두 실물의 글자 모양을 직접 읽어 확인).
       국어  말한이만 **태고딕 10.5pt** (본문은 중명조 11.5pt) → 고딕 + 0.913em
       영어  `Woman:` 이 **본문과 완전히 같다**(Times New Roman 11.5pt) → 구분이 없다
       ⚠️ 둘 다 bold 비트를 쓰지 않는다 — 실물은 굵게가 아니라 **글꼴 갈래**로 가른다. */
    /* 말한 내용이 비면 **답란(밑줄 한 줄)** 이 된다 — 실물 영어 듣기 13·14·15번이
       `Woman:` 뒤에 밑줄만 두는 형식이다(`평가원 영어 양식.hwp` 를 읽어 확인:
       라벨 뒤부터 밑줄 속성이 걸린 묶음 빈칸이 단 끝까지 이어진다).
       ⚠️ 실물의 **빈칸 개수를 베끼지 않는다** — 우리 단 폭이 실물과 달라, 세어 옮기면
          짧거나 넘친다. 남은 폭을 채우게 두면 어느 폭에서나 맞는다.
       ⚠️ items 는 문자열이 아니라 {who,text} 객체 배열이다(CLAUDE.md). */
    const rows=(blk.data.items||[]).map(it=>{
      const t=str(it.text,3000);
      const body=t.trim() ? `<span class="dlg-txt">${processText(t)}</span>`
                          : `<span class="dlg-txt dlg-ans"></span>`;
      return `<div class="dlg-row"><span class="dlg-who">${sanitize(str(it.who,40))}</span>`+
             `<span class="dlg-sep">:</span>${body}</div>`;
    }).join("");
    return `<div class="dlg${english?" dlg-en":""}">${rows}</div>`;
  }
  if(blk.type==="table"){
    /* ⚠️ **탐구의 데이터 표는 본문보다 작다** — 실물에서 잰 값: 화학Ⅰ 4×4 자료 표
       9.5~10.0pt · 사회·문화 자료 9.5pt(본문은 둘 다 11.5pt). 국어(10.5pt)·영어(11.5pt)
       와 다르므로 **과목으로 가른다**. 큰 쪽(10.0pt=0.87em)을 기본으로 두고, 더 줄이는
       것은 사용자의 '작게' 와 인쇄 넘침 보정에 맡긴다 — 범위를 하나로 지어내지 않는다. */
    const cls=[ctx&&ctx.subject==="inquiry" ? "tbl-inq" : "",
               blk.data.small ? "blk-small" : ""].filter(Boolean).join(" ");
    return tableHTML(blk.data, cls);
  }
  if(blk.type==="notice"){
    const d=blk.data||{};
    /* ⚠️ `∙` 와 `※` 는 렌더가 붙인다 — 입력에 적으면 두 번 나온다
       (출처의 `–`, 각주의 `*` 와 같은 규칙. 기준 표본이 그렇게 틀린 적이 있다). */
    const MARK={bullet:"∙", note:"※ "};
    const rows=(d.items||[]).map(it=>{
      const kind=NOTICE_KINDS.includes(it&&it.kind)?it.kind:"text";
      return `<div class="ntc-${kind}">${MARK[kind]||""}${processText(it&&it.text)}</div>`;
    }).join("");
    const title=str(d.title,120);
    return `<div class="notice">`
         + (title?`<div class="ntc-title">${sanitize(title)}</div>`:"")
         + rows + `</div>`;
  }
  if(blk.type==="passage"){
    const d=blk.data||{};
    const range=(ctx&&ctx.range)||"";
    /* 안내문은 상자 '밖' 위에 온다(실물 확인). 상자 안에 넣지 않는다. */
    const head=(range||d.lead)
      ? `<div class="psg-head">${range?`[${sanitize(range)}] `:""}${sanitize(str(d.lead,200))}</div>`
      : "";
    const parts=(d.parts||[]).map(pt=>{
      /* ── 조각 라벨의 자리는 과목이 정한다 (둘 다 실물에서 확인) ──
         국어  `평가원 국어 양식.hwp` (가)(나)(다)는 **자기 혼자 있는 문단**이고
               본문은 그 다음 문단이다 → 별도 줄.
         영어  `평가원 영어 양식.hwp` 36번(문단 363~365)·37번(436~438)의 (A)(B)(C)는
               **본문과 같은 문단의 첫머리**다(`(A)`+묶음빈칸+본문). 그 문단 모양은
               왼쪽 여백 3.99mm에 **내어쓰기 7.62mm** — 이어지는 줄이 라벨 폭만큼
               들어가 라벨 뒤 본문에 맞춰진다(행잡기). 라벨은 본문과 같은 글자
               모양이다(11.5pt · 굵지 않음).
         ⚠️ 운문은 verseHTML 이 따로 그리므로 인라인으로 넣지 않는다. */
      const lab=pt.label?sanitize(pt.label):"";
      const inlineLab = english && lab && pt.kind!=="verse";
      const label=(lab && !inlineLab)?`<div class="psg-label">${lab}</div>`:"";
      const body=(pt.kind==="verse")?verseHTML(pt.text):proseHTML(pt.text, inlineLab?lab:"");
      const src=pt.source?`<div class="psg-source">– ${sanitize(pt.source)} –</div>`:"";
      /* 각주 — 국어는 줄당 하나(왼쪽), 영어는 **한 줄에 나란히 두고 오른쪽 끝에 붙인다.**
         2025 수능 영어 실물에서 잰 것: 각주 줄의 오른쪽 끝이 본문 오른쪽 끝과 같다
         (왼단 142.1~142.8mm vs 본문 142.8~143.3mm). 여러 개면 *, **, *** 로 늘어난다. */
      const noteList=str(pt.notes,1000).split(/\r?\n/).map(n=>n.trim()).filter(Boolean);
      const notes=english
        ? (noteList.length
            ? `<div class="psg-note psg-note-row">`
              + noteList.map((n,i)=>`<span>${"*".repeat(i+1)} ${sanitize(n)}</span>`).join("")
              + `</div>`
            : "")
        : noteList.map(n=>`<div class="psg-note">* ${sanitize(n)}</div>`).join("");
      return `<div class="psg-part${pt.kind==="verse"?" psg-verse":""}">`+
             `${label}<div class="psg-body">${body}</div>${src}${notes}</div>`;
    }).join("");
    /* 과목을 클래스로 넘긴다 — 조판 규칙이 과목마다 다르고(아래 CSS), 그 갈래를
       미리보기와 인쇄 두 곳에 각각 적어 두면 갈라진다. */
    const subj=english ? " psg-en" : "";
    return `<div class="passage${d.boxed!==false?" psg-boxed":""}${subj}">${head}`+
           `<div class="psg-box">${parts}</div></div>`;
  }
  if(blk.type==="bogi"){
    const d=blk.data||{};
    const label=str(d.label,20)||"보 기";
    return `<div class="bogi"><div class="bogi-label">&lt;${sanitize(label)}&gt;</div>`+
           `<div class="bogi-body">${processText(d.text)}${tableHTML(d)}</div></div>`;
  }
  if(blk.type==="statement") return `<div>${processText(blk.data.text)}</div>`;
  if(blk.type==="boxed") return `<div class="boxed${blk.data.small?" blk-small":""}">${processText(blk.data.text)}</div>`;
  if(blk.type==="conditions"){
    const items=(blk.data.items||[]).map((t,i)=>`<div class="cond-item"><span class="cond-label">${condLabel(i)}</span><span class="cond-text">${processText(t)}</span></div>`).join("");
    return `<div class="boxed">${items}</div>`;
  }
  if(blk.type==="examples"){
    const items=(blk.data.items||[]).map((t,i)=>`<div class="ex-item"><span class="ex-label">${HSMALL[i%HSMALL.length]}.</span><span class="ex-text">${processText(t)}</span></div>`).join("");
    // 라벨을 주면 <보 기> 상자 모양이 된다 (국어 문법 문항에서 흔한 형태)
    const lb=str(blk.data.label,20);
    if(lb) return `<div class="bogi"><div class="bogi-label">&lt;${sanitize(lb)}&gt;</div><div class="bogi-body">${items}</div></div>`;
    return `<div class="boxed">${items}</div>`;
  }
  if(blk.type==="choices"){
    const layout = CHOICE_LAYOUTS.includes(blk.data.layout) ? blk.data.layout : "horizontal";
    const imgs=blk.data.images||[];
    /* ── 짝 선지 (열 머리글 + `……` 이음) ─────────────────────────────────────
       영어 어법·낱말·요약문의 형식이다. 실물에서 잰 것 —
       2025 수능 40번: 4×8 표 · 폭 **108.09mm** · `(A) (B)` 머리글이 **두 번**(한 행에
       선지 둘) · 이음말 `……`. 2009 수능 어법/낱말: `(A)(B)(C)` 세 짝.
       ⚠️ **`cols2` 와 다르다** — `cols2` 는 선지 다섯을 두 열로 접는 것이고, 이건
          **선지 하나가 여러 칸**이다. 배치를 하나로 합치려다 둘 다 틀리게 하지 말 것.
       ⚠️ **이음말 `……` 는 렌더가 붙인다** — 출처의 `–`, 각주의 `*`, 안내문의 `∙` 과
          같은 규칙이다. 입력에 넣게 하면 사람마다 `...`·`…`·`……` 로 갈린다.
       ⚠️ 사용자는 칸을 `|` 로 가른다. `/` 는 낱말 안(`hesitancy / consistency`)에 쓰이므로
          가름표로 쓸 수 없다. */
    if(layout==="paired"){
      const n = (+blk.data.pairs===3) ? 3 : 2;
      const heads = PAIR_HEADS[n];
      const head = `<div class="pair-row pair-head">`
        + `<span class="label"></span>`
        + heads.map(h=>`<span class="pair-cell">${sanitize(h)}</span>`).join(`<span class="pair-dots"></span>`)
        + `</div>`;
      const rows=(blk.data.items||[]).slice(0,5).map((t,i)=>{
        const cells=String(t||"").split("|").slice(0,n);
        while(cells.length<n) cells.push("");
        return `<div class="pair-row"><span class="label">${circled(i+1)}</span>`
          + cells.map(c=>`<span class="pair-cell">${processText(c.trim())}</span>`)
                 .join(`<span class="pair-dots">……</span>`)
          + `</div>`;
      }).join("");
      return `<div class="choices paired pairs-${n}">${head}${rows}</div>`;
    }
    /* 그림 선지 — 라벨을 **그림 위 줄**에 둔다. 3열 칸은 좁아서(2단 시험지에서 한 칸이
       35mm 남짓) 라벨을 옆에 두면 그래프가 그만큼 더 눌린다. 글 선지는 종전 그대로다. */
    const items=(blk.data.items||[]).slice(0,5).map((t,i)=>{
      const src=safeUrl(imgs[i]);
      const txt=processText(t);
      if(!src) return `
      <div class="choice"><span class="label">${circled(i+1)}</span><span class="text">${txt}</span></div>`;
      return `
      <div class="choice choice--img"><span class="label">${circled(i+1)}</span>`
           + `<span class="text"><img src="${src}" alt="">${txt}</span></div>`;
    }).join("");
    /* 그림이 하나라도 있으면 칸을 위로 맞춘다(그림 높이가 제각각이라 가운데 정렬하면
       라벨 줄이 서로 어긋난다). */
    const anyImg=imgs.some(u=>safeUrl(u));
    return `<div class="choices ${layout}${anyImg?" choices--img":""}">${items}</div>`;
  }
  if(blk.type==="image" && blk.data.dataUrl){
    const W={full:"100%",large:"72%",medium:"52%",small:"36%"};
    const w=W[blk.data.size]||"100%";
    const src=safeUrl(blk.data.dataUrl);
    if(!src) return "";
    return `<div class="img-wrap"><img src="${src}" alt="" style="width:${w}"></div>`;
  }
  return "";
}

global.PedagogyRender=Object.freeze({
  HSMALL, condLabel, circled,
  setHasContent, blockExcerpt,
  autoDisplayStyle, addCasesRowGap, inlineMarks, processText,
  verseHTML, isEllipsisLine, rangeOpen, isRangeClose, splitRanges, rangeWrap,
  splitParagraphs, proseHTML, tableHTML, groupHeadHTML, blockHTML,
});

})(typeof window!=="undefined" ? window : globalThis);

