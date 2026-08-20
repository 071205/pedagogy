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
- **신뢰 경계 (중요)**: 가져온 `.json`은 신뢰하지 않는다. `normSet()`/`normProblem()`/
  `normBlock()`이 화이트리스트로 정규화하고, 이미지 URL은 `safeUrl()`이 Firebase Storage /
  `data:image` 로만 제한하며, `sanitize()`가 `& < > " '`를 모두 이스케이프한다.
  **새 렌더 경로를 추가하거나 사용자 값을 HTML 속성에 넣을 때는 반드시 이 헬퍼들을 거칠 것** —
  과거 이게 없어서 악성 문제집 파일 하나로 로그인된 Firestore 데이터를 읽어갈 수 있었다.
  블록 타입·`layout`·이미지 `size` 같은 열거값은 렌더 시점에도 한 번 더 고정한다.
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

`ANALYSIS.md`에 전체 코드 분석이 있다. 분석에서 지적된 코드 문제는 대부분 처리했고,
아래가 **남은 것** 전부다.

### 코드 밖 — 반드시 적용할 것 (유일한 미해결 보안 항목)
- **`firestore.rules` / `storage.rules` 를 Firebase 에 실제로 배포해야 한다.**
  두 파일은 이 저장소에 있지만, **배포하기 전까지는 아무 효력이 없다.**
  콘솔 규칙이 `allow read, write: if request.auth != null` 수준이면
  로그인한 아무나 다른 사용자의 `users/{uid}` 문서를 읽어갈 수 있다.
  - 콘솔: Firestore Database → 규칙 / Storage → 규칙 에 파일 내용을 붙여넣고 게시
  - CLI: `firebase deploy --only firestore:rules,storage`
  적용 후 로그인 → 문제집 저장 → 이미지 첨부까지 한 번 확인할 것.
  저장이 '권한 오류' 로 실패하면 `firestore.rules` 의
  `hasOnly(['sets','updatedAt'])` 목록에 새 필드를 추가해야 한다.

### 자료 추가 필요
- **브랜드 글꼴 파일이 레포에 없다**: `Adobe Caslon Pro Bold.ttf`.
  `serve.py` 화이트리스트 등록과 `local()` 폴백은 끝났으므로, 시스템에 설치돼 있으면
  이미 정상 표시된다. 파일을 레포에 넣으면 배포본(GitHub Pages)에서도 적용된다.
  넣지 않을 거면 `index.html` 의 `@font-face` 와 `serve.py` 의 STATIC 항목을 지울 것.

### 더 깊게 손보고 싶다면 (선택)
- **Undo/Redo 구조**: 총량 상한(`HIST_CHARS_LIMIT`)으로 메모리 폭주는 막았지만,
  여전히 한 단계마다 `sets` 전체를 `JSON.stringify` 한다. 문제집이 아주 커지면
  타이핑 지연이 생길 수 있다. 근본 해결은 문항 단위 diff.
- **모의고사 편집기의 근사 미리보기와 Typst 정본**: `cases` 간격은 맞췄지만
  두 경로가 여전히 별도 코드다. 새 서식을 추가할 때마다 양쪽을 함께 고쳐야 한다.

### 이번 세션에 처리 완료 (참고)
가져오기 XSS 차단(`normSet`/`safeUrl`/`sanitize`), `showMock` 버그로 죽어 있던
모의고사 버튼 복구, Firebase 실패 시 오프라인 degrade, 문제집 복제 시 문항 id 중복,
구버전 localStorage 키 이관, Undo/Redo 총량 상한, 모의고사 localStorage 자동저장,
`alert()` → `toast()`, 이미지 업로드 실패 알림, `serve.py` Content-Length 방어,
빈 `catch` 로깅.
