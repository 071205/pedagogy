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
