# PEDAGOGY 코드베이스 기술 분석

이 문서는 `index.html`(2073줄), `mock-exam-editor.html`(1138줄), `serve.py`(253줄) 전체를
직접 읽고 작성한 코드 수준 분석이다. 상위 요약은 `CLAUDE.md`를 참고하고, 이 문서는
함수 호출 순서·실제 정규식·조건문·라인 번호까지 추적한다.

---

## 1. 전체 아키텍처

### 1.1 세 파일의 관계

```
index.html (PEDAGOGY 본체)
 ├─ <iframe src="mock-exam-editor.html">  ← #mockView 안에서 지연 생성 (index.html:594-606)
 │                                          완전히 별도 문서 — 전역 변수/CSS/저장소 비공유
 │
 └─ Firebase Auth/Firestore/Storage (CDN, 클라우드)

mock-exam-editor.html (모의고사 편집기, iframe 내부)
 └─ fetch(...)  ──POST /render──▶  serve.py (선택적 로컬 파이썬 서버, 127.0.0.1:8787)
                 ◀──PNG(base64) JSON──   typst compile 서브프로세스 실행 후 결과 반환
```

- `index.html`의 `#mockModeBtn` 클릭 시 `mockView`가 표시되고, 그 안에 `<iframe id="mockFrame" src="mock-exam-editor.html">`가 최초 1회 생성된다 (`index.html:596-606`). iframe이므로 두 문서는 서로 다른 `window`/전역 스코프를 가지며, `postMessage` 등 명시적 통신 코드는 전혀 없다 — 완전히 격리되어 있다.
- `mock-exam-editor.html`은 자체 KaTeX 인스턴스를 별도로 로드하고(`mock-exam-editor.html:8-9`), 자체 상태(`state`)를 갖는다. PEDAGOGY의 Firebase/localStorage와 전혀 무관하다.
- `serve.py`는 두 HTML을 정적 파일로 서빙하는 역할과, 모의고사 편집기가 만든 Typst 소스를 실제로 컴파일해 PNG를 돌려주는 `/render` API 역할을 동시에 한다(`serve.py:33-42`, `:180-216`).

### 1.2 데이터 흐름

**PEDAGOGY(index.html) 저장 경로 — 3단계**

```
사용자 입력 → 전역 변수 sets[] 변경
            → saveSets() (index.html:1096)
               ├─ pushHistory()               undo/redo 스택에 스냅샷 기록
               ├─ localStorage[SETS_KEY] 즉시 저장   (항상 실행 — 오프라인 백업)
               └─ currentUser 있으면 800ms 디바운스 후
                  fbDb.collection('users').doc(uid).set({sets, updatedAt}) (Firestore)
```

로그인 시 로드는 `loadSets()`(`index.html:971-993`)가 Firestore를 우선하되,
`mergeSets(cloud, localWorth)`(`index.html:965-969`)로 로컬에만 있던(클라우드에 없는 id의)
문제집을 자동으로 합쳐 절대 버리지 않는 정책을 취한다.

**이미지 흐름** — `storeImageFile()`(`index.html:849-864`)가 로그인 여부로 분기:
로그인 시 Firebase Storage(`users/{uid}/images/...`)에 업로드하고 다운로드 URL만
Firestore 문서에 저장(1MB 문서 한도 회피), 비로그인 시 `compressDataUrl()`로 압축한
base64 데이터 URL을 그대로 저장한다. `migrateBase64ToStorage()`(`:867-893`)가 로그인 후
저장 시점에 과거 base64 이미지를 Storage로 일괄 승격한다.

**모의고사(mock-exam-editor.html) 저장 경로** — localStorage/Firestore를 전혀 쓰지 않고
`saveJSON()`(`mock-exam-editor.html:1080-1086`)이 `state.problems`를 `.json` 파일로
다운로드하며, `#loadInput` 변경 이벤트(`:1106-1121`)가 파일을 읽어 `sanitize(blank(i+1), p)`로
검증하며 복원한다. 저장 안 된 변경은 `beforeunload`에서 경고만 한다(`:1103-1105`).

