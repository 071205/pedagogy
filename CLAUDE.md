# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PEDAGOGY — a Korean math problem-set / mock-exam (모의고사) editor. No build system, no
package manager, no framework: three standalone files. Each `.html` file is a single-page
app with all CSS/JS inlined and dependencies pulled from CDNs (KaTeX, SortableJS, Firebase
compat SDK, Pretendard/KoPub webfonts).

- [`index.html`](index.html) — PEDAGOGY main app: problem-set library + block editor.
- [`mock-exam-editor.html`](mock-exam-editor.html) — 모의고사(mock CSAT exam) editor, embedded
  into `index.html` via an `<iframe>` (see the mock-mode IIFE around line 583 of
  `index.html`). Intentionally isolated: separate global scope, separate storage (`.json`
  file export/import instead of Firestore), separate document — so a failure in one doesn't
  break the other.
- [`serve.py`](serve.py) — optional local Python dev server that compiles the mock editor's
  generated Typst source to PNG page previews with the real exam font/layout, so the
  in-browser approximate preview can be swapped for a pixel-accurate one.

Git remote: `origin` → https://github.com/071205/pedagogy (branch `main`, GitHub Pages로
`https://071205.github.io` 에 배포됨 — `serve.py`의 `ALLOW_ORIGINS`가 이 주소를 허용한다).

## Running it

No build step. Static files can be opened directly, but the mock-editor's "live" pixel-accurate
preview needs the local render server:

```bash
python3 serve.py --open
```

- Serves on `http://127.0.0.1:8787` (binds to 127.0.0.1 only), opens the browser automatically.
- `/` serves `index.html` if present, else falls back to `mock-exam-editor.html`.
- `--port <n>` to change the port; `--allow-origin <https://...>` to allow an additional
  https origin to call `/render` (localhost is always allowed).
- `--lan` 은 같은 와이파이의 다른 기기(아이패드 등)에서 쓰려고 `0.0.0.0` 에 여는 옵션이다.
  **임의 호스트명은 그때도 계속 거절하고**, 이 PC 의 사설 IP 만 Host/Origin 허용에 더한다
  (그렇게 해야 DNS 리바인딩 방어가 유지된다). 이 모드에서는 상용 글꼴을 내보내는
  `/font/` 가 꺼진다. 구글 로그인·AI 변환을 LAN 에서 쓰려면 Firebase '승인된 도메인' 과
  Worker 의 `ALLOWED_ORIGINS` 에 그 IP 를 각각 추가해야 한다(기동 배너가 안내한다).
- Requires `typst` (`brew install typst`) for the `/render` endpoint to actually compile.
  Without it, `/health` still responds but rendering fails with a message telling the user
  to install it.
- Exam fonts are picked up from `~/exam-fonts` and the Hancom HWP app bundle if installed
  (see `FONT_DIRS` in [serve.py](serve.py)); without them, `mock-exam-editor.html` falls
  back to bundled webfonts (Hamchorom) for its in-browser approximate preview.
- No test suite, linter, or formatter exists in this repo.

## Architecture

### index.html (PEDAGOGY main editor)

Vanilla JS, no modules/bundler — everything lives in two inline `<script>` blocks. Key
pieces to know before editing:

- **Data model**: a problem set is `{ id, title, problems: [...] }`; a problem
  (`newProblem()`) is `{ id, title, desc, answer, answerImg, numLabel, paired, blocks: [...] }`.
  Each block is `{ type, data }` where `type` is one of `statement | conditions | examples |
  boxed | choices | image` (see the `#blockType` `<select>` and `blockHTML()`).
