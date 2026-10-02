# 변경 인계 — B6 서버 출처 업데이트 보류를 권별로 격리

- ID: `HANDOFF-2026-175`
- 날짜: `2026-10-03`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | tests | docs`
- 관련 이슈: `REV-2026-114` (수정·재현 검사 완료)

## 변경 내용

기준 `d7ad822`·브랜치 `codex/b6-intake-storage`. HANDOFF-174가 확인한 112·113 수정은 유지한다.
`writeCloudSnapshot()`의 문서별 catch에 `set-intake-update` 보류를 추가했다. 그 뒤 정상 권의
transaction/ACK는 계속한다. 보류된 권은 dirty/자동 재예약에서 제외하고 실패 장부에 넣지 않는다.

`intakeRemoteBlocked`는 owner를 대조하는 서버 관측 상태이며 로컬 본문이나 CAS 기준이 아니다.
첫 server 읽기/확정 구독과 transaction 읽기가 상태를 갱신한다. dirty 로컬은 그대로 두고
'업데이트 필요 · 계정 저장 보류'로 표시하며 편집·복제·일괄 삭제를 막고 JSON 내보내기는 유지한다.
clean 로컬은 기존 112 경계로 불명 intake 원문을 보존한다. B4 충돌/자동 사본은 만들지 않는다.
cache/pending은 해제하지 않고 호환 가능한 server 확정 관측은 해제한다. 계정 전환 시 비우며
다른 owner에게 적용하지 않는다. 구독은 원문 삭제 영향에 확인 필요를 전달한다.

이 상태는 영속 초안을 대체하지 않는다. 새로고침 뒤 첫 서버 관측 전 기존 원문 삭제 준비 게이트가
계속 막고, 서버 읽기에서 보류 상태를 다시 만든다. 단순 보류는 새 유료 호출/배포/Rules 변경을 하지 않는다.

## 위험과 검토 요청

1. 원 재현의 X 앞/뒤와 반복 저장에서 Y ACK, X 서버 원문·로컬 초안 불변, 재예약 루프가 없는지.
2. dirty/clean 첫 읽기·구독, cache/pending 해제 금지, owner 경계와 읽기 전용 UI/삭제 영향.
3. 정상 CAS 충돌·용량 초과·일반 실패는 기존 경로를 유지하는지. 112·113 승인 diff는 반복 검토하지 않는다.

## 검증

모든 브라우저 검사는 serve.py·Chromium, 외부 요청 차단, Firestore/AI fixture로 실행했다.

- `node scripts/check-intake-remote-update.mjs`: 원 재현·경계 **11개 통과**. 빈 서버 대조군,
  X 앞/뒤·3회 저장·손상 intake·dirty/clean 구독·첫 server 읽기·cache/pending→호환 ACK,
  계정 분리·일괄 삭제 차단·일반 오류 유지. `/tmp/b6-rev114-green-final.log`.
- `B6_REMOTE_RED=1 node scripts/check-intake-remote-update.mjs`: 수정 전 `d7ad822`의 원 재현 포함
  **7개 실패 탐지**. `/tmp/b6-rev114-red-final.log`. `test:intake`/`check:fast`에서도 필수 실행한다.
- `npm run test:intake`: B6 수용 28개·실제 두 탭/image/PDF, 112/113 재현 14개·수정 전 빨간불,
  114 최종 11개·수정 전 7개 실패 탐지까지 통합 실행 통과. `/tmp/b6-rev114-intake-final.log`.
- `npm run test:set-revision`: 정상 35/35·과거판 35개 실패 탐지. `/tmp/b6-rev114-cas.log`.
- `npm run test:audit-browser`: regression-test.html 167/167·malformed JSON 12개 거절.
- `npm run test:worker`, `npm run test:sets-cloud`, `npm run test:public`, `npm run check:static`,
  `git diff --check` 통과. 리뷰 hygiene: 열린 이슈 4개·INDEX 116/120·최근 5개 일치.

B3/B4/B5 완료, 운영 AI 차단·500문항/900KiB·D1/D3/C1~C3 게이트를 보존했다.
Safari/iPad 장기 보관·실제 AI 품질/비용은 기존 미검증 상태다. B7/U1.5/U2는 시작하지 않았다.
`transcript.txt` 접근/변경/추가, main 병합·push·배포 없음.

## 다음 검토자에게

**Claude Opus 5**: `d7ad822` 이후 114 수정 diff·같은 이슈 처리 기록·위 재현/빨간불을 독립 검토한다.
판정은 HANDOFF-174 또는 이 인계에 남긴다. 합의 후 PR #8 CI 확인 → 해리 승인 merge(운영 배포).
B7은 그 뒤 **Codex GPT-6 Sol high**다. 승인된 112·113/B3/B4/B5 동일 diff를 재검토하지 않는다.

## 검토 기록

독립 재검토 대기.
