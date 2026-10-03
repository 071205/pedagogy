# 계정 삭제 중 Auth 삭제가 실패하면, 남은 계정에서 이 브라우저의 일괄 AI 원문 저장이 영영 막힌다

- ID: `REV-2026-117`
- 날짜: `2026-10-03`
- 보고자: `Claude / Opus 5.5` (PR #8 CodeRabbit 지적을 독립 재현)
- 상태: `resolved`
- 심각도: `P3`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-173`

## 요약과 영향

`deleteAccountEverything()` 은 Auth 삭제(`user.delete()`) **전에** `cleanup.purge()` 를 부른다(`index.html` 계정 삭제 ⑤-b).
`purge()`(`pedagogy-intake.js`)는 그 owner 의 IDB 기록을 `{deleted:true}` 울타리로 바꾼다. `transact()` 는 이 울타리가 있으면
모든 작업을 '삭제한 계정의 작업은 재개할 수 없습니다' 로 거절한다. 그런데 `user.delete()` 가 실패하면(망 오류 등) 계정은 남는다.
같은 계정으로 계속 쓰거나 다시 로그인해도 울타리를 지우는 경로가 없다. 그래서 그 브라우저에서는 그 계정의 원문 보관·작업 만들기·
채택·원본 대조(`forProblem`)·복제 연결 승계(`inheritIntakeLinks` → 실패하면 복제를 보류한다)가 계속 막힌다.
계정 삭제를 다시 시도해 성공하면 풀린다. 그 뒤 새 계정은 새 UID 다. UI 가 아직 없어 지금 사용자 영향은 없다.
울타리 자체(삭제 중 늦은 쓰기 차단)는 계약상 필요하다. 문제는 삭제가 끝나지 않았을 때 **수명**이다.

## 재현 절차

`codex/b6-intake-storage` `d0a4da4`, `serve.py`, 외부 차단, `createIntakeFixture`(stub renderer):
같은 IDB·같은 owner 로 `createJob` → `purge()`(= Auth 삭제 직전까지 진행됐다고 본다) → **새 클라이언트**(다음 세션)로 `createJob`
→ `"삭제한 계정의 작업은 재개할 수 없습니다"`.

## 제안

울타리를 그 삭제 시도(세션·epoch 또는 삭제 토큰)에 묶는다. Auth 삭제가 실패하면 그 시도의 울타리를 걷는다(원문은 이미 파기된 채로 둔다).
다음 세션이 울타리를 만나면 '삭제가 끝나지 않은 계정' 으로 보고, 빈 기록으로 다시 시작하게 할지 안내할지를 정한다.
회귀: 위 재현에서 다음 세션의 `createJob` 이 되고, 삭제 진행 중의 늦은 쓰기는 계속 막히는지.

## 처리 기록

2026-10-03 · Codex: `purge()`가 삭제 시도 UUID를 fence에 보관한다. Auth 삭제 실패 시
`user.reload()`로 같은 UID의 계정 존속을 서버에서 확인한 경우에만 그 시도의 fence를 제거한다.
원문·job·adoption은 복원하지 않는다. 확인이 불확실하면 fence를 유지하고, 뒤이은 동일 계정
로그인의 `onAuth`가 `purgeFence()`를 발견했을 때 다시 Auth 서버 확인 후 빈 저장소로 복구한다.
Web Lock 지원 브라우저에서는 삭제/복구를 owner별로 직렬화한다. 다른 삭제 시도의 UUID로는
fence를 제거할 수 없다.

`scripts/check-intake-delete-fences.mjs`의 117 검사는 purge 중 늦은 쓰기와 새 작업을 거절하고,
모의 Auth 실패 뒤 실제 `deleteAuthWithIntakeFence()` 경로를 실행해 다음 같은 owner의
`createJob` 및 원문 비복구를 확인했다. 불확실한 실패의 fence 보존·후속 복구와 시도 UUID
불일치 거절도 확인했다. 수정 코드 PASS, `B6_DELETE_RED=117`에서 `28089b3`의 영구 fence를
실패로 탐지했다. 필수 브라우저 검사 세 건은 실행 환경의 포트/Chromium 권한 제한으로 보류되어
검증 뒤 상태를 닫는다.
- `2026-10-03` — `Claude / Opus 5.5`: **해결 확인.** 막혔던 브라우저 검사를 다시 돌려 통과했고, 원래 재현이 수정 전 `28089b3` 에서만 빨간불이다(HANDOFF-2026-178 검토 기록). 수정이 만든 로그인 복구 부작용(IndexedDB 없음 오류 안내·미사용자 DB 생성)은 같은 날 Claude 가 고치고 Codex 가 검토했다.