- **Persistence, three tiers**: localStorage (`setsKey()`, per-uid) is the always-on cache;
  Firestore is the source of truth when signed in via Firebase Google auth.
  **한 문제집 = 한 문서**: `users/{uid}/sets/{setId}`. 예전처럼 `users/{uid}` 문서 하나에
  `sets` 배열을 통째로 넣지 않는다 — 1MB 한도에 걸리고, 다른 탭이 같은 순간에 저장하면
  그쪽 작업이 통째로 사라졌다. `flushToCloud()` 는 `cloudSynced` 와 비교해 **바뀐 문제집만**
  올린다. 삭제는 실제 삭제가 아니라 `deleted:true` tombstone 이다(다른 기기의 오래된
  사본이 되살리는 것을 막는다). 구버전 `users/{uid}.sets` 문서는 `loadSets()` 가 처음
  한 번 서브컬렉션으로 이관하고, **안전망으로 지우지 않고 남긴다.**
  병합은 `mergeSets(cloudEntries, localSets, localStamps)` 가 **문제집별 `updatedAt`** 을
  비교한다(로컬 시각은 `PM_STAMPS:{uid}` 에 따로 둔다 — `sets` 안에 넣으면 내보내기
  JSON 과 되돌리기 스냅샷까지 오염된다). `watchCloud()` 가 `onSnapshot` 으로 다른 탭·기기
  변경을 받아 반영한다.
  `snapshotLocalBackup()`/`window.restorePedagogyBackup()` keep an extra local safety copy.
  **로컬 키는 전부 계정별로 갈라져 있다** — `setsKey()`, `backupKey()`, `lastQKey()`,
  `stampsKey()`, `lastSetKey()`. 새 로컬 키를 추가할 때도 반드시 uid 를 붙일 것(공용 키로 두면 한 브라우저에서
  계정을 바꿨을 때 데이터가 샌다).
  Firebase project config (`firebaseConfig`) is a public web API key, not a secret.
  ⚠️ **`firestore.rules` 의 필드 화이트리스트를 함께 고칠 것** — `sets/{setId}` 문서에
  필드를 추가하면 `hasOnly([...])` 목록에 넣어야 저장이 '권한 오류' 로 실패하지 않는다.
- **Undo/redo**: `pushHistory()`/`doUndo()`/`doRedo()` snapshot the *entire* `{sets,
  currentSetId, currentQId}` state as JSON strings — simple but means any state field that
  should be undoable must go through `sets`, not a side channel.
- **Image handling**: `storeImageFile()` uploads to Firebase Storage
  (`users/{uid}/images/...`) and stores just the download URL when signed in (keeps
  Firestore docs under the 1MB limit); when signed out it falls back to a
  resized/compressed base64 data URL via `compressDataUrl()`. `migrateBase64ToStorage()`
  lazily upgrades old base64-embedded images to Storage URLs on next save.
  `isStorageUrl()`/`isDataUrl()` distinguish the two representations wherever images are read.
  Answer images and block images (`type:"image"`) both go through this path.
  **업로드 상한은 5MB 이고 `storage.rules` 의 값과 반드시 같아야 한다**
  (`MAX_UPLOAD_BYTES` ↔ 규칙의 `request.resource.size`). 클라이언트 검사는 편의일 뿐
  실제 방어선은 규칙이다. 압축(`dataUrlToJpegBlob`)이 실패하면 **원본을 올리지 않고
  거절한다** — 예전엔 폴백으로 원본을 그대로 올려서, 확장자만 이미지인 파일이나
  크롬이 못 읽는 HEIC 가 크기 제한 없이 Storage 로 들어갔다.
  AI 로 보낼 때는 `prepImageForAI()` 가 긴 변 1568px·JPEG 0.8 로 줄인다. 1568 은
  모델이 실제로 보는 해상도 상한이라 그 이상 보내도 화질·토큰이 같고 업로드 시간만
  버린다. canvas 를 거치므로 아이폰 HEIC 도 JPEG 로 바뀌어 공급자가 받는다.
  ​Never inline real API keys/secrets for third-party services other than the already-public
  Firebase web config; the `AI_PROXY_URL` Cloudflare Worker endpoint exists specifically so
  the actual AI provider key stays server-side.
- **신뢰 경계 (중요)**: 가져온 `.json`, **AI 응답, 클라우드에서 읽은 데이터** 모두 신뢰하지
  않는다. `normSet()`/`normProblem()`/`normBlock()`이 화이트리스트로 정규화하고, 이미지
  URL은 `safeUrl()`이 Firebase Storage / `data:image` 로만 제한하며, `sanitize()`가
  `& < > " '`를 모두 이스케이프한다. `aiBlocksToProblem()` 도 `normProblem()` 을 거친다.
  `normSet(s, opts)` 의 `maxProblems` 기본값 500 은 **가져오기 전용 방어선**이다 —
  클라우드 데이터에 그 값을 쓰면 N제 문제집이 조용히 잘린다. `docToSet()` 처럼
  `{keepId:true, maxProblems:CLOUD_MAX_PROBLEMS}` 를 넘길 것.
  **새 렌더 경로를 추가하거나 사용자 값을 HTML 속성에 넣을 때는 반드시 이 헬퍼들을 거칠 것** —
  과거 이게 없어서 악성 문제집 파일 하나로 로그인된 Firestore 데이터를 읽어갈 수 있었다.
  블록 타입·`layout`·이미지 `size` 같은 열거값은 렌더 시점에도 한 번 더 고정한다.
  ⚠️ **가장 조심할 곳은 `processText()` 의 `$$…$$` 복원 단계다.** 본문은 `sanitize()` 를
  거치는데 수식 블록만 따로 빼놨다가 되돌려 넣기 때문에, 여기서 `sanitize()` 를 빠뜨리면
  `$$</div><img src=x onerror=…>$$` 한 줄로 XSS 가 뚫린다(실제로 그랬다).
  KaTeX 는 `textContent` 를 읽으므로 이스케이프해도 `cases` 의 `&`, 부등호, `array` 표가
  전부 정상 렌더된다 — **수식이 깨질까 봐 이스케이프를 빼면 안 된다.**
