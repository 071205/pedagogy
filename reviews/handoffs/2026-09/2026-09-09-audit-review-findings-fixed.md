# 변경 인계 — 감사 수정 후속 검토 3건 해결

- ID: `HANDOFF-2026-069`
- 날짜: `2026-09-09`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 관련 검토: `HANDOFF-2026-068`
- 관련 이슈: `REV-2026-040`~`REV-2026-042`

## 수정

- `sessionContext`·`sessionMatches`를 실제 제품 `function` 선언으로 만들고,
  안전 검사가 그 선언을 제품 소스에서 추출해 실행하게 바꿨다.
- 이미 편집 이력에 붙은 이미지 URL은 계속 보존하지만, 업로드 도중 블록 종류가 바뀌어
  어느 상태에도 붙지 못한 URL은 `attached:false`로 즉시 삭제한다.
- `keepId`, `maxProblems`, `lossless`를 독립 옵션으로 분리했다. 자기 클라우드/백업은
  `lossless:true`를 명시하며 외부 가져오기는 500개 상한을 유지한다. 죽은 상수·함수도 제거했다.

## 검증

- `node scripts/check-audit-safety.mjs`: 11/11 통과.
- 임시 사본에서 제품 `sessionMatches`를 `true`로 바꾸면 032의 A→B/A→B→A 검사가
  모두 `writes.length 1 !== 0`으로 실패했다.
- 실제 releaseImage fixture: attached URL 삭제 0회, orphan URL 삭제 1회.
- 실제 옵션 fixture: keepId+maxProblems=10은 10개, keepId=1도 10개,
  lossless만 12개/51블록/20,001자를 보존.
- `npm run test:worker`, `npm run check:static`, `npm run test:audit-browser` 실행.

제품 배포·푸시·운영 Storage 변경은 하지 않았다.
