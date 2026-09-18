# Gemini 응답 본문 읽기가 60초 제한 밖에서 대기할 수 있다

- ID: `REV-2026-091`
- 날짜: `2026-09-14`
- 보고자: `Codex / Sol medium`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `worker`, `tests`
- 관련 인계: `HANDOFF-2026-138`

## 요약과 영향

Gemini 요청의 60초 AbortController 타이머가 `fetch()`가 응답 헤더를 반환한 직후 해제된다.
응답 body가 늦거나 끝나지 않으면 `response.json()`은 60초 제한 없이 대기할 수 있어, 사용자가
의도한 timeout과 설계의 단발 실패 경계가 보장되지 않는다. 재시도나 production 변경은 재현하지 않았다.

## 재현 절차

1. `callAI`에 Gemini staging 설정과 가짜 `fetch`를 주입한다.
2. 가짜 `setTimeout`/`clearTimeout`으로 타이머 해제 시점을 기록한다.
3. 가짜 응답의 `json()` 진입 시 타이머가 이미 해제됐는지 단언한다.

## 기대 결과 / 실제 결과

- 기대: 응답 body의 JSON 읽기가 끝날 때까지 타이머가 유지되어 `json()` 진입 시 해제 상태가 `false`다.
- 실제: `json()` 진입 시 해제 상태가 `true`였고, `true !== false` AssertionError로 재현 명령이 종료 1이었다.

## 근거

`worker/index.js`의 `geminiResponse`는 `fetch()`만 감싼 `try/finally`에서 타이머를 정리한 다음
`response.json()`을 호출한다. `docs/GEMINI-STAGING-ADAPTER-DESIGN.md` §4는 deadline을 응답 body를
읽을 때까지 유지하고 finally에서 정리하도록 명시한다. 실제 API 호출이나 secret 없이 가짜 경계에서
해제 순서를 관찰했다.

## 제안 (선택)

성공·HTTP 실패·네트워크 실패·JSON 실패 모두를 포함하는 외부 `try/finally`에서 타이머를 정리하고,
느린 body가 abort 신호를 관찰하는 전용 회귀를 추가한다. 구현자는 Cloudflare fetch/body abort 계약도
현재 런타임 기준으로 다시 확인한다.

## 처리 기록

- `2026-09-14` — `Codex / Sol medium`: 독립 검토에서 가짜 timer/fetch로 등록. 실제 호출 0회,
  배포·원격 설정·production 변경 0건.
- `2026-09-14` — `Codex / Terra medium`: `geminiResponse`의 timer 정리를 전체 요청/응답 처리의
  `finally`로 옮기고, body abort는 `request_error`로 분류했다. 가짜 deadline이 JSON 읽기 전에는
  살아 있고 같은 fetch signal을 abort하며, 완료 뒤 정리되는 회귀를 추가했다. `node worker/gemini.test.mjs`,
  `npm run test:worker`, `npm run test:ai-image`, `npm run check:static`, `npm run test:public`,
  `npm run check:public`, `npm run test:cross:fast` 통과. 실제 호출·배포 0회.
- `2026-09-14` — `Codex / Sol medium`: 구현 검사와 별도의 가짜 timer/fetch probe에서 body JSON
  진입 전 timer 미해제, 완료 후 정리, 단일 fetch를 재확인했다. Worker 전체와 Chromium regression
  158/158 통과. resolved 승인 유지.
