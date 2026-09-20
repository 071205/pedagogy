# CSP 해시 잠금이 스크립트 주입·고장 주입 검사를 막는다 — `check:fast` 빨간불

- ID: `REV-2026-097`
- 날짜: `2026-09-21`
- 보고자: `Claude / Opus 5`
- 상태: `resolved`
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

## 수정 (2026-09-21 · `Claude / Opus 5`)

⚠️ **등록할 때 본 것보다 범위가 넓었다.** 주입식 검사 둘뿐이 아니라 **고장 주입(깨보기)
기법 전체**가 막혀 있었다.

| 막힌 것 | 왜 | 고친 방법 |
|---|---|---|
| `check-ai-image.mjs` 의 `__AI_IMAGE_HOOKS__` 주입 | 인라인 주입이 CSP 에 차단 | **주입을 없앴다.** `prepImageForAI`·`aiBlocksToProblem` 은 최상위 `function` 이라 window 에 있고, `AI_MAX_DIM` 같은 `const` 도 `page.evaluate` 가 **전역 렉시컬로 읽는다** |
| 같은 파일의 `redProbe` 가 `addScriptTag({content})` 로 바꾼 사본을 덧씌움 | 같음 | **route 로 `pedagogy-ai-image.js` 파일 자체를 갈아 끼운다.** ⚠️ 예전 방식은 차단되면 **원본이 남아 깨보기가 조용히 통과**했다 — 더 나쁜 실패다 |
| `check-mock-library-ui.mjs` 의 `FAKE_CLOUD` 주입 | 같음 | 문자열을 **함수로 바꿔 `page.evaluate(installFakeCloud)`** 로 넘긴다. 함수 안의 `fbDb=`·`fbReady=` 대입이 **전역 `let` 바인딩에 그대로 닿는다**(`window.fbDb=` 는 닿지 못한다) |
| 같은 파일의 **고장 주입**(`redBody()`) | ⚠️ **index.html 을 고쳐서 서빙하면 그 블록의 해시가 안 맞아 앱이 통째로 안 뜬다** | 새 공용 헬퍼 **`scripts/lib/csp-rehash.mjs`** 가 고친 HTML 의 인라인 해시를 **다시 계산**한다. CSP 를 지우지 않는다 — 지우면 깨보기가 제품과 다른 보안 자세를 시험하게 된다 |

⚠️ **옛 커밋을 그대로 서빙하는 깨보기는 멀쩡하다**(`check-library-ui` · `check-sets-cloud-size`).
그 HTML 은 **자기 정책과 자기 스크립트가 일치**하기 때문이다. 문제는 **고쳐서 서빙할 때**다.

### 검증

- `npm run test:ai-image` 통과 + 그 안의 자기검사(깨보기가 exit 1 · AssertionError)까지 통과.
- `MOCK_UI_RED=1 node scripts/check-mock-library-ui.mjs` → **"고장 9개에서 계약 8개가 빨간불"**
  으로 되살아났다(고치기 전에는 `page()` 가 8초 타임아웃으로 **크래시**했다 —
  ⚠️ `check()` 의 `try` **밖**이라 실패로 기록되지도 않았다).
- **`npm run check:fast` 종료코드 0 · 건너뜀 0건.**
- `CLAUDE.md` 의 `installHooks()` 설명이 "`'unsafe-inline'` 이 있다" 를 전제하고 있어 정정했고,
  **인라인을 고치면 해시를 다시 계산해야 한다**는 함정도 같은 파일에 넣었다.

### 나머지 넷 — 확인했다 (2026-09-21 추가)

| 파일 | 결과 |
|---|---|
| `scripts/check-public-browser.mjs` | ✅ **정상. 오히려 반대 성격이다** — 주입을 시도하고 **막히는 것**을 단언한다(`:50` `public CSP must block arbitrary script blocks`). R1 의 잠금이 바로 이 검사가 원하는 것이다. 실행해 통과 확인 |
| `scripts/check-csp-browser.mjs` | ✅ 같은 성격(`:73`). 실행해 통과 확인 |
| `tests/regression-test.html` | ✅ **158/158 통과 · 실패 0**(브라우저로 실제로 열어 확인). 두 iframe 모두 `__HOOKS__` 가 실제로 들어가 있다 |
| `tests/integration-test.html` | ⬜ **열어 보지 않았다** |

⚠️ **회귀 스위트에 남는 불확실성 하나**: `index.html` iframe 의 `__HOOKS__` 는 키가 **1개**인데
모의고사 쪽은 2개다. 주입이 막힌 자리를 부모에서 직접 대입하는 경로로 메운 것으로 보이나
**확인하지 않았다.** 그리고 화면에 **건너뜀 3건**이 있다 — `158/158 통과` 라는 표시와 별개다
(**건너뜀은 통과가 아니다**). 이 스위트는 사람이 여는 도구라 관문을 막지 않으므로
이슈는 닫되, **그 둘은 다음 사람이 볼 것으로 남긴다.**
