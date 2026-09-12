# 변경 인계 — Worker AI 사용량 측정 1단계

- ID: `HANDOFF-2026-124`
- 날짜: `2026-09-13`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `worker`, `tests`, `docs`
- 관련 이슈: `없음` (기존 REV-074·075는 열린 상태 유지)

## 변경 내용

`worker/index.js`가 Anthropic Messages 응답의 `usage.input_tokens`, `usage.output_tokens`,
`stop_reason`, 모델명과 경과 시간을 받아, 공급자 호출마다 Cloudflare Workers Logs 구조화 이벤트
`ai_usage` 하나를 남긴다. `task`는 이미지 문항 변환의 `problem_image`와 텍스트 문서 생성의
`document`로 구분한다. 성공, `http_error`, `json_parse_error`를 기록하며 연결 자체 실패는
`request_error`, 문서 계약 검증 실패는 `validation_error`로 구분한다.

로그 객체는 `event`, `provider`, `task`, `model`, `outcome`, 토큰 수, `stop_reason`,
`duration_ms`, `http_status`만 갖는다. 이미지·프롬프트·AI 응답 원문·Authorization/App Check
헤더·사용자 UID와 공급자 오류 본문은 이 경계를 지나지 않는다. 수치와 모델명은 형식 검증하고
알 수 없는 중단 사유는 `unknown`으로 정규화한다.

현재 `worker/wrangler.toml`의 Workers Logs 관찰 설정은 `head_sampling_rate = 0.1`이다.
따라서 이 단계는 표본별 비용·품질 추세와 오류 유형을 확인하는 용도이며, 전체 청구액의 원장은
Anthropic 콘솔에서 대조해야 한다. 표본률·quota 흐름·`max_tokens: 4096`·공급자 연결·프런트엔드
분리는 바꾸지 않았다. 배포나 실제 API 호출도 하지 않았다.

## 위험과 검토 요청

성공 로그는 Worker가 공급자 결과를 파싱하고 문서 계약까지 통과한 뒤에만 남긴다. HTTP/JSON
실패는 `AiGenerationError`의 안전한 메타데이터만 catch 경계로 전달한다. 관찰 로거 자체가 실패해도
고객 요청을 502로 바꾸지 않는다.

검토자는 `worker/index.js`의 `aiTelemetry`와 `recordAiMetric` 경계를 확인해 새 필드에 원문이나
식별자가 들어갈 수 없는지, 그리고 reserve → consume → provider 순서가 이전과 같은지 점검한다.
Cloudflare 대시보드에서 실제 저장 기간·샘플링 효과는 운영 환경에서 별도로 확인해야 한다.

## 검증

- `AI_METRICS_RED=1 node worker/worker-contract.test.mjs` → 의도적으로 `prompt`를 로그 객체에
  추가하자 허용 키 단언이 실패했다(종료 코드 1).
- `node worker/worker-contract.test.mjs` → Anthropic 응답 모사로 이미지 성공, 이미지 HTTP 529,
  문서 JSON 파싱 실패의 작업 갈래·토큰·중단 사유·HTTP 상태·원문 제외를 확인했다.
- 아직 실행하지 못한 검증: 실제 Anthropic/Cloudflare 호출과 배포. 키·운영 데이터가 필요한 외부
  작업이므로 이번 구현에서 실행하지 않았다.

## 다음 검토자에게

검토 범위는 `worker/index.js`, `worker/worker-contract.test.mjs`, `worker/wrangler.toml`,
`docs/OPERATIONS-RUNBOOK.md`과 이 인계다. 실제 Provider 응답의 메시지 형태와 Logs 구조화 객체를
독립 대조하고, 각 실패 갈래가 AI 원문·이미지·UID를 기록하지 않는지 확인한다. 이후 단계에서
`max_tokens` 조정, 다중 공급자, 비용 비교, `index.html` 분리를 이 변경에 섞지 않는다.

## 후속 검토 결과 (2026-09-13 · Codex)

비정상 문항 JSON에서 비용 측정이 빠지는 `REV-2026-089`를 재현했다. `null`과 문자열이 아닌
본문은 502와 quota 확정 뒤에도 이벤트가 0건이었다. `HANDOFF-2026-125`에서 telemetry 보존과
전체 console 원문 비노출 회귀를 추가해 해결했다. 나머지 측정 갈래와 범위 제한은 유지된다.
