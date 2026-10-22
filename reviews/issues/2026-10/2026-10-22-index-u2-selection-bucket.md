# 새 구성안 적용 뒤 문항 상세와 목적지가 달라진다

- ID: `REV-2026-144`
- 날짜: `2026-10-22`
- 보고자: `Codex 독립 검토 에이전트`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-197`

## 요약과 영향

새 구성안 적용 뒤 문항 상세와 목적지가 달라진다. U2 미배포 초안에서 독립 검토가 재현했으며 운영 발생을 주장하지 않는다.

## 재현 절차

두 단원의 뒤 문항을 선택한 상태에서 단원별 구성안을 적용한다.

## 기대 결과 / 실제 결과

- 기대: 기존 사용자 데이터와 화면 상태를 보존하고 작업/계정 경계를 지킨다.
- 실제: 첫 단원 목적지/문항 목록인데 상세는 다른 단원 문항이고 목록에는 선택된 버튼이 없었다.

## 근거

`pedagogy-composition-ui.js`와 `pedagogy-intake.js`의 해당 흐름. 독립 재현 `/private/tmp/u2-ui-independent-review/`의 probes/owner-probe/selection-probe 및 로그. 영구 재현은 `scripts/check-composition-ui.mjs`의 같은 경계 검사다.

## 처리 기록

- 2026-10-22 · Codex 구현자: reload 시 선택 ID를 현재 bucketItems 안에서 검증하고 그 첫 문항 또는 null로 보정한다. selected-bucket-consistency 정상/선택 방어 제거 RED로 검증한다. 미배포 초안을 보완했으며 최종 독립 재확인 결과는 HANDOFF-197에 이어 기록한다.
