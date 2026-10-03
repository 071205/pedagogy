# 변경 인계 — B6 원문 삭제 요청 범위와 계정 삭제 울타리 수명

- ID: `HANDOFF-2026-178`
- 날짜: `2026-10-03`
- 작성자: `Codex`
- 상태: `reviewed` — Claude 검토 2026-10-03: 116·117 해소(로그인 복구 부작용 1건은 Claude 수정·Codex 검토)
- 영향 영역: `index | tests | docs`
- 관련 이슈: `REV-2026-116` · `REV-2026-117` (`in-progress`, 필수 브라우저 검증 대기)

## 변경 내용

기준 `28089b3`, 브랜치 `codex/b6-intake-storage`. `pedagogy-intake.js`의 진행 중 요청을
sourceId로 추적하여 원문 삭제 시 해당 원문의 요청만 중단한다. 삭제 generation fence와 계정 전환·
`purge()`의 전역 `stop()`은 유지한다. 현재 엔진은 object URL을 생성하지 않지만 보유 URL의
해제 범위도 sourceId로 구분했다.

계정 삭제에서는 `purge()`가 시도 UUID를 fence에 남긴다. Auth 삭제가 실패해도 서버의
`user.reload()`가 같은 UID의 존속을 확인한 뒤에만 해당 UUID fence를 제거한다. 원문은 파기된
그대로다. 확인이 불확실하면 fence를 유지하고, 다음 동일 계정 로그인 때 서버 확인을 거쳐
빈 저장소로 복구한다. Web Lock 지원 시 삭제와 복구를 owner별로 직렬화한다.
`index.html` 인라인 CSP 해시와 추출형 Worker 검사 fixture를 갱신했다.

## 위험과 검토 요청

Claude Opus는 `28089b3` 이후 이 diff만 검토한다. 특히 A 삭제 중 B 요청의 상태와 A의 늦은
저장 fence, Auth 실패/불확실 결과에서 원문 비복구와 동일 계정 복구, 계정 삭제 성공 시 fence
유지 여부를 확인한다. 다른 탭의 삭제/복구 경쟁에서 Web Lock 지원 여부에 따른 경계도 확인한다.
112~115 및 B3/B4/B5의 승인 diff는 반복 검토하지 않는다.

## 검증

- `node scripts/check-intake-delete-fences.mjs`: 116·117 PASS. 실서비스 AI/Firebase 호출 없이
  비동기 IDB fixture, 요청 중단, 실제 Auth 삭제 보조 함수로 검사.
- `B6_DELETE_RED=116/117` 각각 기준 `28089b3`에서 의도한 결함으로 빨간불 탐지 PASS.
- `npm run test:worker` PASS (`/tmp/b6-116-117-worker-rerun.log`).
- `npm run test:public` PASS (CSP 해시 포함); `git diff --check` PASS.
- `npm run test:intake`, `npm run test:audit-browser`: 이 실행 환경이 `127.0.0.1`
  바인딩을 `EPERM`으로 거부하여 미완료. `npm run test:set-revision`: Chromium Mach 포트
  권한 거부로 미완료. 각각 `/tmp/b6-116-117-check-0.log`, `-2.log`, `-1.log`.
- `npm run check:static`, `npm run check:review-hygiene`: 최종 기록 갱신 뒤 PASS.
- 로컬 커밋 시도: `git add`가 `.git/index.lock: Operation not permitted`로 거부됐다.
  이 실행 환경은 `.git`을 읽기 전용으로 제공하므로 커밋은 남기지 못했다.

브라우저 검사 3개를 권한이 있는 환경에서 재실행하고 이슈의 처리 기록에 결과를 남긴 뒤에만
두 이슈를 `resolved`로 닫는다. PR #8 CI와 독립 검토 뒤 사용자 승인 merge 단계로 넘긴다.
커밋 권한이 있는 로컬 환경에서 이 변경만 명시적으로 stage/commit해야 한다.
push·main 병합·배포는 하지 않았다. `transcript.txt`는 읽거나 수정하거나 추가하지 않았다.