**렌더 왕복(serve.py)** — `doRender()`(`mock-exam-editor.html:1019-1049`)가
`typstSource()`가 만든 Typst 문자열과 `known`(이미 갖고 있는 페이지 해시 목록)을
`POST /render`로 보내면, `serve.py`의 `compile_typ()`(`serve.py:78-105`)가 임시 디렉터리에
`main.typ`을 쓰고 `typst compile --root WORK ...`를 서브프로세스로 실행해 `p{n}.png`들을
생성, 각 페이지 SHA1 해시 16자와 base64 PNG를 반환한다. 서버는 `known`에 이미 있는 해시면
PNG 바이트를 응답에서 빼고 `cached:true`만 표시해(`serve.py:210-215`) 대역폭을 아낀다.

---

## 2. 데이터 모델 상세

### 2.1 index.html — 문제집 / 문항 / 블록

```js
// 문제집(set)
{ id, name, header, problems:[...] }   // header = 인쇄 좌상단 문구

// 문항(problem) — newProblem() index.html:910
{ id, title, desc, answer, answerImg, numLabel, paired, blocks:[...] }
```

- `numLabel`: 비어 있으면 `computeNums()`(`index.html:1133-1140`)가 순번(`01`, `02`…)을 자동 부여하고, 값이 있으면 그대로 노출 — `renderQList()`의 `fmtNum()`(`:1280`)이 `1-1` 같은 `숫자-숫자` 패턴을 정규식 `^(.+?)(-\d+)$`으로 분리해 뒤쪽을 `<span class="sub">`로 작게 그린다.
- `paired`: "다음 문제와 묶기" 체크박스 상태. 인쇄 시 두 문항을 한 칸에 배치하는 데 쓰인다(`buildPrintDoc()` 슬롯 구성, `:1753-1765`). `makeIndependent()`(`:1265-1274`)는 특정 문항을 독립시키고 뒤쪽을 2개씩 재짝짓기 하는 재배치 알고리즘이다.
- `blocks[i] = {type, data}` — `type`은 `statement | conditions | examples | boxed | choices | image` 6종(`index.html:670-675` select 옵션과 `blockHTML()` `:1657-1680`이 1:1 대응).
  - `statement`/`boxed`: `data.text` (LaTeX 원문 문자열)
  - `conditions`/`examples`: `data.items[]` (가나다/ㄱㄴㄷ 라벨이 순서대로 붙음, `condLabel()`/`HSMALL` `:746-747`)
  - `choices`: `data.items[5]` + `data.layout`(`"horizontal"|"vertical"`, `index.html:1400`)
  - `image`: `data.dataUrl`(Storage URL 또는 base64) + `data.size`(`full|large|medium|small`, 폭 매핑은 `blockHTML()` 안 `W` 객체 `:1675`)

### 2.2 mock-exam-editor.html — `blank(n)` 문항 스키마

```js
// mock-exam-editor.html:327-332
function blank(n){
  const sect = n<=22 ? '공통' : '선택';
  const type = (n<=15||(n>=23&&n<=28)) ? 'choice' : 'short';
  return {id:'p'+n, num:n, sect, type, pts:PTS[n], stmt:'', conds:[], useCond:false,
    choices: type==='choice' ? ['','','','',''] : [], layout:'auto', figure:0, breakAfter:false};
}
```

- `sect`: 문항 1-22 공통 / 23-30 선택 — 평가원 수능/모의고사 형식을 하드코딩(`:328`).
- `type`: 문항 1-15, 23-28 은 5지선다(choice) / 나머지는 단답형(short)(`:329`). `PTS` 맵(`:322-324`)이 문항 번호별 배점을 미리 정의(2~4점).
- `stmt`: 발문 원문. 줄바꿈은 `\n`으로 구분되며 `stmtLines()`(`:404-407`)가 `(단,` 앞에서 강제 개행하고 트림·빈 줄 제거한다.
- `conds`/`useCond`: 조건 박스 (가)(나) 텍스트 배열과 표시 여부.
- `choices`: 5지선다 선택지 5개. 단답형은 빈 배열.
- `layout`: `auto|1|2|v` — 선지 배치를 자동 판정할지 강제할지. `layoutOf()`(`:380-385`)가 `auto`일 때 폭 측정으로 `1`(한 줄 5개)/`2`(3+2 두 줄)/`v`(세로)를 결정한다.
- `figure`: 그림 폭(mm), 0이면 없음. `figSrc`: 그림 파일명(선택).
- `breakAfter`: 이 문항 뒤에서 강제로 단을 나눌지 — `buildPages()`(`:438-454`)의 컬럼 분할 조건 중 하나.

