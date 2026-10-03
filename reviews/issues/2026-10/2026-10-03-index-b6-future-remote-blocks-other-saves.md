# 서버의 문제집 하나가 새 버전 출처 정보를 가지면, 그 뒤 다른 문제집의 클라우드 저장까지 멈춘다

- ID: `REV-2026-114`
- 날짜: `2026-10-03`
- 보고자: `Claude / Opus 5.5` (HANDOFF-174 재검토)
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-174` · 관련 이슈 `REV-2026-112`(그 수정이 새로 만든 경로)

## 요약과 영향

`59a7503` 이 `writeSetDocRevision()` 트랜잭션 안에 "서버본 intake 를 이 버전이 못 읽으면 쓰지 않는다" 를 넣었다.
서버본을 덮지 않는 것은 맞다. 그런데 이 실패의 코드 `set-intake-update` 를 `writeCloudSnapshot()` 의 문서별
`catch` 가 모른다. 그 `catch` 는 `set-revision-conflict`·`set-too-big` 만 골라 `continue` 하고 나머지는 `throw e` 한다.
그래서 **그 문제집 하나에서 이번 저장 판 전체가 끊긴다.** `ready` 에서 그 뒤에 오는 정상 문제집은 올라가지 않는다.
다음 판도 같은 자리에서 끊기므로 **계속 "⚠ 저장 실패"** 가 뜨고 나머지는 이 기기에만 남는다.

계기는 이렇다. 이 기기(옛 버전)가 X 를 고치는 동안 다른 기기(새 버전)가 X 를 intake v2 로 저장한다.
로컬 X 는 정상 v1 이라 `intakeNeedsUpdate(로컬)` 는 거짓이고 dirty 목록에 들어간다. 지금 운영에는 v2 를 쓰는 판이 없으므로
**B6 를 그대로 배포해도 당장은 안 터진다.** 다음 intake 버전을 낼 때 터진다. REV-2026-112 가 막으려던 것과 같은 모양
(한 권이 다른 권을 멈춘다)이 쓰기 쪽에 남았다.

## 재현 절차

`codex/b6-intake-storage` `59a7503`, `serve.py`, 외부 요청 차단, `fbDb` 메모리 stub, `setRevisionSchema:1`:
1. 로컬 `sets` = [X, Y] 둘 다 dirty(서버 확정 기록 없음).
2. 대조군: 서버 비어 있음 → `writeCloudSnapshot()` 세 번 → 서버 = X·Y, 상태 문구 없음.
3. 서버 X 에 문항 intake `{version:2,sources:[]}`, revision 3 을 둔다 → `writeCloudSnapshot()` 세 번 →
   서버 X 는 v2 그대로(덮지 않음 — 맞다)이지만 **Y 가 서버에 없다.** 매 판 상태 "⚠ 저장 실패",
   토스트 "클라우드 저장에 실패했어요 · 이 기기에는 저장돼 있습니다".

## 제안

`set-intake-update` 도 `tooBig` 처럼 그 문제집만 건너뛰고 다음 문제집을 계속 올린다. 그 문제집은 B4 충돌로 보내지 말고
(자동 사본을 만들면 v2 출처를 잃은 사본이 생긴다) 로컬 초안을 그대로 둔 채 '업데이트 필요 · 계정 저장 보류' 로 표시한다.
`watchCloud()` 가 새 버전 서버본을 받았을 때 dirty 로컬을 어떻게 보이게 할지도 같은 묶음에서 정한다.
회귀: 위 3번(Y 가 올라가는지)과 순서를 바꾼 경우(X 가 뒤에 있을 때).

## 처리 기록

2026-10-03 · Codex · `resolved` (독립 재검토 대기).
문서별 catch에서 `set-intake-update`를 별도 보류로 처리해 나머지 권을 계속 저장한다.
owner별 서버 관측 보류를 dirty 선정/재예약에서 제외하고, 로컬 초안은 수정하지 않은 채 카드와
저장 상태에 '업데이트 필요 · 계정 저장 보류'를 표시한다. B4 충돌/자동 사본/ACK로 바꾸지 않는다.
첫 server 읽기·확정 구독에서도 보류를 재구성한다. dirty 로컬은 유지하고 clean 로컬은 불명 원문을
읽기 전용으로 받는다. cache/pending은 해제하지 않으며 호환 가능한 서버 확정 관측으로 해제한다.
계정 전환 시 상태를 비우고 owner를 대조한다. 읽을 수 없는 출처가 있으면 원문 삭제도 확인 필요다.

`scripts/check-intake-remote-update.mjs`의 실제 CAS/구독 브라우저 검사 11개가 통과했다.
원 재현의 빈 서버 대조군·X 앞/뒤 순서·3회 저장에서 Y가 올라가고 X 서버본과 로컬 초안은 동일했다.
자동 재예약 0회·충돌 기록/사본 없음·일괄 삭제 차단, 손상 intake, dirty/clean 구독,
첫 읽기, cache/pending→호환 ACK, 다른 owner, 일반 오류 처리도 확인했다.
`B6_REMOTE_RED=1`로 수정 전 `d7ad822`을 제공하면 X 앞일 때 Y 없음·X 뒤일 때 일반 저장 실패 등
7개 검사가 실제 실패한다. 이 검사를 `test:intake-review`→`test:intake`→`check:fast`에 연결했다.
기존 B6/112/113·CAS 35/35·필수 serve.py 회귀 167/167 통과.
[HANDOFF-175](../../handoffs/2026-10/2026-10-03-index-b6-remote-update-hold.md)에 범위·검증·다음 행동을 남겼다.
