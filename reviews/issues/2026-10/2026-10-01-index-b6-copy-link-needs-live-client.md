# 새로고침 뒤 복제한 문제집은 원문 연결을 물려받지 못해 원본 대조가 '없음'이 된다

- ID: `REV-2026-113`
- 날짜: `2026-10-01`
- 보고자: `Claude / Opus 5.5` (HANDOFF-173 독립 검토)
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-173` · 계약 `HANDOFF-2026-172`(B6 수용: "A→B 복제 후 A 삭제에도 B 원문 대조 유지")

## 요약과 영향

문제집 복제(`renderLibrary` 의 `bDup`)와 충돌 사본(`ensureConflictCopies`)은 원문 연결을
`intakeClients.forEach(c=>c.inheritLinks(…).catch(()=>{}))` 로만 넘긴다. **이 탭에 B6 클라이언트가 만들어져
있을 때만** 실행되고, 실패해도 조용히 버린다. 새로고침 직후(클라이언트 0개)나 부팅 때 도는 충돌 사본 생성에서는
연결이 생기지 않는다.

`forProblem()` 은 권 연결이 있어야 원문을 내준다(외부 JSON 차단 규칙). 그래서 같은 owner 가 이 기기에서 만든 사본도
가져온 파일처럼 `missing` — "이 브라우저에 연결된 원본이 없습니다" 가 된다. 반면 `impact()` 는 문항 출처로 그 사본을
'사용 중' 으로 센다. 원문은 지워지지 않지만(보존은 맞다) **두 판정이 어긋나고**, A 를 지우면 B 의 원본 대조가 남지 않는다.
U1.5 UI 연결 전이라 **현재 사용자 영향은 없다.**

## 재현 절차

브라우저(`serve.py`, guest, 외부 요청 차단, `createIntakeFixture` 와 stub renderer/transport, `editorsConfirmed:true`):
1. 작업 생성 → 실행 → '원본권' 채택. `forProblem(원본권)` = `available`.
2. 같은 탭에서 라이브러리 카드의 실제 **'복제'** 단추 → 사본 `forProblem` = `available` (클라이언트 1개).
3. **새로고침** → 클라이언트를 만들기 전에 실제 '복제' 단추 → 그 뒤 클라이언트를 만들고 확인:
   원본 `available`, **사본 `missing`**, `impact(sourceId).active` 에는 사본이 **들어 있다**.
   사본 문항의 `intake.sources` 는 그대로 있다.

## 제안

연결 승계가 '살아 있는 클라이언트' 에 기대지 않게 한다. 예: 복제·충돌 사본 경로가 모듈 수준 함수로 IDB 에 직접
연결을 쓰거나(계정 삭제의 정리 클라이언트처럼 필요할 때 만든다), 실패·미실행을 다음 `reconcile()` 이 메우도록
'이 owner 가 이 기기에서 만든 사본' 의 계보(원본 setId)를 문제집 쪽에 남긴다. 가져온 JSON 은 계속 연결 없이 시작해야 한다.
회귀: 위 3번(새로고침 뒤 복제)과 충돌 사본(부팅 때 생성), 그리고 A 삭제 뒤 B `available`.

## 처리 기록

2026-10-03 · Codex · `resolved` (독립 재검토 대기, [HANDOFF-174](../../handoffs/2026-10/2026-10-03-index-b6-review-fixes.md)).
살아 있는 `intakeClients`에만 기대던 승계를 기본 owner IDB 연결 전용 클라이언트로 보완했다.
실제 복제/충돌 복구는 원문 권한 승계 완료 후 사본을 게시하고, IDB 실패는 안내·보류한다.
부팅/계정 전환/충돌 호출부는 비동기 복구를 기다린 뒤 같은 owner/epoch인지 확인한다.

재현 검사는 `scripts/check-intake-review-fixes.mjs`의 113 항목이다. 같은 탭 실제 복제,
새로고침 뒤 클라이언트 0개에서 실제 복제, 원본권 삭제 뒤 사본 available, 부팅 충돌 복구를 통과했다.
impact의 active와 forProblem available도 일치한다. 외부 JSON sourceId는 계속 missing이다.
IDB 실패 때 사본 없음/실패 안내와 새로고침 재시도 available도 확인했다.
`B6_REVIEW_RED=113`의 수정 전 `eb7e69f`는 새로고침 복제·원본 삭제 후 접근·부팅 충돌의 3개 검사가
missing으로 실제 실패한다. 기존 CAS 35/35·B6 28개·필수 회귀 167/167 통과. 증거는 HANDOFF-174 참조.