불러오기 시 `sanitize(blank(i+1), p)`(`:1060-1076`)가 타입/열거값/길이(문자열 4000자 컷)를 모두 화이트리스트로 재검증한다 — 외부 JSON을 신뢰하지 않는 설계.

---

## 3. 핵심 기능별 실행 흐름

### 3.1 문제집 저장 (`#saveBtn` 클릭, index.html)

```
click → (index.html:1805-1846)
  비로그인: localStorage.setItem(SETS_KEY, ...) → toast "이 기기에 저장했어요"
  로그인:
    1) hasBase64 검사 → 있으면 migrateBase64ToStorage() 로 Storage 승격 먼저 수행
    2) fbDb.doc(uid).set({sets, updatedAt}) 로 Firestore 쓰기
    3) 성공: localStorage 동기화 + "✓ 저장됨" 토스트
       실패: 에러 메시지 문자열을 정규식으로 분류(permission / longer than|exceeds|too large|1048487)
             → "권한 오류" 또는 "용량 초과(1MB)" alert
```
자동 저장 경로(`saveSets()`, `index.html:1096-1127`)는 이와 별개로 모든 편집 동작(`oninput` 등)마다
호출되며, Firestore 쓰기는 800ms 디바운스(`saveTimer`)로 묶인다.

### 3.2 AI 이미지 변환 (사진 → 문항)

```
파일 선택/드롭 → aiGenerateFromImage(file)  (index.html:1556-1597)
  1) fileToBase64(file)                       — data URL에서 헤더 제거
  2) fetch(AI_PROXY_URL, POST {imageBase64, mimeType})   — Cloudflare Worker
  3) 응답 JSON의 data.problems[] 를 map(aiBlocksToProblem)  (index.html:1538-1554)
     → {id, title, desc:"", answer:"", answerImg:"", numLabel:"", paired:false, blocks:[...]}
  4) set.problems.push(...newQs); currentQId = newQs[0].id
  5) saveSets(); renderQList(); renderEditor(); renderPreview(); syncPairedChk()
실패 시: catch → toast("AI 변환에 실패했어요: "+err.message, "error")
```
`AI_PROXY_URL`(`index.html:1521`)이 하드코딩된 Cloudflare Worker 주소이며, 실제 AI 공급자
키는 그 Worker 뒤에만 존재 — 클라이언트 코드에는 노출되지 않는다.

### 3.3 인쇄 / PDF 저장

```
"인쇄" 클릭 → 모달 표시 → "정답 포함"/"정답 제외" 클릭
  → doPrint(hideAnswers)  (index.html:1924-1935)
    1) buildPrintDoc(hideAnswers)             — #printDoc 에 A4 페이지 DOM 생성
    2) ensureKatexFonts()                     — 인쇄 전 KaTeX/KoPub 폰트 강제 로드
    3) document.fonts.ready 대기
    4) fitPrintDoc()                          — 넘치는 선지/수식/칸을 스케일 축소
    5) window.print()
```
`buildPrintDoc()`(`:1744-1800`)은 `paired` 플래그로 2~3문항 슬롯을 구성하고 2슬롯씩 페이지에
배치하는, **화면 미리보기(`renderPreview()`)와는 별개의 DOM/레이아웃 생성 경로**다. 같은
`blockHTML()`을 재사용하긴 하지만 다단 배치·페이지 나눔은 `buildPrintDoc()`에서만 계산되므로,
블록 렌더링 로직을 고치면 두 곳(미리보기+인쇄) 모두 확인해야 한다.

### 3.4 모의고사 실시간 정본 미리보기

