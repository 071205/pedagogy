# B3 엄격 Rules 실제 배포

- ID: `HANDOFF-2026-170`
- 날짜: `2026-09-25`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `rules`, `tests`, `docs`
- 관련 이슈: `REV-2026-109`, `REV-2026-111`(이미 해결), `REV-2026-110`(이번 검사 정리)

## 변경 내용

사용자가 구 탭을 다른 기기 새로고침으로 정리했고 별도 안내 없이 적용하도록 결정했다.
공개 `setRevisionSchema:1`을 다시 확인한 뒤 후보 `d5f6d78`의 엄격 `firestore.rules`를
`pedagogy-huryul`에 `firebase deploy --only firestore:rules`로 적용했다. Firebase가 컴파일,
업로드, 릴리스 완료를 반환했다. 배포 파일 SHA-256은
`ef1c8e02304d6a94470f761c37a2f986b4d9424df0014b245b54873f5859479a`다.
로컬 `main`의 규칙과 검사도 그 배포본으로 맞췄다. 새 문제집은 revision 1, 기존 무 revision
문서는 revision 1 승격, 이후 수정·tombstone은 정확히 +1만 허용한다.

## 위험과 검토 요청

구형 무 revision 클라이언트의 신규/수정 쓰기는 운영에서 거부된다. 사용자가 구 탭 정리를
확인했다. 승격된 문서는 전환 Rules로 단순 롤백해도 이전 상태가 되지 않는다(`HANDOFF-168`).
`firestore.rules`와 `scripts/verify-rules-emulator.mjs`·`verify-b3-strict-rules.mjs`를 배포
바이트 및 §2-4 계약과 대조해 달라. 최종 독립 검토 전 B3 완료 선언은 보류한다.

## 검증

- 에뮬레이터: 기존 Firestore/Storage 계약 검사 통과; 엄격 Rules 표적 11개 사례 통과.
  전환 Rules로 바꾼 고장 주입은 엄격 거절 사례에서 실패했다.
- 운영: 공개 `service-config.js`의 플래그 1 확인. 로그인 계정에서 검증 문제집 생성·이름
  변경 뒤 새로고침해 유지됨을 확인했고 브라우저 오류 로그가 없었다. 검증용 문제집
  `B3 엄격 규칙 운영 검증 — 삭제 가능` 한 권은 현재 계정에 남겼다.
- `REV-2026-110`: `test:review-contracts` 23건 통과; 운영 플래그 상속 고장 주입 시 원래
  4건 실패. 이슈 파일에 해결 근거를 기록했다.
- `tests/regression-test.html`은 B5의 inline CSP 재해시 뒤 165/165 통과.
- `npm run check:fast` 종료 코드 0. 검사 로그의 일부 `FAIL`은 패키지에 포함된 의도적
  고장 주입 실행에서 나온 것이며 기본 실행은 통과했다.

## 다음 검토자에게

Rules의 owner·스키마 제한이 달라지지 않았는지, legacy 승격과 +1·tombstone·구형 거절이
실제 운영 순서와 맞는지 독립 확인해 달라. Auth 저장은 UI에서 확인했으나 Firestore 서버의
revision 값을 관리자 API로 직접 읽지는 않았다. `transcript.txt`는 건드리지 않았다.

## 검토 기록

독립 검토 대기. 로컬 `claude auth status`는 `loggedIn:false`여서 Opus 5 호출을 하지 않았다.
