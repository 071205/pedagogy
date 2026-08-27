# 변경 인계 — 초기 감사 4건 해결

- ID: `HANDOFF-2026-002`
- 날짜: `2026-08-27`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | worker | tests | docs`
- 관련 이슈: `REV-2026-001`, `REV-2026-002`, `REV-2026-003`, `REV-2026-004`

## 변경 내용

1. 계정 삭제는 Storage 이미지 목록 조회·개별 파일 삭제·사용자 Firestore 문서 삭제가 모두
   성공한 뒤에만 Auth 계정을 지운다. 문제집 전체 삭제에서 남은 이미지는 성공으로 숨기지 않고
   사용자에게 알린다.
2. AI 일일 한도는 Cloudflare KV의 분리된 읽기/쓰기를 없애고, uid+UTC 날짜별 Durable Object의
   원자적 예약·확정·해제로 교체했다. Wrangler 진입점과 대시보드용 단일 파일을 같은 구현으로
   맞췄다.
3. 클라우드 동기화 비교에 과목과 선 색을 포함하고, 서버 문서의 `order`까지 보관·비교해
   설정 및 카드 순서를 다른 기기에 반영한다.
4. tombstone만 받은 정상 클라우드 읽기는 빈 배열도 권위 있는 결과로 처리해 오래된 로컬
   문제집을 fallback으로 되살리지 않는다.

## 검증

- 브라우저 회귀: `python3 serve.py --port 8799` 후 `regression-test.html` 실행,
  `82 / 82 통과`.
- Worker quota 단위 검사: `node worker/quota.test.mjs` 통과.
- 정적 검사: `git diff --check` 및 `serve.py` Python 컴파일 검사 통과.
- 실제 Firebase 계정·Storage 삭제와 운영 Worker 배포는 사용자 데이터·비용에 영향을 주므로
  실행하지 않았다.

## 배포·다음 검토

`worker/index.js`, `worker/worker-single-file.js`, `worker/wrangler.toml`의 Durable Object
변경은 운영 반영 전에 `cd worker && npx wrangler deploy`로 배포해야 한다. Cloudflare
대시보드에 단일 파일을 붙여넣는 방식으로 운영한다면 같은 바인딩·migration 설정을 먼저
적용해야 한다. 이 작업은 외부 상태를 바꾸므로 별도 승인 후 실행한다. 실제 계정 삭제를
검증할 때는 운영 계정이 아닌 별도 Firebase 테스트 계정과 테스트 Storage 경로만 사용한다.
