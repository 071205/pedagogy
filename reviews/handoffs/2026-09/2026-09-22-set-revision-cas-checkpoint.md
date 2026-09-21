# 변경 인계 — R4/B3 revision CAS 코드 체크포인트

- ID: `HANDOFF-2026-161`
- 날짜: `2026-09-22`
- 작성자: `Codex / Sol high`
- 상태: `ready-for-review`
- 영향 영역: `index | rules | tests`
- 관련 이슈: `REV-2026-103`
- 구현 커밋: `2a24205`

## 변경 내용

`firestore.rules`를 구 문서와 revision 1 승격을 함께 받는 전환 규칙으로 만들고,
`service-config.js`의 `setRevisionSchema:0` 뒤에 문서별 transaction CAS를 구현했다.
신규 1, 수정·재정렬·tombstone +1, stale base 충돌 보존, listener/초기 병합의 시각 판정 제거,
부분 성공 ACK를 다룬다. ACK 뒤 서버에서 사라진 문서는 revision 1로 되살리지 않는다.

REV-103은 Firestore 비허용 중첩 배열을 문서별로 격리하고 paired `cells`를 전송 경계에서만
`cellsFlat`으로 왕복해 해결했다. 화면·내보내기 모델은 바꾸지 않았다.

## 위험과 검토 요청

- `2a24205^..2a24205`만 읽고 CAS 기준 전진, 충돌 시 양쪽 보존, 혼합 성공 ACK, tombstone/Undo,
  owner·listener·초기 병합을 확인한다.
- 전환 Rules → 플래그 1 클라이언트 → 엄격 Rules 순서를 건너뛰지 않는다.
- 현재는 **코드 체크포인트일 뿐 배포 완료가 아니다**. 플래그 0이고 운영 배포는 하지 않았다.

## 검증

- `test:set-revision`: 16/16 통과, B3 이전 `4ea6fa7`에서 16/16 실패 주입 확인.
- `test:sets-cloud`: 10/10 통과, 방어 이전 `33af005`에서 7건 실패 확인.
- `test:set-sync-meta`: 9/9 통과, B2 이전에서 7건 실패 확인.
- `check:rules`: OpenJDK 21로 통과. `test:audit-browser` 158/158, `test:public`, `check:static`,
  `test:review-contracts`, `test:library-ui` 통과.
- 실제 Firebase 배포·플래그 1 활성화·엄격 Rules 배포는 실행하지 않았다.

## 다음 검토자에게

Claude Opus 5가 비구현자로 독립 검토한다. 저장소 래퍼 `scripts/ask-claude-readonly.mjs`만
foreground로 쓰되 현재 `claude auth status`는 `loggedIn:false`였다. 로그인 후 한 번만 호출하고,
문제가 없으면 이 파일 검토 기록에 한 줄 추가한다. 재현 결함만 같은 범위 이슈로 등록한다.
검토 전 R4.5·배포를 시작하지 않는다.

## 검토 기록

- `2026-09-22` — Claude Code CLI 로그아웃으로 독립 검토 대기. 앱 미러링 호출은 사용하지 않음.
