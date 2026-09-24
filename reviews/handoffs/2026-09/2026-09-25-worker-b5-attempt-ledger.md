# B5 AI 시도 원장 구현

- ID: `HANDOFF-2026-171`
- 날짜: `2026-09-25`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `worker`, `index`, `tests`, `docs`
- 관련 이슈: `REV-2026-110`(검사 하네스 정리)

## 변경 내용

`worker/attempt-ledger.js`에 날짜와 무관한 사용자별 `AttemptLedger` DO를 구현했다. 서버가
인증 UID, 실제 전송 이미지 해시, 현재 공급자/모델/추출 프롬프트, job/쪽, attempt ID를
비밀 HMAC으로 묶는다. `pending` 10분, `completed` 7일을 개별 만료하고 가장 이른 항목에
alarm을 다시 건다. 중복·성공 잠금은 quota 예약과 공급자 호출 전에 거부하며, 실패 후에는
새 attempt ID와 명시 retry만 허용한다. 기존 단일 이미지/문서 요청은 그대로 둔다.

재인증된 계정 삭제의 마지막 단계에서 `DELETE /account/ledger`로 원장을 파기하고 7일
삭제 울타리를 남긴다. `DailyQuota`는 초기화하지 않는다. Worker 운영·staging config에
별도 바인딩과 SQLite `v2` migration을 준비했다. **Secret 등록, migration, Worker,
Pages 모두 실제 배포하지 않았다.** 배포 시 `ATTEMPT_HMAC_KEY`(32자 이상)를 먼저 넣고
Worker를 Pages보다 먼저 적용해야 계정 삭제가 중단되지 않는다. 버전/비밀은 7일 보존
기간에 회전하지 않는다.

## 위험과 검토 요청

중복 유료 호출 방지는 같은 job·쪽·전송 이미지·추출 계약의 재호출에 한정된다. 공급자
응답을 받았으나 원장 완료 기록이 실패하면 내용은 재전송하지 않고 pending 만료 뒤 사용자
명시 재시도가 가능하다. exactly-once 보장은 하지 않는다. 성공 결과 본문은 Worker에
보관하지 않고 HMAC 체크섬만 남긴다. 계정 데이터 삭제 뒤 원장 파기 또는 Auth 삭제가
실패하면 계정은 남아 재시도가 가능하나 앞선 데이터 삭제는 되돌리지 못할 수 있다.
`attempt-ledger.js`, `worker/index.js`, 삭제 순서와 DO migration을 중점 검토해 달라.

## 검증

- `npm run test:worker` 통과: 자정·동시 중복·응답 유실·실패 후 명시 재시도·항목별
  alarm·비밀 HMAC·계정 삭제/최근 재인증·quota 분리와 기존 Worker 경로.
- `ATTEMPT_LEDGER_RED=1 node worker/attempt-ledger.test.mjs`는 중복을 통과시키는
  고장 주입에서 예상대로 200≠409로 실패했다.
- `node scripts/check-source-csp.mjs` 통과, 로컬 `serve.py`의
  `tests/regression-test.html` 165/165 통과. Worker 운영·staging Wrangler `--dry-run`
  모두 `ATTEMPT_LEDGER (AttemptLedger)` 바인딩을 묶어 빌드했다.
- `npm run test:review-contracts` 23건 통과, 플래그 상속 고장 주입 4건 실패.
- `npm run check:fast` 종료 코드 0. U0 시안 HTML을 Sonar 운영 코드 범위에서 제외해
  기존 검사 경로를 복구했다.
- 실제 공급자 호출·Worker/Pages 배포·계정 삭제 실데이터 테스트는 하지 않았다.

## 다음 검토자에게

저장 계약 §3-2·3-3과 `docs/RAIL-ORDERS.md` ⑨/⑩을 기준으로 독립 검토해 달라.
Claude Opus 5는 로컬 미로그인(`claude auth status` → `loggedIn:false`)으로 호출하지 못했다.
B6는 이 검토와 U0의 D2/D4·한도 적용 경계가 끝나야 시작한다. `transcript.txt`는
건드리지 않았다.

## 검토 기록

독립 검토 대기.
