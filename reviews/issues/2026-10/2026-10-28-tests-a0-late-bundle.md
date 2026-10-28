# A0 타임아웃 뒤 늦은 앱 스크립트 실행

- ID: `REV-2026-154`
- 날짜: `2026-10-28`
- 보고자: `Claude 제안 · Codex 독립 재현`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-204`

## 요약과 영향

분리 staging A0 전용 도구의 결함이며 production 소스에는 영향이 없다. A0 타임아웃 뒤 늦은 앱 스크립트 실행으로 로컬 검증 경계를 신뢰할 수 없다.

## 재현 절차

1. 수정 전 `70e22f0` 구현에서 `scripts/check-backend-staging.mjs`의 추가 회귀를 사용한다.
2. service-config의 loader timeout을 100ms로, index-1.js 응답을 500ms로 지연시킨 격리 브라우저. 응답 끝에 전역/LS sentinel을 추가한다.
3. 해당 회귀 목표가 실패한다.

## 기대 결과 / 실제 결과

- 기대: 잠금 뒤 앱 코드가 실행되지 않으며, 동일 A0 프로필의 동시 admission은 성공해야 한다.
- 실제: 차단 banner와 잠금 이후에도 sentinel이 실행됨(true !== false).

## 근거

`A0_FOCUS=late node scripts/check-backend-staging.mjs` 수정 전 exit1.
`reviews/audits/2026-10-28/a0-review-reproductions.json`에 정확한 목표 실패를 보존한다.

## 처리 기록

- `2026-10-28` — Codex: Claude 의견을 독립 재현해 등록. 모든 자체 classic script 맨 앞에 실행 시점 context gate를 추가하고 artifact 검증에서도 강제한다. 정상/고장 주입 검증 진행 중.

- `2026-10-28` — Codex: 수정 후 전체 A0 정상/고장 주입 통과. late gate 제거와 fresh 재검사 제거는 각각 같은 목표 단언에서 실패함을 확인했다. artifact RED13·browser RED11 및 실제 SDK10.12.0 초기화 통과. 결과는 같은 감사 폴더의 a0-browser-fixture.json/a0-real-sdk.json.
