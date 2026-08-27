# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PEDAGOGY — a Korean math problem-set / mock-exam (모의고사) editor. No build system, no
package manager, no framework: the product is two standalone files (plus a dev server and a
test harness, below). Each `.html` file is a single-page app with all CSS/JS inlined and
dependencies pulled from CDNs (KaTeX, SortableJS, Firebase compat SDK, Pretendard/KoPub
webfonts).

- [`index.html`](index.html) — PEDAGOGY main app: problem-set library + block editor.
- [`mock-exam-editor.html`](mock-exam-editor.html) — 모의고사(mock CSAT exam) editor, embedded
  into `index.html` via an `<iframe>` (see the mock-mode IIFE around line 583 of
  `index.html`). Intentionally isolated: separate global scope, separate storage (`.json`
  file export/import instead of Firestore), separate document — so a failure in one doesn't
  break the other.
- [`serve.py`](serve.py) — optional local Python dev server that compiles the mock editor's
  generated Typst source to PNG page previews with the real exam font/layout, so the
  in-browser approximate preview can be swapped for a pixel-accurate one.
- [`regression-test.html`](regression-test.html) — browser-based regression suite covering
  both apps (see "Testing" below). Not part of the shipped product; only reachable through
  `serve.py`.

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
- No linter or formatter exists in this repo. There is a regression suite — see "Testing" below.

## Testing

[`regression-test.html`](regression-test.html) loads `index.html` and `mock-exam-editor.html`
each in their own `<iframe>` and re-runs, in one pass, the checks that were previously done
by hand in the terminal/browser-console during review (security/XSS, trust-boundary
normalization, account-scoped storage keys, choices-preservation logic, responsive
breakpoints, dead-code-should-stay-dead). Run it via:

```bash
python3 serve.py --port 8799
```

then open `http://127.0.0.1:8799/regression-test.html`. **Opening the file directly (`file://`)
does not work** — Chrome treats `file://` documents as cross-origin from each other, so the
test page can't reach into the iframes; it shows a banner explaining this instead of failing
silently. (If you ever rename this file, update its entry in `STATIC` in `serve.py` too — that
whitelist is exact-match, so a stale entry just 404s.)

**A check that always passes is worse than no check.** Every trap below was found by
deliberately breaking the thing under test and confirming the suite went red — do that for any
new check you add, because three separate "all-green while testing nothing" bugs happened here:

- **`const`/`let` top-level bindings in `index.html`/`mock-exam-editor.html` are invisible via
  `iframe.contentWindow.xxx`** — only `var`/`function` declarations become `window` properties;
  `const sanitize=...`, `const MAX_UPLOAD_BYTES=...`, `const ICON=...` etc. live in a lexical
  scope private to that document's own scripts. `eval`-ing inside the iframe to reach them is
  not an option either — both apps' CSP has no `unsafe-eval` (deliberately; do not add it for
  testing convenience). The working fix, `installHooks()` in `regression-test.html`: inject a
  real `<script>` element into the iframe's own document (allowed — CSP `script-src` already
  has `'unsafe-inline'`, which is a separate grant from the event-handler-attribute block) that
  assigns the names it can see into `window.__HOOKS__`, then read that object from the parent.
- **XSS-probe `<img onerror>` markers need the test `<div>` attached to `document` *and* a short
  `await` before checking the flag.** A detached `div.innerHTML = "<img onerror=...>"` never
  fires in current Chrome (image loading is deferred until the element is connected), and even
  once attached, `onerror` arrives asynchronously — checking the marker synchronously right
  after the assignment always reads `0`. Both were verified by deliberately feeding the helper
  a real unescaped payload and confirming it correctly reported "unsafe" before trusting it to
  test the app.
- **A probe that writes must use a value unique per run, and must restore what it overwrote.**
  The `wiping` check works by setting the flag, calling `writeLocalNow()`, and asserting nothing
  reached `localStorage`. Two ways that went wrong: a *fixed* marker string meant that once the
  guard genuinely broke and the marker leaked, the leftover kept the check red on every later
  run even after the fix (looked like a caching problem for a while); and the leaked probe had
  overwritten the real `PM_SETS_V7:*` key — a test that destroys user data when it fails. It now
  uses a timestamped marker and restores the original value in every path.
