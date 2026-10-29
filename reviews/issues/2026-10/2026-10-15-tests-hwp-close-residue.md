# 시험 창을 닫은 후 남은 새 창을 놓침

- ID: `REV-2026-124`
- 날짜: `2026-10-15`
- 보고자: `Codex` (Claude 지적을 모의 재현)
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-190`

## 요약과 영향

시험 창 close 후 기존 제목은 모두 남지만 새로운 비모달 무제목 창이 추가된 상태를 pass로 처리했다.
이 잔류 창은 다음 표본의 before에 섞였다. 실제 앱에서 새 사용자 문서를 닫았다는 재현은 아니다.

## 재현 절차

`H1_POLICY_BASELINE=2547a1e H1_OPEN_SCENARIO=residual-after-close node scripts/check-hwpx-open-probe.mjs`.
수정 직전 정책도 같은 반례에서 `RESIDUAL_CLOSE_CONTINUED` exit1이었다.

## 기대 결과 / 실제 결과

- 기대: 정리 후 창 수가 before와 다르면 unknown/cleanup-incomplete·중단.
- 수정 전: pass/pass로 계속 진행.

## 근거 / 처리 기록

- `2026-10-15` · Codex: close 후 개수 동등 조건을 추가하고 새 창은 자동으로 닫지 않는다.
  현재 정책20종 PASS, 수정 전 반례와 기준 RED. 거부 후 잔류 창과 같은 보수적 중단 정책이다.
