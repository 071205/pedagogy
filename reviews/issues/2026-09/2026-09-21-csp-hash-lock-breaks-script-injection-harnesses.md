# CSP 해시 잠금이 스크립트 주입 방식 검사를 막는다 — `test:ai-image` 빨간불

- ID: `REV-2026-097`
- 날짜: `2026-09-21`
- 보고자: `Claude / Opus 5`
- 상태: `open`
- 심각도: `P2`
- 영향 영역: `tests`, `security`
- 관련 인계: `HANDOFF-2026-153`(R1 · **독립 검토 대기**)

## 요약과 영향

R1 이 `index.html` 의 인라인 스크립트를 **해시로 잠그고 `'unsafe-inline'` 을 제거**했다.
그런데 일부 검사는 페이지 안에 **`<script>` 를 주입해** 렉시컬 `const` 를 읽는 방식이라,
그 주입이 **CSP 에 조용히 차단**된다. `npm run test:ai-image` 가 실패하고 따라서
**`npm run check:fast` 가 빨간불**이다.

⚠️ **제품 결함이 아니라 검사 결함이다.** 제품 경로는 정상이다(`pedagogy-ai-image.js` 는
`src` 로 불러오는 별도 파일이라 해시 잠금과 무관하고, `window.PedagogyAIImage` 로 노출된다).
다만 **`check:fast` 가 빨간불이면 다른 변경의 검증 관문이 막힌다.**

## 재현 절차

```bash
npm run test:ai-image
```

## 기대 결과 / 실제 결과

- 기대: 통과.
- 실제: `page.evaluate: TypeError: Cannot read properties of undefined (reading 'prepImageForAI')`
  (`scripts/check-ai-image.mjs:71` — `window.__AI_IMAGE_HOOKS__` 가 undefined).

## 근거

- 검사는 `scripts/check-ai-image.mjs:30` 에서
  `script.textContent='window.__AI_IMAGE_HOOKS__={...}'` 로 **인라인 스크립트를 주입**한다.
- `scripts/check-source-csp.mjs:23` 이 `script-src` 에 `'unsafe-inline'` 이 있으면 **실패**시킨다.
  즉 지금 정책은 **해시로 열거한 인라인만** 허용하고, 런타임 주입은 해시가 없으므로 차단된다.
- ⚠️ **오류가 나지 않는다.** CSP 차단은 `pageerror` 를 일으키지 않아 `hooks` 가 조용히
  undefined 가 된다 — 그래서 원인이 CSP 로 보이지 않는다.
- **내 변경과 무관함을 확인했다**: `git stash` 로 작업분을 치운 뒤에도 같은 실패가 났다.
  `33af005`(B1 이전)에서 이미 빨간불이다.

⚠️ **같은 기법을 쓰는 곳이 더 있다** — 아직 전부 확인하지는 않았다:
`scripts/check-public-browser.mjs` · `scripts/check-csp-browser.mjs` ·
`scripts/check-mock-library-ui.mjs` · `tests/regression-test.html` · `tests/integration-test.html`.
⚠️ `CLAUDE.md` 의 `installHooks()` 설명은 **"CSP `script-src` 에 이미 `'unsafe-inline'` 이
있다"** 를 전제로 적혀 있다 — 그 전제가 **더 이상 참이 아니다.** 그 문단도 함께 고쳐야 한다.

## 제안 (선택)

주입을 되살리려고 `'unsafe-inline'` 을 다시 넣지 말 것 — R1 이 없앤 이유가 있다. 대신:
- `check-ai-image.mjs` 는 이미 노출된 **`window.PedagogyAIImage`** 를 `page.evaluate` 로 직접
  읽으면 주입이 필요 없다(Playwright 의 `evaluate` 는 페이지 CSP 를 타지 않는다).
- 렉시컬 `const` 를 읽어야만 하는 검사는 `page.addInitScript` 등 CSP 를 타지 않는 경로를 쓴다.

## 처리 기록

- `2026-09-21` — `Claude / Opus 3`: 등록. B1(문제집 크기 방어) 작업 중 `check:fast` 를 돌리다
  발견했고, 작업분을 치우고 재현해 **선행 결함**임을 확인했다. 수정은 하지 않았다 —
  R1 의 독립 검토(`HANDOFF-2026-153`)와 함께 판단할 항목으로 남긴다.