```
"실시간" 버튼 → liveBtn.onclick (mock-exam-editor.html:1125-1129)
  1) pingServer()                          — 같은 출처('') 우선, 실패 시 8787/8788/8080 순회 프로브
  2) setLive(true) → requestRender(0)      (:1001-1005, :1011-1018)
  3) 이후 모든 편집 이벤트(oninput 등)가 renderPreview() 를 호출하면
     renderPreview() 는 LIVE.on 이면 자기 자신 대신 requestRender() 로 위임 (:486)
  4) requestRender(delay) — 400ms 디바운스, LIVE.busy 중이면 pending=true 로 큐잉만
  5) doRender()  (:1019-1049)
     fetch POST /render {typ: typstSource(), ppi: livePpi(), known:[...LIVE.cache.keys()]}
     → serve.py compile_typ() → typst 서브프로세스 → PNG(base64) 배열
     → 페이지별로 hash 가 LIVE.cache 에 있으면 그 데이터URL 재사용, 없으면 새 PNG 캐시에 저장
     → <img class="live-pg"> 로 #stage 재구성, LIVE.cache.size>60 이면 전체 비움
  실패(fetch 자체 예외) 시: setLive(false) 로 되돌리고 에러박스에 안내 문구 표시
```

---

## 4. LaTeX/Typst 변환 로직

### 4.1 index.html — `processText()` 파이프라인 (`:1628-1654`)

1. `autoDisplayStyle(raw)`(`:1600-1607`): 인라인 `$...$` 안에 `\int|\sum|\prod|\lim`이 있고 `\displaystyle`이 없으면 자동으로 `\displaystyle `을 앞에 삽입.
2. `addCasesRowGap(src)`(`:1612-1626`): `\begin{cases}...\end{cases}` 안에서 이미 `\rule`이나 `\hline`(표)이 없으면, `\\`로 나눈 각 행 맨 앞에 보이지 않는 세로 버팀목 `\rule[-0.45em]{0pt}{1.45em}`을 삽입해 행간을 벌린다.
3. `$$...$$` 블록을 먼저 `\x01PDM{i}\x01` 플레이스홀더로 치환해 `sanitize()`(HTML 이스케이프)를 건너뛰게 보호.
4. `\n` → `\[6pt]` 로 정규화 후, 정규식 `/\\{1,2}\[(\d+(?:\.\d+)?pt)\]/`로 split 해서 짝수 인덱스는 `sanitize()`(`<`,`>`만 이스케이프), 홀수 인덱스는 `<span class="vspace" style="height:{N}pt">` 스페이서로 변환.
5. 마지막에 플레이스홀더를 `<div class="pdm">$$...$$</div>`로 복원 — KaTeX auto-render가 이후 `$$`/`$`를 실제 수식으로 렌더링(`renderPreview()`/`buildPrintDoc()`에서 `renderMathInElement(...)` 호출).

### 4.2 mock-exam-editor.html — 두 개의 독립된 변환 경로

**(A) 화면 근사 미리보기 — `tex()`** (`:358-367`)
```js
function tex(src){
  return String(src).split(/(\$[^$]*\$)/g).map(p=>
    (p.startsWith('$')&&p.endsWith('$'))
      ? katex.renderToString(p.slice(1,-1),{throwOnError:false,output:'html'})
      : esc(p)
  ).join('');
}
```
`$...$` 구간만 KaTeX으로 직접 렌더링하고 나머지는 HTML 이스케이프. **`fixCases()`를 거치지 않는다** — 즉 미리보기의 `cases` 환경은 Typst 출력과 달리 `&` 뒤 간격 보정이 적용되지 않는다(§5.3).