- **CSP · SRI**: `<head>` 에 CSP `<meta>` 가 있어 인라인 **이벤트 핸들러 속성**(`onerror=`)이
  차단된다(렌더 경로에 구멍이 생겨도 실행되지 않는 2차 방어선). CDN 태그에는 전부
  `integrity` 해시가 붙어 있다 — **버전을 올리면 해시도 반드시 다시 계산할 것**
  (`openssl dgst -sha384 -binary <파일> | openssl base64 -A`). 새 외부 호스트를 부르게 되면
  CSP 의 `connect-src`/`img-src`/`font-src` 에도 추가해야 한다.
  Pretendard 는 `<link>` 로 부른다 — `<style>` 안 `@import` 는 CSS 규격상 `@font-face` 보다
  뒤에 오면 통째로 무시되어, 예전엔 본문이 계속 시스템 고딕으로 렌더됐다.
- **AI-assisted problem entry**: `aiGenerateFromImage()` posts a photographed problem image
  to a Cloudflare Worker proxy (`AI_PROXY_URL`), which returns structured `blocks`;
  `aiBlocksToProblem()` converts the response into the normal problem shape and appends it
  to the current set.
- **Render pipeline**: `renderPreview()` builds live HTML preview from a problem's blocks;
  `processText()`/`autoDisplayStyle()` do LaTeX/typography preprocessing (auto `\displaystyle`,
  spacing rules) before KaTeX renders `$...$` spans (KaTeX auto-render is re-run after each edit).
  `buildPrintDoc()` builds a separate print-specific DOM (`#printDoc`) consumed by
  `doPrint()`/`window.print()` for the "인쇄/PDF 저장" export flow — this is a **distinct**
  layout pass from the on-screen preview (multi-column typesetting, answer-key toggling), so
  changes to block rendering usually need to be made in both places.

### mock-exam-editor.html (모의고사 editor)

