# 변경 인계 — OPS-7 staging smoke 실패와 복원

- ID: `HANDOFF-2026-141`
- 날짜: `2026-09-14`
- 작성자: `Codex / Sol medium`
- 상태: `needs-follow-up`
- 영향 영역: `worker | staging config | docs`
- 관련 이슈: `REV-2026-093`

## 변경 내용

승인된 staging 합성 이미지 1회와 문서 1회를 재시도 없이 실행했다. 인증·CORS·quota·App Check monitor·
안전 `ai_usage`는 동작했지만 두 Gemini fetch 모두 provider HTTP 응답 전 `request_error`로 실패했다.
레일과 배포 준비 문서에 결과와 대기를 기록하고 `REV-2026-093`을 열었다.

## 위험과 검토 요청

두 실패도 provider 시도와 quota 소비로 계산해 기존 2회/$1 승인은 소진됐다. 원인을 특정하지 않은 상태에서
key를 다시 입력하거나 실호출로 탐색하지 말 것. production `dawn-shape-2664`는 계속 제외한다.

## 검증

- staging logs 100% version: `32c03142-05f8-4647-89bb-8307d0009f89`.
- `GET /health`: 200/`ok=true`; 무효 Firebase token: 401; 유효 token 두 요청: CORS 허용 뒤 quota
  reserve·consume 각각 완료.
- 합성 PNG 1회: 502; 합성 문서 1회: 502; provider attempts 2, retries 0.
- live tail: 두 task의 안전 `ai_usage`가 `request_error`, token/HTTP 상태 null. App Check는 monitor 실패를
  기록하고 요청을 계속했다. 원문·UID·token·secret은 기록하지 않았다.
- 복원 version `eeb668aa-1f81-4fc4-bb6b-a8546176613c`: logs 10%. 임시 익명 계정 삭제와 익명 provider
  비활성화를 완료했다. production 배포·설정·호출은 0건이다.
- 아직 실행하지 못한 검증: Gemini 성공/HTTP 오류 상태, 응답 JSON, 실제 token 사용량. 재검증 예산이 없다.

## 다음 검토자에게

Terra medium은 `worker/index.js`의 `providerConfig`·`geminiResponse`, Cloudflare secret 전달 경계와
`worker/gemini.test.mjs`를 외부 호출 없이 점검한다. 재현 가능한 원인을 고치면 같은 이슈의 처리 기록을
갱신하고 Sol medium 독립 검토를 받는다. 이후 새 실호출 범위 승인이 있어야 OPS-7을 완료할 수 있다.

## 검토 기록

