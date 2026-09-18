# 변경 인계 — staging Gemini fetch 경계 보강

- ID: `HANDOFF-2026-142`
- 날짜: `2026-09-14`
- 작성자: `Codex / Terra medium`
- 상태: `ready-for-review`
- 영향 영역: `worker | tests | docs`
- 관련 이슈: `REV-2026-093`

## 변경 내용

`worker/index.js`에서 Gemini API key를 provider 설정 검사와 header 작성 전에 trim한다. secret 입력의 끝
공백/줄바꿈은 유효한 API key가 될 수 없으므로, 그대로 header에 넣어 `fetch`가 HTTP 응답 전에 예외를
내는 경로를 제거했다. provider redirect는 `manual`로 받아 API key를 다른 origin으로 전달하지 않고
안전한 3xx `http_error`/상태로 남긴다.

`worker/gemini.test.mjs`에 whitespace-only key의 quota 전 거절, padded key의 정규화, 302의 단일 호출 및
안전 telemetry를 추가했다. `manual`을 `follow`로 바꾸는 in-memory red mutation이 assertion을 실패시킨다.
trim 제거 변이는 Sol 독립 검토에서 별도 임시 복제에 주입해 실패를 확인했다.

## 위험과 검토 요청

원래 staging의 `request_error`가 실제로 key newline 또는 redirect였다는 증거는 없다. 이 수정은 두
pre-response failure mode를 제거·관측 가능하게 만들지만 Google credential 권한·Cloudflare egress·모델
접근을 확인하지 않는다. 새 실호출 승인 전에는 staging 배포나 Gemini 재검증을 하지 말 것.

## 검증

- `node worker/gemini.test.mjs` — 통과. provider boundary 20건, padded key·302·red mutation 포함.
- `git diff --check` — 통과.
- 아직 실행하지 못한 검증: 실제 staging Gemini 응답, token/HTTP 관측. 기존 2회/$1 승인 소진으로 호출 0회.

## 다음 검토자에게

Sol medium은 `geminiApiKey`, `providerConfig`, `geminiResponse`와 새 테스트가 key를 로그/URL로 옮기지
않고 redirect를 follow하지 않는지 독립적으로 확인한다. 결함이 없으면 `REV-2026-093`에 검토 기록을 추가하되,
실환경 성공 여부는 새 승인 후 재검증할 때까지 resolved로 닫지 않는다.

## 검토 기록

- `2026-09-14` · `Codex / Sol medium` · 별도 trim 제거 변이가 503→502 AssertionError로 실패하는 것과
  manual redirect·단일 fetch·302 안전 상태·key 비노출, Worker 전체 회귀를 재검증 · 수정 승인. 실환경
  원인/성공은 미확인이라 REV-093 유지, 새 승인 전 배포·호출 금지.