**(B) Typst 정본 변환 — `texToTypst()` / `tline()`**
```js
// mock-exam-editor.html:858-861
function fixCases(s){
  return s.replace(/\\begin\{cases\}[\s\S]*?\\end\{cases\}/g,
    m=>m.replace(/&(?!\s*\\quad)/g,'&\\quad '));
}
// :862-865
function texToTypst(latex,disp){
  const src=fixCases(String(latex).replace(/`/g,"'").replace(/\r?\n/g,' '));
  return '#'+(disp?'mitex':'mi')+'(`'+src+'`)';
}
```
- `fixCases`: Typst에서 `cases`의 `&` 열 구분자가 폭 0이라 조건이 식에 바짝 붙는 문제를, `\quad`가 이미 없는 `&`마다 삽입해 보정.
- `texToTypst`: 백틱을 작은따옴표로 치환(Typst raw-string 델리미터 충돌 방지), 개행 제거 후 `@preview/mitex` 패키지의 `mi()`(인라인)/`mitex()`(디스플레이) 호출 문자열 생성.
- `tq(s)`(`:852`): Typst 마크업 특수문자(`\ # $ [ ] * _ \` < > @ ~`)를 백슬래시 이스케이프.
- `tqs(s)`(`:854`): Typst 문자열 리터럴(`"..."`) 안에 넣을 때용 — `\`와 `"`만 이스케이프.
- `tline(s)`(`:869-882`): 한 줄 안에 `$...$`가 섞인 일반 텍스트를 Typst 마크업으로 변환. 수식 직후 문자가 `.`나 `(`로 시작하면 Typst가 이를 필드접근/함수호출로 오인하므로 `\.`/`\(`로 이스케이프하는 특수 처리가 있다(`:877`).

### 4.3 두 경로가 공유하는 문항 순회 로직

`buildPages()`, `pageMeta()`, `noteFor()`, `tagOf()`, `isGroupFirst()`, `layoutOf()`, `stmtLines()`는 미리보기(`renderProb`)와 Typst 변환(`probTypst`) 양쪽에서 그대로 재사용되어 "몇 번째 쪽 몇 번째 단에 어떤 문항이 들어가는가"라는 레이아웃 판단 자체는 어긋나지 않는다. 다만 **문항 내부의 수식 타이포그래피(§5.3)는 두 경로가 별도 함수로 처리**하므로 세부 간격은 어긋날 수 있다.

---

## 5. 잠재적 버그·엣지 케이스·기술 부채

### 5.1 `#mockModeBtn` 클릭 핸들러가 두 번 정의되고, 나중 것이 미정의 함수를 참조 — 실행 시 에러 발생

- 1차 정의: `index.html:583-621`의 IIFE 안에서 `B.onclick=function(){ V.style.display==='block'?back():open(); };` (`:613`) — 정상 동작.
- 2차 정의(두 번째 `<script>` 블록): `index.html:1804`
  ```js
  $("#mockModeBtn").onclick=()=>showMock();
  ```
  같은 요소에 `onclick`을 다시 대입하면 이전 핸들러를 완전히 덮어쓴다. 그런데 이 파일 전체에서 `showMock`이라는 함수는 **어디에도 정의돼 있지 않다**(`grep`으로 확인, 유일한 매치는 이 줄 자체). 즉 "📝 모의고사" 버튼을 클릭하면 `ReferenceError: showMock is not defined`가 발생해 콘솔 에러만 남고 모의고사 뷰가 열리지 않는다 — 두 번째 스크립트 블록이 첫 번째 스크립트 블록의 정상 동작을 덮어써서 기능을 깨뜨리는 회귀로 보인다.

### 5.2 Undo/Redo가 전체 `sets` 배열을 통째로 JSON 스냅샷 — 메모리·성능 이슈 가능

```js
// index.html:1005
function snapshot(){ return JSON.stringify({sets, currentSetId, currentQId}); }
```
문항 하나의 텍스트를 한 글자 고칠 때도 **모든 문제집·모든 문항·모든 블록**(비로그인 상태라면 base64 이미지까지 포함)을 통째로 직렬화해 `undoStack`(최대 80개, `HIST_LIMIT`)에 쌓는다. base64 이미지가 몇 개만 있어도 80단계 스냅샷이 수십MB에 달할 수 있어 대형 문제집에서는 메모리 사용량과 `JSON.stringify`/`JSON.parse` 비용이 커질 수 있다. 350ms 디바운스(`histTimer`)로 연속 타이핑을 한 단계로 묶긴 하지만, 스냅샷 자체가 전역 단위라는 구조적 한계는 남는다.

### 5.3 미리보기(KaTeX)와 Typst 출력의 `cases` 환경 간격이 서로 다르게 처리됨

