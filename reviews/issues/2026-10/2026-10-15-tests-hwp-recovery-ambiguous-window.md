# 거부 복구 뒤 모호한 시험 창을 남긴 채 다음 파일을 검사함

- ID: `REV-2026-118`
- 날짜: `2026-10-15`
- 보고자: `Codex` (독립 검토 에이전트 재현, 주 에이전트 독립 확인)
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-190`

## 요약과 영향

한글 오류를 해제한 뒤 같은 시험 이름의 창 둘이 남으면 정책이 소유 창을 특정하지 못한 채
다음 파일을 열었다. 진단이 불안정한 상태에서 연속 시험을 진행해 실험 판정을 오염시킨다.
실물에서 이 창 상태가 생기는 조건이나 사용자 데이터 유실까지 재현한 것은 아니다.

## 재현 절차

1. 가짜 UI에서 첫 파일 열기 뒤 인식한 오류 창을 만든다.
2. 오류 해제 뒤 `probe.hwpx` 창 둘을 남긴다.
3. 현재 회귀 검사에 과거 정책을 주입한다:
   `H1_POLICY_BASELINE=2547a1e H1_OPEN_SCENARIO=ambiguous-recovery node scripts/check-hwpx-open-probe.mjs`.

## 기대 결과 / 실제 결과

- 기대: 첫 파일 unknown/ambiguous-window, 이후 skip. 창을 닫지 않으며 거부 관찰도 보존.
- 과거 실제: 첫 파일 fail 뒤 다음 파일까지 검사. 새 회귀 검사가 `RECOVERY_AMBIGUITY_CONTINUED`로 exit 1.

## 근거

`scripts/lib/hwpx-open-probe.mjs`의 오류 회복 경로는 `matches.length > 1`을 처리하지 않았다.
정상 열기 경로에는 같은 모호성의 중단 처리가 있었다. Node 어댑터로 두 경로의 차이를 재현했다.

## 처리 기록

- `2026-10-15` · Codex: 오류 회복에도 모호한 창 중단을 추가. `rejectionObserved`로 거부 확인 사실을
  남기고 마지막 상태는 unknown으로 기록. 검사에 창 보존·첫 파일만 열림·거부 근거 보존을 추가.
  현재 정책 11종 PASS, 과거 정책 주입 RED 확인. 원래 창 닫기 오염 RED와 표본 RED도 PASS.
- `2026-10-15` · Codex 독립 검토 에이전트: 기존 재현으로 unknown/skip과 두 창 보존 확인. 결함 해소.