## 다음 검토자에게

**Claude Opus**: `28089b3..HEAD`의 116·117 수정 diff와 위 빨간불을 독립 검토해 이 인계의
검토 기록에 판정을 남긴다. 브라우저 검사는 `npm run test:intake`, `npm run test:set-revision`,
`npm run test:audit-browser`를 localhost/Chromium이 허용된 환경에서 실행한다.

## 검토 기록

### 2026-10-03 — Claude Opus 5.5 검토: **116·117 해소 · 로그인 복구 부작용 1건 수정**

이 실행 환경에서 막혔던 브라우저 검사를 다시 돌렸고, Codex 가 남긴 변경은 Claude 가 대신 커밋했다(Codex 샌드박스가 `.git` 쓰기를 거부).
- **116 해소.** 진행 중 요청을 `controllers: Map(controller → sourceId)` 로 기록하고 `deleteSource()` 는 그 원문의 요청·object URL 만 끊는다.
  전역 `stop()` 은 계정 전환·`purge()` 에만 남았다. `check-intake-delete-fences` 116 PASS · `B6_DELETE_RED=116` 빨간불.
- **117 해소(설계 동의).** 삭제 시도마다 울타리에 `fence` ID 를 둔다. Auth 삭제가 실패해 `user.reload()` 로 계정 존속이 확인되면 그 시도의 울타리만 걷는다.
  결과가 불확실하면 울타리를 남기고, 같은 계정의 다음 로그인에서 `reload()` 로 확인한 뒤 복구한다. 117 PASS · `B6_DELETE_RED=117` 빨간불.
- **Claude 가 찾아 고친 부작용(브라우저 재현).** 로그인 복구(`recoverIntakeOnSignIn`)가 **모든 사용자의 모든 로그인**에서 돌아,
  ① IndexedDB 가 없는 브라우저는 로그인할 때마다 '원문 저장 복구를 확인하지 못했어요 · 다시 로그인해 주세요' 오류 안내가 떴다
  (일괄 AI 를 안 쓴 사용자 포함, 다시 로그인해도 안 풀린다). ② IndexedDB 가 있으면 로그인만으로 `PM_INTAKE_V1` DB 를 만들었다.
  ③ 동시 두 번째 호출이 받는 promise 는 감싸지 않아 실패 시 `onAuth` 로 던질 수 있었다.
  → IndexedDB 없음·DB 미생성(`databases()` 지원 시)은 조용히 통과, 오류 안내는 울타리를 실제로 찾았을 때만, 두 호출자 모두 던지지 않게.
  새 검사 `check-intake-signin-recovery.mjs`(①② 무안내·미생성, ③ 남은 울타리 복구) PASS, `B6_SIGNIN_RED=1`(수정 전 함수) ①② 빨간불.
  기존 117 검사의 VM 에 `indexedDB.databases()` 스텁을 더했다(울타리는 그 DB 안에만 있을 수 있다).
  **Codex GPT-6 Sol medium 독립 검토: 117 의 목적(실패 뒤 다음 로그인 복구)을 깨는 재현 근거 없음**, 위 VM 누락만 지적 → 반영.
- 다시 돌린 검사: `test:intake` 전체(B6 28 · 112~117 재현과 빨간불 · 로그인 복구) · `test:audit-browser` 167/167 ·
  `test:set-revision` 35/35·과거판 빨간불 · `test:sets-cloud` · `test:worker` · `test:public` · `check:static` · `check:review-hygiene` 통과.
- 남은 위험(재현 근거 없음, 기록만): `databases()` 를 지원하지 않는 브라우저는 로그인 때 DB 를 여전히 연다(빈 DB 생성).

**판정**: B6(REV-2026-112~117) 독립 검토 합의. PR #8 CI 확인 → **해리 승인 merge(운영 배포)** → B7(Codex GPT-6 Sol high).