- **The iframes are loaded with a `?t=<now>` cache-buster.** Without it the suite happily
  re-tests a stale cached copy of `index.html`, so edits appear to have no effect.
  (`serve.py` strips the query string before its exact-match `STATIC` lookup, so this is safe.)

The suite never calls anything that persists (`saveSets`, `flushToCloud`, `saveJSON`, ...), so
it's safe to run against a signed-in profile with real data — it only calls pure functions
(`sanitize`, `normSet`, `processText`, `tex`, ...) or mutates throwaway fixture objects
(`blank(1)` in the mock editor), never the live `sets` / `state.problems` arrays. The one
exception is `showLibrary()` (used for a layout check), which is a pure navigation call with no
data side effect beyond clearing the "last opened set" pointer — the same thing that happens
when a real user clicks the logo.

## Architecture

### index.html (PEDAGOGY main editor)

Vanilla JS, no modules/bundler — everything lives in two inline `<script>` blocks. Key
pieces to know before editing:

- **Data model**: a problem set is `{ id, title, problems: [...] }`; a problem
  (`newProblem()`) is `{ id, title, desc, answer, answerImg, numLabel, paired, blocks: [...] }`.
  Each block is `{ type, data }` where `type` is one of `statement | passage | conditions |
  examples | boxed | choices | image` (see the `#blockType` `<select>` and `blockHTML()`).
- **지문 세트 (국어·영어)**: `passage` 블록 + 문항의 `groupSpan`.
  지문 블록을 가진 문항이 세트의 첫 문항이고, `groupSpan` 은 그 지문을 함께 쓰는
  문항 수(자기 포함, 1~10)다. 뒤 문항에는 지문 블록을 넣지 않는다 — 지문은 첫
  문항의 블록으로 한 번만 그려지고, `computeNums()` 가 `[01~03]` 범위 라벨을
  만들어 `blockHTML(blk, ctx)` 의 `ctx.range` 로 넘긴다(블록 혼자서는 자기가 몇
  번부터 몇 번까지를 대표하는지 알 수 없다). 범위 끝은 배열 밖으로 못 나가게
  자른다 — 큰 `groupSpan` 을 두고 뒤 문항을 지우면 없는 번호를 가리킨다.