Typst 경로는 `fixCases()`로 `&` 뒤에 `\quad`를 강제 삽입하지만, 미리보기 경로(`tex()`, `:358-367`)는 이 보정을 호출하지 않고 원본 LaTeX을 그대로 KaTeX에 넘긴다. 따라서 `cases` 환경을 쓰는 문항은 "실시간 정본"(Typst PNG)과 로컬 서버가 꺼져 있을 때의 CSS 근사 미리보기에서 조건식 간격이 다르게 보일 수 있다 — CLAUDE.md가 말하는 "두 렌더링 경로는 반드시 함께 맞춰야 한다"는 원칙이 이 지점에서 실제로 어긋나 있다. (참고: index.html 쪽 `addCasesRowGap()`(`:1612-1626`)은 완전히 다른 파일의 완전히 다른 보정 로직이며 이 불일치와는 별개 사안이다.)

### 5.4 `serve.py`로 구동할 때 브랜드 폰트(Adobe Caslon Pro Bold)가 항상 404

`index.html:23-27`의 `@font-face`가 `./Adobe Caslon Pro Bold.ttf`를 상대경로로 참조하지만, `serve.py`의 정적 파일 화이트리스트(`serve.py:33-42`, `STATIC` dict)는 `/`, `/mock-exam-editor.html`, `/index.html`, `/mock` 네 경로만 서빙한다. 폰트 파일은 화이트리스트에 없으므로 `python3 serve.py`로 열었을 때는 항상 404로 떨어지고, 브랜드 로고는 폴백 서체(`serif`)로만 표시된다 — 보안 의도(화이트리스트 강제)의 부수효과로 생긴 기능 저하다.

### 5.5 이미지 업로드 실패 시 폴백에서 조용히 삼켜지는 에러

`index.html:1463-1471`(블록 이미지), `:1376-1387`(정답 이미지) 모두 동일 패턴:
```js
try{
  const localPreview=await fileToDataURL(f);
  blk.data.dataUrl=localPreview; renderPreview();
  const stored=await storeImageFile(f);
  blk.data.dataUrl=stored; renderPreview(); saveSets();
}catch(err){ console.warn(err); }   // ← 사용자에게 아무 알림도 없음
```
`storeImageFile()`(`:849-864`)은 Storage 업로드 실패 시 자체적으로 `compressDataUrl()` 폴백을 시도해 대부분의 실패를 흡수하지만, `fileToDataURL(f)` 자체가 실패하거나 그 바깥의 `catch`에 걸리는 경우 토스트/알림 없이 콘솔에만 남는다 — 사용자는 이미지가 왜 안 붙었는지 알 방법이 없다.

### 5.6 그 외 눈에 띄는 지점

- `index.html:801`, `:928`, `:938`, `:1690`, `:1695`, `:1701`, `:1799` 등 다수의 빈 `catch(e){}` — 대부분 의도적이나 에러 내용이 로깅되지 않아 디버깅이 어렵다.
- `index.html:905` `SETS_KEY="PM_SETS_V7"` — 버전이 박힌 localStorage 키인데 `V1~V6`에서 마이그레이션하는 코드가 없다. 레거시 배포본 사용자의 구버전 데이터는 자동 이관 없이 그냥 보이지 않게 된다.
- `index.html:1189` 문제집 복제 시 `cp.id=uid()`만 새로 발급하고 `problems[].id`는 원본과 동일하게 유지된다 — 두 문제집의 문항 id가 중복 공존하게 되어 향후 id 기반 동기화 로직에서 충돌 소지가 있다.
- `mock-exam-editor.html:1130` `boot()`는 `location.protocol.startsWith('http')`일 때만 자동으로 `pingServer()`를 시도한다 — `file://`로 직접 열면 실시간 렌더 자동 감지가 안 된다(문서화되지 않은 동작).
- `serve.py:189-193` `Content-Length` 헤더 값을 그대로 신뢰해 `self.rfile.read(n)`을 호출한다. 클라이언트가 실제보다 큰 값을 선언하면 해당 커넥션이 타임아웃까지 블로킹될 수 있다(로컬 전용 서버라 실질 위험은 낮음).

