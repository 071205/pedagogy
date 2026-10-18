# 정리 후 기존 창 수 감소를 놓치고 검사를 계속함

- ID: `REV-2026-120`
- 날짜: `2026-10-15`
- 보고자: `Codex` (Claude 후보 지적을 모의 어댑터로 독립 재현)
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-190`

## 요약과 영향

오류 해제 또는 시험 창 닫기 후 기존 창 수가 줄었는데도 다음 표본을 열었다.
하네스가 실물 사용자 문서를 유실시켰다는 주장은 아니다. 모의 창 소실을 감지하지 못하는
정책 공백이며, 그런 상태에서는 보존 성공이나 안정된 시험 환경을 주장할 수 없다.

## 재현 절차

1. before=[user]로 시작한다. 오류 해제 후 또는 probe 창을 닫은 후 빈 목록을 반환한다.
2. `H1_POLICY_BASELINE=2547a1e H1_OPEN_SCENARIO=existing-loss-after-reject node scripts/check-hwpx-open-probe.mjs`
3. `existing-loss-after-close`도 같은 방식으로 실행한다.

## 기대 결과 / 실제 결과

- 기대: `existing-window-count-decreased`·unknown으로 중단하고 다음 표본은 skip.
- 수정 전: 각각 fail/fail 또는 pass/pass. 위 검사 모두 `EXISTING_WINDOW_LOSS_CONTINUED`로 exit 1.

## 근거

`hwpx-open-probe.mjs`의 오류 해제/닫기 후 스냅샷에는 before보다 적은 창 수 분기가 없었다.
두 새 검사를 수정 전 실행해 실패를 확인했다. 최소화·동시 사용자 조작의 원인은 이 검사로 판정하지 않는다.

## 처리 기록

- `2026-10-15` · Codex: 두 정리 스냅샷에서 감소를 기록하고 즉시 중단. 거부 근거는 보존한다.
  정책 17종 PASS, 기준 `2547a1e`의 두 경로 RED. 잔류 복구 창도 focused RED selector로 보완했다.
  새 guard 때문에 기존 전체 창 닫기 RED가 상태 assertion에서 먼저 멈추는 것을 확인해,
  직접 기존 창 닫힘 assertion을 상태 assertion보다 먼저 검사하도록 조정했다.

- `2026-10-15` · Codex 독립 하네스 검토: 17종 PASS, 실제2→1 모의 감소도 unknown/skip, 기준 RED 세 경로 확인. 추가 결함 없음.