- **시험지 선 색**: 문제집의 `lineColor`. `SHEET_COLORS` 목록 안의 값만 쓰고
  실제 색은 `sheetHex()` 가 준다. 이 값은 `style` 의 `--sheet-line` 으로 들어가므로
  ⚠️ **자유 문자열을 받으면 안 된다**(가져온 .json 으로 임의 CSS 가 섞인다).
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
- **데이터 관리 (라이브러리 → '데이터 관리' 버튼 · `#dataModal`)**: 백업 되돌리기 ·
  모든 문제집 삭제 · 계정 삭제. 되돌릴 수 있는 것과 없는 것을 UI 에서도 코드에서도
  갈라 둔다 — **'모든 문제집 삭제'는 계정을 남기고 로컬 백업을 남겨 복구 가능**,
  **'계정 삭제'는 백업까지 지우고 Auth 계정까지 없앤다(복구 불가)**.
  건드릴 때 반드시 지켜야 하는 것들:
  - ⚠️ **`wiping` 플래그**. 삭제 중 `saveSets()`/`writeLocalNow()`/`flushToCloud()` 를
    전부 막는다. 없으면 디바운스 저장·`visibilitychange`·`beforeunload` 가 끼어들어
    방금 지운 걸 도로 쓴다(계정 삭제 중이면 곧 사라질 uid 앞으로 문서를 만들어 고아가 된다).
    새 저장 경로를 추가하면 이 가드도 같이 걸 것.
  - ⚠️ **삭제 전에 `setsUnsub()` 로 구독을 끊는다.** 안 끊으면 우리가 쓴 tombstone 을
    `watchCloud()` 가 도로 읽어 `sets` 를 건드리고, 끝에 '비었으니 새 문제집 하나'
    로직이 돌아 빈 문제집이 되살아난다. `finally` 에서 다시 구독한다.
  - ⚠️ **계정 삭제 순서**: 재인증 → 이미지 → 문제집 문서 → `users/{uid}` → **Auth 계정(마지막)**.
    재인증을 맨 앞에 두는 이유는 `auth/requires-recent-login` 이 데이터를 지운 *뒤에*
    터지면 '데이터는 날아갔는데 계정은 남은' 상태가 되기 때문이고, Auth 를 마지막에
    두는 이유는 계정이 먼저 사라지면 규칙의 `request.auth.uid` 가 안 맞아 남은 데이터를
    영영 못 지우기 때문이다.
  - 삭제 대상은 **로컬 `sets` 가 아니라 클라우드 컬렉션을 실제로 읽어서** 정한다
    (다른 기기에서 만들고 아직 안 내려온 문제집이 남지 않게). Firestore 배치는 400개씩 끊는다.
  - 이미지는 `sets` 안의 URL 이 아니라 `users/{uid}/images` 를 `listAll()` 로 훑어 지운다
    (정리에 실패해 남은 고아 파일까지 포함하려면 폴더를 직접 봐야 한다).
  - ⚠️ **`firestore.rules` 의 `users/{uid}` 는 `create, update` 와 `delete` 를 나눠 뒀다.**
    예전처럼 `allow write` 하나로 묶으면 삭제 요청에는 `request.resource` 가 null 이라
    `hasOnly(...)` 가 평가되지 못해 거부된다 — 계정 삭제가 이 문서만 못 지우고 남긴다.
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

  ⚠️ **'계정 삭제' 기능을 넣으면서 `firestore.rules` 가 또 바뀌었다.**
  `users/{uid}` 의 `allow write` 를 `allow create, update` + `allow delete` 로 쪼갰다
  (이유는 위 '데이터 관리' 항목 참고 — 안 쪼개면 계정 삭제가 이 문서를 못 지운다).
  **이 규칙을 배포하기 전까지는 계정 삭제가 `users/{uid}` 문서 하나를 남긴다.**
  문제집·이미지·Auth 계정은 정상적으로 지워지므로 데이터가 새지는 않지만,
  빈 문서가 콘솔에 남는다. 배포 후 확인:
  계정 삭제 → Firestore 콘솔에서 `users/{그 uid}` 가 통째로 사라졌는지 · Storage
  `users/{그 uid}/images` 가 비었는지 · 그 구글 계정으로 다시 로그인하면 새 계정처럼
  빈 상태로 시작하는지.

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

### 2026-08-25 (6차) — 라이트하우스 (모바일)
`Performance 69 / A11y 90 / Best Practices 73 / SEO 91` 에서 출발.

- **렌더 차단 제거가 제일 컸다(실측 2,010ms).** Firebase SDK 4개와 SortableJS 가
  `defer` 없이 `<script src>` 라 파싱을 막고 있었다. LCP 요소는 '문제집 라이브러리'
  라는 h2 한 줄인데 6.3초가 걸렸다.
  ⚠️ **`defer` 를 붙이면 인라인 스크립트가 SDK 보다 먼저 돈다.** 그래서
  `firebase.initializeApp` 을 `initFirebase()` 로 빼고 `DOMContentLoaded` 에서
  `startApp()` 이 부른다. 이걸 안 하면 항상 오프라인 모드로 떨어진다.
- **흰 글자 위 파란 배경**(`#3182F6`)이 대비 3.71:1 로 AA(4.5:1) 미달이었다.
  `--blue-on-white-text:#2B6FD6`(4.83:1)를 따로 두고 글자가 얹히는 4곳에만 쓴다.
  테두리·포커스링은 브랜드색 `--blue` 를 그대로 둔다.
- `<main id="appMain">` 으로 세 뷰를 묶었다(랜드마크 없음 지적). `#printDoc` 은 밖.
- `meta description` 추가, 없는 `Adobe Caslon Pro Bold.ttf` 의 `url()` 제거
  (404 콘솔 오류 + 낭비 요청).

