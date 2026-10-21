# 미래 권의 문항 모양을 intake 배열로 읽어 저장 상태가 멈춘다

- ID: `REV-2026-136`
- 날짜: `2026-10-20`(재현) · `2026-10-21`(수정 검증)
- 보고자: `부모 Codex 독립 VM 재현 · Codex GPT-6 Sol / high 수정`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index | tests`
- 관련 인계: `HANDOFF-2026-194`
- 검토 기준: `ad5fe91` 이후 REV-108 ② 작업본

## 요약과 영향

미래 권은 `problems`가 배열이라는 보장이 없다. `index.html`의 `intakeNeedsUpdate()` 래퍼가
미지원 권도 `PedagogyNormalize.intakeNeedsUpdate()`에 넘겨 `.some()` 예외를 냈다.
로컬 미래 권을 포함한 저장 상태 표시와 원격 미래 권의 revision transaction이
정해 둔 `set-schema-update` 보류 전에 중단될 수 있었다.

## 재현과 기대/실제

미래 권 `{setSchemaVersion:2,problems:{opaque:true}}`를 로컬 목록에 두고 `idleSaveStatus()`를
실행한다. 같은 모양의 서버 문서에 새 클라이언트의 정상 저장을 시도한다. 기대는 예외 없이
읽기 전용·`set-schema-update` 원격 보류, 원문 불변, 다른 정상 권 저장이다. 수정 전에는
`.some is not a function`이 먼저 발생했다.

## 근거와 처리 기록

- `2026-10-20` — 부모 Codex가 `idleSaveStatus('owner')`를 실제 함수 본문으로 실행해 TypeError를
  재현했다(`/private/tmp/rev108-schema-2026-10-20/parent-idle-future-repro.log`).
- `2026-10-21` — Codex GPT-6 Sol / high가 미지원 권만 intake 검사에서 제외했다. 별도 권 버전 게이트가
  편집·쓰기·삭제 보류를 담당한다. Chromium 실제 함수에서 로컬 미래 권을 둔 `idleSaveStatus()`와
  원격 비배열 미래 문서 transaction, 정상 형제 권 저장, 원문 불변을 확인했다. 지원 v1/무표식 권의
  미래 intake는 여전히 `intakeNeedsUpdate()`와 읽기 전용에서 참이다. `SET_SCHEMA_RED=future-intake`
  래퍼 guard 제거는 표적 TypeError, 변이 생략 제어는 정상 14/14 뒤 예상 exit 1.
  `npm run test:set-schema` exit 0 (`/private/tmp/rev108-schema-2026-10-20/schema-browser-14-final.log`).
  ② 독립 좁은 변경분 판정과 운영 배포는 별개로 남는다.

- `2026-10-21` — 구현 미참여 Codex 에이전트가 수정과 해당 검사를 독립 확인해 추가 재현 결함 미발견으로 판정했다. 후속 Claude는 시간 초과로 최종 답변이 없으며, ② 운영 배포와 분리한다.