---

## 6. 보안 관점

### 6.1 `serve.py`의 방어 메커니즘 — 코드 대응

| 방어 항목 | 구현 위치 | 내용 |
|---|---|---|
| 로컬 전용 바인딩 | `serve.py:241` | `ThreadingHTTPServer(("127.0.0.1", a.port), ...)` |
| Origin 검사 | `_origin_ok()` `:120-125` | Origin 없으면(비브라우저) 통과, 있으면 화이트리스트에 있어야 통과 |
| CORS 화이트리스트 | `_cors()` `:127-139`, `ALLOW_ORIGINS` `:46-48` | `https://071205.github.io` 기본 허용, `--allow-origin`으로 추가 |
| 커스텀 헤더 요구 | `do_POST` `:186-187` | `X-Exam-Client != "1"` → 403, form 등 단순 크로스사이트 요청 차단 |
| 정적 파일 화이트리스트 | `STATIC` dict `:33-42` | 요청 경로를 dict 키와 정확히 일치시켜서만 서빙 — 경로 조작 불가 |
| `typst --root` 제한 | `:87` | `--root WORK`로 typst가 폴더 밖을 못 읽게 제한 |
| `shell=False` | `:92` | 인자 배열로만 서브프로세스 실행 |
| 본문/시간 상한 | `:29`, `:192` | `MAX_BODY=4MB`, `TIMEOUT=25s` |
| 응답 헤더 하드닝 | `_send()` `:141-150` | `no-store`, `nosniff`, `no-referrer` |

문서 상단 주석(`serve.py:12-20`)의 보안 원칙과 실제 구현이 1:1로 대응한다. 눈에 띄는 우회 가능성은 §5.6의 `Content-Length` 신뢰 정도이며, DoS성 리소스 낭비이지 원격 공격 표면 확대는 아니다(127.0.0.1 바인딩이 전제).

### 6.2 Firebase API 키 노출

`index.html:764`의 `apiKey`는 Firebase 공개 웹 API 키로, 클라이언트 노출이 정상이며 비밀키가 아니다. 실제 접근 제어는 Firestore/Storage 보안 규칙(이 저장소에는 규칙 파일 없음)이 담당한다.

### 6.3 `AI_PROXY_URL` 구조

`index.html:1521`의 Cloudflare Worker 주소로 클라이언트는 이미지 base64와 mime 타입만 전송(`:1569-1573`)하며, 실제 AI 공급자 키는 Worker 서버 쪽에만 존재한다고 추정된다(Worker 코드는 이 저장소에 없음). 클라이언트 코드만 보면 AI 키가 노출되는 지점은 없다 — 설계 의도대로 프록시로 키를 숨기는 구조가 맞다.

---

## 7. 외부 의존성 목록

**index.html**: KaTeX 0.16.11(CSS/JS+auto-render, jsdelivr) · `font-kopub@1.0`(jsdelivr, KoPub 바탕) · SortableJS 1.15.2(jsdelivr) · Firebase compat SDK 10.12.0(`app`/`auth`/`firestore`/`storage`, gstatic) · Pretendard Variable(jsdelivr `@import`) · 로컬 `./Adobe Caslon Pro Bold.ttf`(serve.py 구동 시 404, §5.4)

**mock-exam-editor.html**: KaTeX 0.16.11(jsdelivr) · Pretendard Variable(jsdelivr) · Hamchorom(HANBatang/HANBatangB, jsdelivr `projectnoonnu`) · HamchoromD(HCRDotum, jsdelivr) · `local()`로만 참조되는 로컬 설치 폰트(A053 SinMyungjo, 신그래픽체, UnDinaru, HYmjrE 등, 없으면 웹폰트 폴백) · `@preview/mitex:0.2.7`(Typst 패키지 레지스트리, typst 컴파일 시점에 획득)

**serve.py**: 외부 CDN 없음(표준 라이브러리만) · 외부 바이너리 `typst` CLI 필수(없으면 `/render` 실패) · 선택적 폰트 디렉터리 2곳(`~/exam-fonts`, 한컴 HWP TTF 폴더)

