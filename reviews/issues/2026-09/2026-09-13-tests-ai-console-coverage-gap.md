# 문서 프롬프트 누출을 Worker 로그 회귀가 놓친다

- ID: `REV-2026-090`
- 날짜: `2026-09-13`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-125`, `HANDOFF-2026-126`

## 요약과 영향

125의 console 포착은 문항 null 응답 한 경우에만 적용된다. 문서 생성의 테스트는 recordMetric을
주입하고 실제 console 인수를 검사하지 않는다. 따라서 callDocumentAI에 `console.error(prompt)`를
추가한 실제 코드 변이도 기존 전체 Worker 요청 계약 검사가 통과한다. 이는 검증 결함이며 현재 제품에서
실제 개인정보 유출을 발견했다는 의미가 아니다. 이전 완료 보고의 프롬프트 비노출 검증 주장은 범위를 넘었다.

## 재현 절차

기준 `eb120d2`에서 `node reviews/audits/2026-09-13/worker-telemetry-review.mjs`를 실행한다.
도구는 소스를 읽어 import를 절대 경로로 바꾼 뒤 data URL로 메모리에서만 변형한다.
파일 수정·실제 공급자 호출 없이 현재 계약 검사를 각 변이와 연결해 실행한다.

## 기대 결과 / 실제 결과

- 기대: 기본 검사는 통과하고, 이미지 또는 문서 원문을 console에 기록하는 코드 변이는 단언으로 실패한다.
- 실제: baseline exit 0, document-prompt-leak exit 0(누출 누락), image-input-leak exit 1(검출).
  리뷰 도구 자체는 놓친 변이가 있어 exit 1이다. 20개 가짜 공급자 경계 검사는 모두 통과한다.

## 근거와 수정 범위

`worker/worker-contract.test.mjs`의 captureConsole은 testAiUsageMetrics 마지막 문항 null 요청만
감싼다. secrets에는 문서 prompt가 없고 document 요청도 그 범위를 지나지 않는다.
AI_METRICS_RED는 테스트 헬퍼에서 prompt 키를 붙이는 것으로 이 문서 경로의 실제 누출을 검사하지 않는다.
[진행 기준 A](../../../docs/AI-COST-ROADMAP.md)의 두 작업/실패 유형/원문 표식과 변이 검출을 보강한다.
제품 변경은 새로운 제품 결함이 별도 재현될 때만 한다.

## 처리 기록

- 2026-09-13 · Codex: 독립 재검토에서 메모리 코드 변이로 재현·등록. 이번 요청은 검토와 진행 기준
  설계이므로 테스트 수정은 다음 A 단계로 남긴다. 089의 제품 수정은 20개 응답 경계로 재확인했다.
- 2026-09-13 · Codex: A 단계에서 기본 createWorker/console 경계의 문항 null 실패와 문서 성공을
  모두 검사하도록 보강했다. image·prompt·UID·token·응답 표식을 전체 console 메서드에서 제외하고,
  logger 실패가 성공 응답을 502로 바꾸지 않는 것도 단언한다. 리뷰 도구의 메모리 변이 네 가지
  (문서 prompt, 이미지, 공급자 응답, UID)가 모두 AssertionError로 실패하며 baseline은 통과했다.
  `npm run test:worker`에 이 도구를 연결했다. 제품 변경 없이 resolved로 전환한다.
