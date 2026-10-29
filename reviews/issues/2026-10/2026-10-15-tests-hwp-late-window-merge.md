# 확인 시점의 창 수 감소를 놓치고 병합된 창을 닫음

- ID: `REV-2026-119`
- 날짜: `2026-10-15`
- 보고자: `Codex` (독립 검토 에이전트 재현, 주 에이전트 확인)
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-190`

## 요약과 영향

새 창 수 보존 정책은 첫 관찰만 확인했고, 확인 스냅샷에서 기존 창에 병합된 모의 상태를
pass로 처리해 닫았다. 실물 한글의 늦은 병합을 재현했다는 주장은 아니다.

## 재현 절차

1. 가짜 UI에서 before=[user], 첫 관찰=[user,probe], 확인 관찰=[probe]로 반환한다.
2. 수정 전 정책에서는 pass가 되고 probe 제목의 창을 닫았다.
3. `H1_POLICY_BASELINE=2547a1e H1_OPEN_SCENARIO=late-merge node scripts/check-hwpx-open-probe.mjs`
   실행 시 `LATE_MERGED_WINDOW_CLOSED`로 exit 1.

## 기대 결과 / 실제 결과

- 기대: 확인 시점에도 창 수가 늘지 않았다면 unknown·중단·창 보존.
- 수정 전: 첫 스냅샷의 창 증가만으로 소유를 확정해 pass·닫기.

## 근거

`scripts/lib/hwpx-open-probe.mjs`의 confirmed 상태에는 창 수 조건이 없었다.
`scripts/check-hwpx-open-probe.mjs`의 lateMerge 어댑터로 수정 전 실패를 먼저 확인했다.

## 처리 기록

- `2026-10-15` · Codex: confirmed에도 창 수 조건을 적용하고 최신 관찰 개수로 보고서를 갱신.
  현재 late-merge PASS·닫기 없음, 과거 정책 RED. 정상/거부 직후 병합과 오류 후 모호한 창도 각각 RED.
  실물 거부 후 새 무제목 창이 남는 현상은 별도 cleanup-incomplete/unknown으로 멈추고 거부 근거를 보존한다.
