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

There is no `.git` repository initialized in this working directory yet.

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
- **Persistence, three tiers**: localStorage (`SETS_KEY`) is the always-on cache; Firestore
  (`users/{uid}` doc, one doc per user holding all sets) is the source of truth when signed
  in via Firebase Google auth; `loadSets()` merges cloud + local on login
  (`mergeSets`/`localSetsWorthMerging`) so offline edits aren't silently dropped.
  `snapshotLocalBackup()`/`window.restorePedagogyBackup()` keep an extra local safety copy.
  Firebase project config (`firebaseConfig`) is a public web API key, not a secret.
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
  ​Never inline real API keys/secrets for third-party services other than the already-public
  Firebase web config; the `AI_PROXY_URL` Cloudflare Worker endpoint exists specifically so
  the actual AI provider key stays server-side.
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
- Keyboard shortcuts: ⌘S save JSON, ⌘E export Typst, ⌥↑/↓ move between problems.

### serve.py

Deliberately locked down (see the security comment block at the top of the file) since it
executes a subprocess (`typst compile`) based on user-supplied source: binds to 127.0.0.1
only, checks `Origin` against an allowlist, requires a custom `X-Exam-Client` header on
`POST /render`, caps body size and compile time, restricts `typst --root` to the `work/`
directory, and never uses `shell=True`. Preserve these constraints when modifying it —
they're the whole reason this is safe to run as a local dev server that a remote GitHub
Pages–hosted `index.html` can also call into (via `--allow-origin`).

## 다음 세션 이어서 할 일 (2026-08-20 기준)

`ANALYSIS.md`에 전체 코드 분석이 있다. 아래는 그중 **아직 안 고친 것**만 추린 목록.

### 확인 필요 (코드 밖)
- **Firestore/Storage 보안 규칙이 이 저장소에 없다.** 실제 접근 제어 전부가 규칙에
  달려 있는데 버전 관리가 안 되고 있어 리뷰가 불가능하다. Firebase 콘솔에서 확인하고
  `firestore.rules` / `storage.rules` 를 레포에 커밋할 것. 규칙이
  `allow read, write: if request.auth != null` 수준이면 로그인한 아무나
  다른 사용자의 `users/{uid}` 문서를 읽을 수 있다.

### 미착수 개선
- **Undo/Redo 전체 스냅샷** (`index.html` `snapshot()`): 한 글자 편집마다 모든
  문제집을 `JSON.stringify`. 80단계 스택이라 이미지 많은 라이브러리에서 메모리 부담.
  문항 단위 diff 또는 스택 깊이 축소 검토.
- **`SETS_KEY="PM_SETS_V7"` 마이그레이션 부재**: V1~V6 키의 구버전 데이터가
  자동 이관 없이 사라져 보인다.
- **문제집 복제 시 `problems[].id` 중복**: `renderLibrary()` 의 복제 경로가
  set id만 재발급하고 문항 id는 원본과 같게 둔다. (가져오기 경로는 `normProblem()`
  으로 이미 해결됨 — 복제 경로도 같은 방식으로 맞추면 된다.)
- **모의고사 편집기에 자동저장 없음**: 파일 export 만 있어 브라우저 크래시 시 전부 소실.
  `beforeunload` 경고로는 부족 — 본체처럼 localStorage 임시저장 권장.
- **빈 `catch(e){}` 다수**: 최소한 `console.error` 라도 남길 것.
- **알림 UX 불일치**: 모의고사 편집기는 `alert()`, 본체는 `toast()`.
- **`serve.py` `Content-Length` 신뢰** (`do_POST`): 과대 선언 시 커넥션이
  타임아웃까지 블로킹. 로컬 전용이라 우선순위는 낮다.
- **브랜드 글꼴 파일이 레포에 없다**: `Adobe Caslon Pro Bold.ttf` 를 참조하지만
  파일이 없어 404. 화이트리스트 등록은 끝났으니 파일을 추가하거나 참조를 제거할 것.