**고칠 수 없는 것 — 점수만 보고 쫓지 말 것**
- `third-party-cookies` 10개는 전부 `apis.google.com` 것이다. Firebase 구글 로그인이
  쓰는 iframe 이라 **인증 도메인을 자체 도메인으로 옮기지 않는 한 없앨 수 없다.**
- 콘솔 오류 3건 중 2건은 **크롬 확장 프로그램**이 blob: 스크립트를 주입하려다
  우리 CSP 에 막힌 것이다. 우리 코드 문제가 아니다(시크릿 창에서 재측정하면 사라진다).
  CSP 에 `blob:` 을 열어 주는 건 확장 하나 때문에 방어를 푸는 것이라 하지 않았다.

### 2026-08-25 (5차) — 성능 (실측 기반)
숫자는 전부 브라우저에서 잰 것이다. 추정치가 아니다.

| 대상 | 전 | 후 |
|---|---|---|
| 타이핑 1글자 로컬 저장 (2.9MB, 비로그인 이미지) | 6.1ms | **0.005ms** |
| 모의고사 타이핑 1글자 · 전체보기 | 78.4ms | **0.0ms** |
| 모의고사 타이핑 1글자 · '이 문항'(기본) | 8.2ms | **1.7ms** |
| 인쇄 보정 `fitPrintDoc` (300문항·수식 2100) | 1616ms | **265ms** |

- **로컬 저장 디바운스(150ms).** 예전엔 키를 칠 때마다 `sets` 전체를 동기로 썼다.
  텍스트만이면 0.1~0.5ms 라 문제없지만 base64 이미지가 섞이면 6.1ms 로 올라간다.
  **`flushLocal()` 로 창 닫기·탭 숨김·되돌리기·수동 저장·클라우드 업로드 직전에는
  즉시 쓴다** — 디바운스가 데이터 안전을 해치지 않게 하는 게 핵심이다.
  타이핑 경로(`saveSets`)만 `persistLocal()` 을 쓴다.
- **모의고사 전체보기 디바운스(220ms).** 한 글자마다 8쪽·30문항을 통째로 다시
  조립하고 있었다. LIVE 모드가 이미 하던 것과 같은 방식으로 미룬다. 모드 전환과
  순서도 클릭은 디바운스를 우회해 즉시 그린다. 순서도(`renderOutline`)도 문항마다
  `measureCh()` 로 KaTeX 를 105회 돌려 함께 미뤘다.
- **레이아웃 스래싱 제거.** 요소마다 '스타일 쓰기 → 크기 읽기' 를 번갈아 하면
  브라우저가 매번 레이아웃을 다시 계산한다. `shrinkWideMathAll()` 이 **전부 지우고
  → 전부 재고 → 전부 적용**한다. `fitPrintDoc()` 의 네 단계도 모두 읽기·쓰기를
  분리했다. **새 보정을 추가할 때 이 순서를 깨지 말 것.**
  참고: 미리보기(`fitMathIn`, 수식 25개)에서는 0.1ms 라 원래 병목이 아니었다 —
  이 최적화가 값어치를 하는 곳은 문서 전체를 한 번에 처리하는 인쇄다.

### 2026-08-25 (4차) — 인쇄 보정이 아예 동작하지 않던 문제
**가장 큰 것: `fitPrintDoc()` 은 지금까지 한 번도 실행된 적이 없었다.**
`#printDoc` 은 평소 `display:none` 이고 `@media print` 에서만 `block` 이 되는데,
`doPrint()` 는 `window.print()` **전에** 폭·높이를 잰다. `display:none` 이면
`clientHeight`·`scrollWidth`·`getBoundingClientRect()` 가 전부 0 이라 모든
보정이 조용히 건너뛰어졌다(실측 확인). 그래서 넘치는 수식·긴 문항이
`overflow:hidden` 에 그냥 잘려 나갔다.
→ 잴 때만 `#printDoc.measuring` 으로 화면 밖(`left:-10000px`)에 실제 크기로
   펼친 뒤 측정하고, `finally` 로 반드시 되돌린다.

