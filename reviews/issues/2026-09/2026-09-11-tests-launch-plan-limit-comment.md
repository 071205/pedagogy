# 주석의 유료 플랜 AI 상한을 출시 설정으로 오인한다

- ID: `REV-2026-079`
- 날짜: `2026-09-11`
- 보고자: `Codex (독립 확인)`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests | worker`
- 관련 인계: `HANDOFF-2026-114 | HANDOFF-2026-115`

## 요약과 영향

`scripts/check-launch-readiness.mjs`가 `worker/wrangler.toml`에
`PLAN_DAILY_LIMITS_JSON`이라는 문자열만 있으면 유료 플랜별 AI 상한이 설정됐다고
판정했다. 현재 파일은 예시 대입을 주석으로만 두었는데도 해당 출시 차단 항목이
누락됐다. 나머지 차단 항목을 모두 해결하면 운영 설정이 없는 상태를 게이트가
잘못 통과시킬 수 있었다.

## 재현 절차

1. `worker/wrangler.toml`의 `PLAN_DAILY_LIMITS_JSON` 줄이 `#`로 주석 처리된 것을 확인한다.
2. `npm run check:launch`를 실행한다.
3. 출력된 차단 항목에 `유료 플랜별 AI 상한 설정이 없습니다.`가 없는 것을
   확인한다.

## 기대 결과 / 실제 결과

- 기대: 주석은 설정이 아니므로 유료 플랜별 AI 상한 미설정을 출시 차단 항목으로
  보고한다.
- 실제: `/PLAN_DAILY_LIMITS_JSON/`가 주석 문자열을 실제 설정으로 오인해 항목을 보고하지
  않았다.

## 근거

- `worker/wrangler.toml`: `# PLAN_DAILY_LIMITS_JSON = '{"free":50,...}'`로만 존재했다.
- 수정 전 `npm run check:launch`: 다른 6개 항목은 보고했지만 유료 플랜 상한은
  보고하지 않았다.
- `reviews/audits/2026-09-08/REPORT.md`에도 같은 오탐 관찰이 있었으나 실행형
  회귀 검사와 이슈 기록은 없었다.

## 처리 기록

- `2026-09-11` — `Codex`: 재현 후 등록. `collectLaunchBlockers()`를 분리하고
  주석만 있는 fixture와 실제 TOML 대입 fixture를 추가했다. 수정 전 검사가
  assertion error로 실패하는 것을 확인했다.
- `2026-09-11` — `Codex`: 출시 검사가 행 시작의 실제
  `PLAN_DAILY_LIMITS_JSON = ...` 대입만 인정하도록 수정했다.
  `node scripts/check-launch-readiness.test.mjs` 통과. `npm run check:launch`는 기대대로
  실패하며 기존 6개에 이 항목을 더한 7개 차단 사유를 보고했다.