Also vanilla JS, single inline script, fully self-contained (own KaTeX include, own state,
own save/load — does not share PEDAGOGY's Firebase storage).

- **Data model**: `state.problems` is a fixed array of 30 (extendable to 60) slots from
  `blank(n)` — `{id, num, sect, type, pts, stmt, conds, useCond, choices, layout, figure,
  breakAfter}` — pre-seeded with Korean-CSAT-style scoring (`PTS`) and section rules
  (문항 1–22 공통, 23–30 선택; 문항 1–15/23–28 5지선다, 나머지 단답형).
- **Persistence**: no localStorage — `saveJSON()`/`#loadInput` export/import a `.json` file
  directly (there's a `beforeunload` guard warning about unsaved changes instead).
- **Two-stage rendering**:
  1. `renderPreview()` (backed by `layoutOf()`/`renderProb()`/`buildPages()`) — an
     in-browser approximate layout using CSS/canvas text measurement (`measureCh()`) to
     mimic the real exam's column/character-count rules.
  2. `typstSource()`/`probTypst()`/`sheetTypst()` — convert the same state into actual Typst
     markup (`texToTypst()` converts LaTeX to Typst math syntax), sent to `serve.py`'s
     `/render` endpoint by `doRender()` when "실시간 정본 미리보기" (live mode) is on
     (`pingServer()` checks `serve.py` is reachable first, `LIVE.cache` avoids
     re-transferring unchanged page images by hash).
  Both paths must stay in sync with the state model; the Typst path is the one that produces
  the actual exportable/printable document, the CSS path is only an approximation for when
  the local server isn't running.
- **그림 경로**: `probTypst()` 는 `#image("/파일명")` 처럼 **앞에 `/` 를 붙여** 낸다.
  Typst 에서 `/` 는 '루트 기준' 이라, 실시간 렌더에서는 `--root` 인 `work/` 를,
  내보낸 `.typ` 을 직접 컴파일할 때는 그 `.typ` 이 있는 폴더를 가리켜 **양쪽 다 맞는다**.
  상대경로로 두면 실시간에서 절대 못 찾는다 — `serve.py` 가 `main.typ` 을 `work/` 밑
  **임시 폴더**에 쓰기 때문에 `work/fig.png` 를 둬도 `work/tmpXXXX/fig.png` 를 뒤진다.
- Keyboard shortcuts: ⌘S save JSON, ⌘E export Typst, ⌥↑/↓ move between problems.

### serve.py

Deliberately locked down (see the security comment block at the top of the file) since it
executes a subprocess (`typst compile`) based on user-supplied source: binds to 127.0.0.1
only, checks `Origin` against an allowlist, requires a custom `X-Exam-Client` header on
`POST /render`, caps body size and compile time, restricts `typst --root` to the `work/`
directory, and never uses `shell=True`. Preserve these constraints when modifying it —
they're the whole reason this is safe to run as a local dev server that a remote GitHub
Pages–hosted `index.html` can also call into (via `--allow-origin`).

## 다음 세션 이어서 할 일 (2026-08-24 기준)

`ANALYSIS.md` 는 2026-08-20 기준 문서라 **지금 코드와 다르다**(특히 저장 구조).
2026-08-24 감사에서 지적된 항목은 아래 '처리 완료'를 빼고 모두 반영했다.

### 코드 밖 — 반드시 해야 할 것 (남은 최우선 항목)

- **`firestore.rules` / `storage.rules` 를 Firebase 에 실제로 배포해야 한다.**
  두 파일은 이 저장소에 있지만 **배포하기 전까지는 아무 효력이 없다.**
  콘솔 규칙이 `allow read, write: if request.auth != null` 수준이면
  로그인한 아무나 다른 사용자의 데이터를 읽어갈 수 있다.
  - 콘솔: Firestore Database → 규칙 / Storage → 규칙 에 붙여넣고 게시
  - CLI: `firebase deploy --only firestore:rules,storage`

  ⚠️ **이번에 `firestore.rules` 가 크게 바뀌었다** — 저장 구조가
  `users/{uid}` 문서 하나에서 `users/{uid}/sets/{setId}` 서브컬렉션으로 옮겨졌다.
  **새 규칙을 배포하지 않으면 로그인 사용자의 저장이 전부 '권한 오류' 로 실패한다.**
  배포 후 반드시 이 순서로 확인할 것:
  로그인 → 문제집 저장(✓ 저장됨 확인) → 이미지 첨부 → 새로고침 후 내용 유지 →
  문제집 삭제 → 새로고침해도 되살아나지 않는지.

- **첫 로그인 시 자동 이관이 일어난다.** 기존 `users/{uid}.sets` 배열을 읽어
  서브컬렉션으로 복사한다. **구버전 문서는 지우지 않는다**(안전망).
  이관이 잘못돼도 콘솔에서 예전 문서를 그대로 볼 수 있다.

- **AI Worker 를 다시 배포할 것.** `worker/index.js` 의 배포 안내가 `AI_API_KEY` 로
  적혀 있었는데 코드는 `ANTHROPIC_KEY` 를 읽는다. 문서만 고쳤으므로 동작에는 영향이
  없지만, 그 안내를 보고 secret 을 새로 넣었다면 이름을 확인할 것.

### 자료 추가 필요
- **브랜드 글꼴 파일이 레포에 없다**: `Adobe Caslon Pro Bold.ttf`.
  `serve.py` 화이트리스트 등록과 `local()` 폴백은 끝났으므로, 시스템에 설치돼 있으면
  이미 정상 표시된다(없으면 콘솔에 404 하나가 뜬다 — 기능에는 영향 없음).
  파일을 레포에 넣으면 배포본(GitHub Pages)에서도 적용된다.
  넣지 않을 거면 `index.html` 의 `@font-face` 와 `serve.py` 의 STATIC 항목을 지울 것.

### 글꼴 라이선스 (코드 밖 · 미해결)
- `FONT-LICENSE.md` 의 견적 문의를 아직 보내지 않았다. 상용화 전 필수.
  참고: serve.py 의 `/font/` 는 이제 Host 검사로 외부에서 못 받아간다 —
  "글꼴 파일이 사용자에게 전송되지 않는다"는 견적 전제가 이제 실제로 참이다.

### 의도적으로 하지 않은 것 (이유 포함)
- **Undo/Redo 를 문항 단위 diff 로 재작성하지 않았다.** 실측해 보니 문항 하나가
  약 568 B 라 300문항이어도 한 스냅샷이 ~170 KB, `JSON.stringify` 는 1~2 ms 수준이다.
  체감 지연의 원인이 아니었다. 핵심 문제였던 **메모리 상한이 `redoStack` 에
  적용되지 않던 버그**는 고쳤다(`trimHistory()` 가 두 스택을 합쳐서 센다).
  실제로 타이핑 지연이 관찰되면 그때 diff 로 가는 게 맞다.
- **ES module 로 파일을 쪼개지 않았다.** ES module 은 `file://` 에서 CORS 로 막혀,
  "파일을 그대로 열어서 쓴다"는 이 저장소의 전제가 깨진다. 대신 파일 안에서
  이스케이프 정책을 한곳으로 모으고 저장 계층을 분리했다.
  쪼갤 거라면 로컬 서버 사용을 전제로 바꾸는 결정이 먼저다.

### 더 깊게 손보고 싶다면 (선택)
- **모의고사 편집기의 근사 미리보기와 Typst 정본**: 두 경로가 여전히 별도 코드다
  (`renderProb()` vs `probTypst()`). 새 서식을 추가할 때마다 양쪽을 함께 고쳐야 한다.
- **AI Worker 의 일일 한도**가 KV 기반이라 원자적이지 않다(코드 주석에 명시돼 있다).
  병렬 호출로 상한을 넘길 수 있다. 근본 해결은 Durable Object.
- **본체 인쇄 경로와 미리보기의 축소 로직**이 여전히 별개다
  (`fitPrintDoc()` vs `fitMathIn()`) — 선지 줄바꿈 보정은 인쇄에만 있다.

### 2026-08-25 (2차)
새로고침하면 편집 중이던 문제집에서 라이브러리로 튕기던 동작 수정.
`lastSetKey()` 로 마지막에 연 문제집을 계정별로 기억하고 `bootLibrary()` 가
복원한다. 라이브러리로 나가면(`showLibrary()`) 기억을 지우므로, 로고를 눌러
나간 뒤 새로고침하면 라이브러리로 남는다. 문제집이 사라졌으면 안전하게
라이브러리로 떨어진다(`showEditor()` 가 `activeSet()` 없음을 먼저 확인 —
예전엔 여기서 TypeError 로 화면이 빈 채 멈출 수 있었다).

### 2026-08-25 추가 반영
AI 전송 이미지 자동 축소(`prepImageForAI`, 1568px/JPEG 0.8 — 모델 해상도 상한과 일치,
HEIC 도 함께 해결), Storage 업로드 5MB 상한 + 압축 실패 시 원본 업로드 차단,
`storage.rules` 10MB→5MB, 가져오기에서 외부 이미지가 조용히 사라지던 문제에 안내 추가
(`normDropped`/`reportNormDropped`), 모의고사 그림이 실시간 렌더에서 아예 안 나오던
버그(`#image` 경로) 수정, `serve.py --lan` (사설 IP 만 허용 · `/font/` 차단 · 경고 배너).

### 2026-08-24 감사에서 처리 완료
`$$` 블록 XSS 차단(가장 위험했던 항목), `numLabel` 미리보기 XSS, CSP + CDN SRI 전면 적용,
Pretendard `@import` 무시되던 버그, Firestore 문제집 단위 문서 전환(1MB 한도·다중 탭
덮어쓰기 동시 해결), `updatedAt` 기반 병합, 삭제 tombstone, `onSnapshot` 다중 탭 반영,
`setHasContent` 의 `d.src`→`dataUrl`(이미지 전용 문제집 소실), 계정별 로컬 키 분리
(`PM_BACKUP`/`PM_LAST_Q`/`PM_STAMPS`), `beforeunload`·`visibilitychange` 저장 보장,
undo/redo 후 클라우드 반영, `redoStack` 메모리 상한, AI 응답 `normProblem()` 통과,
JSON 가져오기 크기·개수 상한, Storage 고아 이미지 정리, serve.py Host 검사(DNS 리바인딩),
`/health` 로컬 경로 노출 제거, Typst `//` 주석 버그(`tq()`), 모의고사 `esc()` 따옴표 방어,
죽은 `gauge()` 제거, Worker 키 이름 문서 불일치.