**오프라인/CDN 장애 영향**: KaTeX 로드 실패 시 두 파일 모두 수식이 전혀 렌더링되지 않는다. Firebase SDK 로드 실패 시 `index.html`의 두 번째 `<script>` 블록 전체가 `ReferenceError: firebase is not defined`로 즉시 중단되어 저장/로드/편집이 전부 동작하지 않는다(단, 모의고사 진입 IIFE `:583-621`는 이 실패의 영향을 받지 않도록 앞쪽에 별도 등록되어 있음 — 다만 §5.1 버그로 실제로는 무력화된 상태).

---

## 8. UI 상태 관리 패턴

- **프레임워크 없음, 전역 변수가 곧 상태**: `index.html`은 `sets`, `currentSetId`, `currentQId`, `orderMode`, `currentUser`, `saveTimer`, `undoStack`/`redoStack`(`:906-907`, `:999`)을 모듈 스코프 `let`으로 두고 모든 함수가 클로저로 직접 읽고 쓴다. `mock-exam-editor.html`은 `const state={problems, sel, zoom, guides}`(`:333`) 하나로 모으고, 렌더 관련 상태는 `LIVE={on,busy,pending,timer,cache,ppi,base}`(`:979`)로 분리했다.
- **렌더링은 전면 `innerHTML` 재작성**: `renderQList()`/`renderEditor()`/`renderLibrary()`/`renderPreview()`/`buildPrintDoc()`(index.html), `renderPreview()`/`renderEditor()`/`renderOutline()`(mock-exam-editor.html) 모두 컨테이너를 비우고 DOM을 다시 만든다. 다만 타이핑 중인 `<textarea>`/`<input>`의 `oninput` 핸들러는 상태만 갱신하고 자신이 속한 컨테이너를 재렌더하지 않게 되어 있어(`index.html:1435`, `mock-exam-editor.html:571`), keystroke마다 커서가 날아가는 문제는 피하고 있다. 블록 추가/삭제 등 구조 변경만 전체 재렌더로 이어진다.
- **이벤트 바인딩은 매 렌더마다 재부착**: 새 DOM 요소마다 `.onclick=`을 새로 대입(단일 슬롯이라 리스너 누적은 없음). `SortableJS`는 `destroy()` 후 재생성 패턴을 따른다(`setOrderMode()` `:1247-1260`, 블록 정렬 `:1479-1487`).
- **모의고사 모드 IIFE의 독립 등록**: `index.html:583-621`은 본체 스크립트(Firebase 포함)보다 먼저 실행돼 "본체가 실패해도 모의고사 버튼은 동작해야 한다"는 의도를 담았으나, §5.1에서 확인한 대로 두 번째 스크립트 블록이 같은 요소의 `onclick`을 재대입하며 이 의도를 실제로 무력화하고 있다.

---

## 요약: 향후 작업 시 먼저 볼 것

1. **`showMock` 미정의 버그**(`index.html:1804`, 원래 동작하던 핸들러는 `:613`) — "📝 모의고사" 버튼이 콘솔 에러만 내고 아무 동작도 하지 않는다.
2. `mock-exam-editor.html`의 `cases` 환경 처리가 미리보기(`tex()`, `:358-367`)와 Typst 출력(`fixCases()`+`texToTypst()`, `:858-865`)에서 다르게 동작해, 실시간 정본 미리보기를 끈 상태에서는 조건 간격이 어긋나 보인다.
3. Undo/Redo(`index.html:1005`)가 전체 `sets`를 통째로 스냅샷하므로 이미지가 많은 대형 라이브러리에서 메모리/성능 부담이 커질 수 있다.
4. `serve.py`로 구동 시 브랜드 폰트(`Adobe Caslon Pro Bold.ttf`)가 정적 파일 화이트리스트(`serve.py:33-42`)에 없어 항상 404 — 화이트리스트 추가 또는 base64 인라인화 검토.
5. 이미지 업로드 실패 경로 일부(`index.html:1376-1387`, `:1463-1471`)가 사용자에게 아무 피드백 없이 `console.warn`만 남긴다 — 실패 시 토스트 알림 추가 권장.