그 위에 얹힌 문제 둘:
- **가로 넘침 판정이 틀렸다.** `getBoundingClientRect().width` 는 '칸에 맞춰
  이미 잘린 폭' 이라 칸 폭을 절대 넘지 않는다(실측: rect 334 / 실제 555).
  `scrollWidth` 로 재야 한다. 화면용 `fitMathIn()` 은 원래 맞게 하고 있었고
  인쇄용만 틀렸다 — 미리보기와 인쇄가 달랐던 이유. 이제 두 경로가
  **`shrinkWideMath()` 하나**를 공유한다.
- **축소만 하면 내용이 잘린다.** `scale` 은 그리는 크기만 줄이므로 박스 폭이
  칸에 묶여 있으면 내용은 여전히 그 폭에서 잘린다. 실제 내용 폭을 `width` 로
  준 뒤 `scale` 해야 전체가 보인다. 높이는 `scale` 만큼 다시 지정해 유령 여백을 없앤다.
- **세로 넘침도 못 잡았다.** `.slot` 이 flex 컨테이너라 자식이 `flex-shrink` 로
  눌려 `slot.scrollHeight === clientHeight` 가 된다(실측: 둘 다 979, 실제 3565).
  자식들의 `scrollHeight` 합으로 재고, 하한(72%)으로도 안 담기면 **토스트로 알린다**
  — 예전엔 잘린 시험지가 아무 말 없이 인쇄됐다.
- `@page` 에 `size:A4` 명시(없으면 Letter 기본 환경에서 빈 쪽이 딸려 나온다),
  인쇄 모달에 용지·배율·여백·머리글 설정 안내, `doPrint()` 에 강제 reflow +
  120ms 대기(폰트 적용 전 측정 방지).

⚠️ **자동 페이지네이션은 넣지 않았다.** 이 앱은 문항별 `span`(pair/col/page)으로
사용자가 배치를 직접 정하는 모델이라, 넘칠 때 다음 단으로 자동 이월하면 그
의도를 덮어쓴다. 대신 담기지 않으면 '한 쪽 배치로 바꾸거나 내용을 나누라' 고
안내한다. 자동 이월을 원하면 배치 모델 자체를 바꾸는 결정이 먼저다.

### 2026-08-25 (3차) — 경합·데이터 소실 방어
- **AI 변환 중 화면 이동**: `aiGenerateFromImage()` 가 요청 시점의 문제집을 캡처해
  두고 완료 시 그대로 밀어 넣어, 그 사이 다른 문제집으로 옮기면 `currentSetId` 와
  `currentQId` 가 서로 다른 문제집을 가리켰다(`activeQ()` 가 undefined). 이제
  결과는 '요청한 문제집' 에 넣되 **포커스는 그 문제집을 보고 있을 때만** 옮기고,
  아니면 어디 들어갔는지 토스트로 알린다. 그 문제집이 삭제됐으면 안내하고 버린다.
- **Storage 고아 이미지**: 이미지 블록을 다른 종류로 바꾸거나 블록·문항을 지우면
  Firestore 에서만 사라지고 Storage 원본은 영영 남았다. `releaseImage()` /
  `releaseBlockImages()` / `releaseProblemImages()` 가 정리한다.
  **다른 문제집이 같은 주소를 쓰면 지우지 않는다**(복제본 보호).
- **선지 소실**: 모의고사 순서도에서 문항을 단답형 자리에 스치기만 해도
  `syncChoicesBlock()` 이 선지 블록을 `splice` 로 없애 5개가 영구 삭제됐다.
  이제 **지우지 않고 숨긴다** — `probUnits()` 가 단답형일 때 선지 유닛을 건너뛰고,
  편집기에는 '시험지에는 안 나와요' 안내를 단다. 객관식으로 되돌리면 그대로 살아난다.
- **임시저장**: 복구 확인창에서 '취소'(또는 ESC)를 누르면 `clearDraft()` 로 즉시
  영구 삭제했다. 이제 백업을 남기고 툴바에 `↩︎ 임시저장 복구` 버튼을 띄운다.
- **로그인 직후 빈 화면**: 클라우드에서 읽는 몇 초 동안(첫 로그인은 이관까지 하느라
  더 길다) '아직 문제집이 없어요' 가 떠서 데이터가 날아간 줄 알았다.
  `showLibraryLoading()` 으로 '불러오는 중' 을 보여 준다.

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
