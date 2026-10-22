# 계정 전환 중 구성 다시 열기가 빈 화면에 멈춘다

- ID: `REV-2026-143`
- 날짜: `2026-10-22`
- 보고자: `Codex 독립 검토 에이전트`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-197`

## 요약과 영향

계정 전환 중 구성 다시 열기가 빈 화면에 멈춘다. U2 미배포 초안에서 독립 검토가 재현했으며 운영 발생을 주장하지 않는다.

## 재현 절차

old-owner listJobs를 지연하고 owner전환/강제닫기 후 바로 open, 이전 listJobs를 해제한다.

## 기대 결과 / 실제 결과

- 기대: 기존 사용자 데이터와 화면 상태를 보존하고 작업/계정 경계를 지킨다.
- 실제: 이전 busy가 남아 새 action을 건너뛰고 빈 fieldset과 옛 작업 오류만 보였다.

## 근거

`pedagogy-composition-ui.js`와 `pedagogy-intake.js`의 해당 흐름. 독립 재현 `/private/tmp/u2-ui-independent-review/`의 probes/owner-probe/selection-probe 및 로그. 영구 재현은 `scripts/check-composition-ui.mjs`의 같은 경계 검사다.

## 처리 기록

- 2026-10-22 · Codex 구현자: 화면 serial과 비동기 lease로 이전 continuation/finally를 격리하고 새 open busy를 초기화한다. owner-generation, late-source-disposal의 이전 finally가 새 busy를 풀지 않는 검사/RED로 검증한다. 미배포 초안을 보완했으며 최종 독립 재확인 결과는 HANDOFF-197에 이어 기록한다.
