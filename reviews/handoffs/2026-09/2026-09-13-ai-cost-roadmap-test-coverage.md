# 변경 인계 — AI 비용 측정 로그 회귀 보강

- ID: `HANDOFF-2026-127`
- 날짜: `2026-09-13`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `tests`, `docs`
- 관련 이슈: `REV-2026-090` 해결

## 변경 내용

진행 기준 A를 완료했다. `worker/worker-contract.test.mjs`가 기본 createWorker와 기본 console 경계로
문항 비정상 응답과 문서 정상 응답을 검사한다. 가짜 image/prompt/UID/token/AI 응답 표식이
log/error/warn/info/debug 어디에도 남지 않는지, 이벤트가 정확히 한 번이고 logger 실패가 성공 요청을
실패시키지 않는지를 고정했다.

`reviews/audits/2026-09-13/worker-telemetry-review.mjs`는 문항·문서 각 10개 가짜 공급자 경계를
확인한다. 실제 제품 소스는 쓰지 않고 메모리에서만 문서 prompt, 이미지, 공급자 응답, UID console
누출 변이를 만든다. 네 변이는 단언 실패여야 하며 import/문법 오류는 검출로 인정하지 않는다.
이 도구를 `npm run test:worker`에 연결했다.

제품 Worker 동작, quota, max_tokens, 공급자, 프런트, 배포는 바꾸지 않았다. 실제 API 호출도 없다.

## 위험과 검토 요청

검토자는 default `recordMetric = console.log`가 포착 범위를 실제로 지나가는지, 문서 prompt 변이가
기존처럼 통과하지 않는지, 표식이 child process 출력으로 다시 노출되지 않는지 확인한다. 20개 경계는
가짜 응답 검사이며 Cloudflare 로그 보존·실제 배포의 증거가 아니다.

## 검증

- `node worker/worker-contract.test.mjs` → 통과. logger 실패가 200을 유지한다.
- `node reviews/audits/2026-09-13/worker-telemetry-review.mjs` → 20개 경계 통과; baseline exit 0;
  document-prompt/image-input/provider-response/uid 누출 변이 각각 exit 1과 AssertionError.
- `npm run test:worker` → 위 검사를 포함한 Worker·quota·App Check·감사·리뷰 후속 묶음 통과.
- `git diff --check`와 로컬 문서 링크 검사 통과.
- 실제 Anthropic 호출, Cloudflare 배포, 운영 로그 조회는 실행하지 않았다.

## 다음 검토자에게

진행 기준의 현재 위치는 B다. A 변경 diff와 090 처리 기록만 독립 검토한다. 재현되는 결함이 없으면
수정하지 말고 이 인계에 결과를 기록한 뒤 C 배포 준비로 넘긴다.
