# 변경 인계 — Worker AI 측정 누락 보완

- ID: `HANDOFF-2026-125`
- 날짜: `2026-09-13`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `worker`, `tests`, `docs`
- 관련 이슈: `REV-2026-089` 해결

## 변경 내용

`HANDOFF-2026-124` 검토에서 재현한 비정상 문항 JSON의 측정 누락만 보완했다. `callAI`의 문자열
확인, JSON 파싱과 `problems` 구조 검사를 같은 오류 경계에 두어 해당 단계의 모든 실패가 공급자
토큰·중단 사유·응답 시간을 유지한 `json_parse_error`가 되게 했다.

회귀 검사는 실제 Worker의 기본 console 경계를 사용한다. Anthropic 응답을 `null`로 주입한 뒤
502, quota `reserve → consume`, 이벤트 정확히 1건과 토큰 보존을 확인한다. 동시에 `console`의
log/error/warn/info/debug 인수를 모두 수집해 이미지·UID·Authorization 토큰·AI 응답 원문 표식이
어디에도 남지 않는지 검사한다.

quota·`max_tokens`·공급자·프런트엔드·Cloudflare 표본률은 변경하지 않았고 배포하지 않았다.

## 위험과 검토 요청

검토자는 `callAI`에서 파싱·구조 오류가 모두 같은 telemetry를 보존하는지와 Worker catch가 이벤트를
중복 기록하지 않는지 확인한다. console 포착 검사가 실제 기본 `console.log` 경계를 통과하며,
테스트 전용 `recordMetric`만 검사하는 것으로 축소되지 않았는지도 확인한다.

## 검증

- 수정 전 독립 재현: `null`·숫자 본문 모두 502, quota 확정, 이벤트 0건.
- `AI_METRICS_RED=1 node worker/worker-contract.test.mjs`: 금지된 `prompt` 필드 주입 시 허용 키
  검사가 종료 코드 1로 실패.
- `node worker/worker-contract.test.mjs`: 비정상 `null` 응답의 이벤트 1건·토큰 보존·전체 console
  원문 비노출 포함 통과.
- 실제 Anthropic 호출과 Cloudflare 배포는 실행하지 않았다.

## 다음 검토자에게

검토 범위는 `worker/index.js`, `worker/worker-contract.test.mjs`, `REV-2026-089`와 이 인계다.
실제 키나 운영 요청 없이 가짜 Anthropic 200 응답만으로 재현할 수 있다.

