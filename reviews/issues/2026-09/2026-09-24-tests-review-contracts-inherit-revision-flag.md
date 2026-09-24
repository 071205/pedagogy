# 리뷰 계약 검사 4건이 배포 플래그 `setRevisionSchema: 1` 을 물려받아 빨간불이다

- ID: `REV-2026-110`
- 날짜: `2026-09-24`
- 보고자: `Claude / Opus 5.5`
- 상태: `open`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-168`

## 요약과 영향

`service-config.js` 가 B3 배포 때 `setRevisionSchema: 1` 로 바뀌면서(`8a557e0`)
`node scripts/check-review-contracts.mjs`(= `test:review-contracts`, `check:fast` 에 포함)의 4건이 실패한다.
검사들이 `fbDb` 를 `runTransaction` 없이 흉내 내는데, 플래그를 명시하지 않아 운영 플래그 1 을 물려받아
revision 경로로 들어간다. **`check:fast` 가 로컬 `main` 에서 빨간불**이다.

`REV-2026-051` 이 경고한 것과 같은 모양의 재발이다 — "검사가 배포 플래그를 물려받게 하지 말 것".
B3 배포 인계(`HANDOFF-2026-168`)는 `check-set-sync-metadata.mjs` 만 플래그 0 으로 고정했고
이 검사는 돌리지 않았다.

## 재현 절차

1. 현재 `main`(`service-config.js` 의 `setRevisionSchema: 1`).
2. `node scripts/check-review-contracts.mjs`

## 기대 결과 / 실제 결과

- 기대: 전부 PASS(검사는 제품 동작을 보고, 배포 플래그와 무관해야 한다).
- 실제: FAIL 4건 —
  `delete and immediate restore use same queue, delete errors propagate`(`fbDb.runTransaction is not a function`) ·
  `actual selection Undo and Redo survive delayed tombstone snapshot` ·
  `401 selected deletes retain only failed ID and permit retry` ·
  `concurrent prefs save preserves remote tombstones and clears 401 memberships in chunks`.

## 근거

- `REV-2026-109` 수정 **전** 커밋(`f302a7c`)의 별도 작업 트리에서도 같은 4건이 실패했다 — 그 수정과 무관하다.
- 독립 검사 에이전트도 첫 건이 `runTransaction` 없는 스텁 + 플래그 상속임을 코드로 확인했다.

## 제안 (선택)

`REV-2026-051` 의 방식대로 각 검사의 `app()` 에 `setRevisionSchema` 단계를 **명시**하고,
revision 경로를 보려는 검사는 `runTransaction` 을 가진 스텁을 쓴다. 플래그를 0 으로 되돌려 초록불을 만들지 말 것.

## 처리 기록

- `2026-09-24` — `Claude / Opus 5.5`: 등록. `REV-2026-109` 수정 중 회귀를 돌리다 발견해 HEAD 이전 작업 트리로
  기존 결함임을 갈랐다. 수정하지 않았다(범위 밖).
