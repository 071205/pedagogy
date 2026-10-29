# 창 개수만 같은 교체를 놓치고 검사를 계속함

- ID: `REV-2026-122`
- 날짜: `2026-10-15`
- 보고자: `Codex` (Claude 지적을 독립 모의 재현)
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-190`

## 요약과 영향

오류 해제/시험 창 닫기 뒤 기존 창 대신 다른 무제목 창이 생기면 개수 감소 검사가 통과했다.
실제 사용자 문서 손실을 재현한 것이 아니라, 그 모의 상태에서 보존 실패를 놓치는 정책 공백이다.

## 재현 절차

1. before=[user document], 정리 뒤=[Untitled replacement]를 반환한다.
2. `H1_POLICY_BASELINE=2547a1e H1_OPEN_SCENARIO=existing-swap-after-reject node scripts/check-hwpx-open-probe.mjs`
3. `existing-swap-after-close`도 같은 방식으로 실행한다. 두 경로 모두 `EXISTING_WINDOW_SWAP_CONTINUED` exit1.

## 기대 결과 / 실제 결과

- 기대: 같은 개수여도 기존 제목 multiset이 남지 않으면 unknown·중단, 다음 표본 skip.
- 수정 전: 거부 경로는 fail/fail, 닫기 경로는 pass/pass.

## 근거

Claude 재개 검토가 `length < before.length` 공백을 지적했고 현재 정책에서 새 반례2개를 먼저 실패시켰다.
제목 비교는 경로/실제 문서 정체성의 증명이 아니다. 같은 제목으로 교체되는 경우·동시 조작 한계는 유지한다.

## 처리 기록

- `2026-10-15` · Codex: NFC 제목별 개수로 기존 multiset의 잔존을 확인한다.
  기존 병합/모호한 창 reason 우선순위를 보존하며 `existing-window-lost`·unknown으로 중단한다.
  정책19종 및 기존 연구 게이트 PASS, 기준 두 경로 RED.
