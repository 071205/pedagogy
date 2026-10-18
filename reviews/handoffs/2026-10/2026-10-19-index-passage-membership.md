# 변경 인계 — REV-108 ① 지문 묶음 명시 소속과 출력 방어

- ID: `HANDOFF-2026-194`
- 날짜: `2026-10-19`
- 작성자: `Codex GPT-6 Sol / high 구현 · 부모 Codex 통합 검증/인계`
- 상태: `ready-for-review`
- 영향 영역: `index | tests | docs`
- 관련 이슈: `REV-2026-108` (`in-progress`, ② 출시 게이트 미완료)
- 브랜치: `codex/rev108-explicit-groups`
- 기준: `main 877a8e7` (PR #16 병합), 선행 판정 `0cc9945`

## 변경 내용

위치로 지문 묶음을 추론하면 구성원 삭제 때 무관한 다음 문항을 흡수했다. `groupOf`로 대표 ID를 저장하고
권 전체에서 ID를 재매핑·검증한다. `groupSpan`은 파생값이다. API·자료 이관·동작 정책의 영구 기록은
[REV108-PASSAGE-GROUPS](../../../docs/REV108-PASSAGE-GROUPS.md)에 둔다.

- `pedagogy-normalize.js`: 권 단위 정규화/ID 재매핑, 유효 관계·오류 진단, 명시 재구성/삭제/전체 이동 API.
  옛 위치 모델·깨진 명시 소속·모호한 ID·AI 공통지문에 영속 검토 표식을 남긴다.
- `index.html`: 삭제·복제·정렬·붙여넣기와 Undo, 권/충돌 사본 복제에 연결. 권 메타데이터/폴더는 보존한다.
  꼬리 문항 단독 복제와 구성원이 남은 대표 삭제는 차단한다. 고아/검토 필요 대표는 선택 칸에서 명시 재구성한다.
- `pedagogy-print.js`: 검증된 ID 관계만 범위로 표시한다. 본문 미리보기에 진단, 실제 조판/인쇄에 차단을 둔다.
  지면 오류 때 이전 페이지/축소판을 비운다. 조판 함수 자체에서도 검사해 인쇄 준비 중 변경을 놓치지 않게 한다.
- `pedagogy-intake.js`: 기존 채택 원장의 그룹을 명시 소속으로 옮기고 `groupReview:'intake'`를 남긴다.
  현재 AI 계약은 첫 statement에 지문과 본문을 섞어 주므로 추측해 분리하지 않고 사람이 확인하기 전 출력을 막는다.
- `scripts/check-rev108*.mjs`: 실제 UI 5경로와 공통 API/조판 경계 4개, 방어 제거 RED, 기준 main 원결함 RED.
  `test:rev108`을 `check:fast`에 연결했다. 기준 fixture 두 개에는 정상 명시 소속을 추가했고 옛 형식 검사는 별도로 유지한다.
- 부모 마무리: Sol high 사용량 한도 종료 후 테스트 RED의 거짓 성공 방어/추가 확인, 기존 설명 주석 복원과 문서·PR 정리를 맡았다.
  제품 구현에 대한 Claude 독립 승인을 받은 것으로 표시하지 않는다.

## 위험과 검토 요청 — Claude Opus (클라우드)

범위는 `877a8e7..codex/rev108-explicit-groups`. 스키마·편집·저장·출력의 연결 변경이므로 해당 호출부까지 확인한다.

1. 권 단위 ID 대응·중복/고아/겹침/잘린 가져오기가 위치 모델로 조용히 정상화되지 않는가?
   옛/AI 검토 표식과 본문이 JSON·백업·클라우드 정규화 뒤에도 보존되는가?
2. 실제 삭제/Undo·복제/붙여넣기/재정렬·충돌 사본의 배열·ID·지문·소속이 같은 스냅샷인가?
   미리보기/실제 조판/인쇄 차단과 이전 지면 정리가 같은 관계를 판단하는가?

전체 묶음 권간 이동은 공통 API만 제공한다. U2의 이동 UI·부분 분리 UI·저장/원문 연결 확정은 만들지 않았다.
**② 권 버전 표식 + Firestore Rules 쓰기 게이트는 미구현/미배포**다. 구형 클라이언트가 새 소속 필드를 지우고 다음 revision을
쓸 수 있으므로 **① 검토용 draft PR이며 main 병합/운영 적용 보류**. ② 검토·승인된 배포 전에는 안전한 왕복/전체 해결로 닫지 않는다.
Rules·Worker·Pages 배포, 실제 AI 공급자 호출, 비밀정보 변경은 하지 않았다.

## 검증

로그는 `/private/tmp/rev108-2026-10-19/`에 보존했다. FAIL 문자열이 있어도 RED가 기대한 실패이면 정상 종료하며, 실제 정상 검사와 구분한다.

| 검사 | 결과·범위 | 로그 |
| --- | --- | --- |
| `npm run test:rev108` | 통과(exit 0). UI 5개+API/조판 4개 정상, 방어 제거 9종+기준 main 원결함 1종 RED. 실제 P2 삭제 후 미리보기/조판 `01~02`, Q4 독립, Undo/Redo 복원 | `rev108-parent-final.log` |
| RED 자체 검증 | 변이를 생략한 `REV108_UI_RED=sheet REV108_SKIP_MUTATION=1`은 `UI target stayed green`으로 exit 1. 자가 throw를 성공으로 삼지 않음 | `rev108-red-selfcheck.log` |
| `npm run test:audit-browser` | 최종 175/175 통과, 클라우드 정규화 보존·잘못된 JSON 루트 12개 거절, exit 0 | `audit-parent-final.log` |
| `npm run test:intake` | 전체 정상/기존 B6·B7 RED 통과. AI 소속·검토 표식/왕복 추가 단정 포함 | `intake-final.log` |
| `npm run test:u15-storage` | 정상 12/12 및 node/브라우저 기존 RED 통과 | `u15-storage.log` |
| `test:sets-cloud` / `test:set-revision` | 900KiB·초과 보존, revision/CAS 기존 검사 및 RED 통과 | `sets-cloud.log`, `set-revision.log` |
| `test:library-ui` / `test:fixtures` | 폴더/복제/Undo UI와 기준 fixture 통과 | `library-ui.log`, `fixtures.log` |
| `test:sheet-source` | 정상 16/16, RED 17종을 원 실행 14종+마지막 3종 선택 실행으로 모두 확인 | `sheet-source.log`, `sheet-source-red-tail.log` |
| `test:sheet` | 정상 17/17·300문항/150쪽 통과. RED 14/14를 원 실행 11종+꼬리 2종+마지막 1종 선택 실행으로 모두 확인(최종 선택 실행 exit 0, 74초) | `sheet.log`, `sheet-red-tail.log`, `sheet-last-final.log` |
| `test:worker` / `test:review-contracts` | 모두 통과, exit 0 | `worker-final.log`, `review-contracts-final.log` |
| `HWPX_PYTHON=<bundled Python> HWPX_REQUIRE=1 npm run test:hwpx` | 12건 통과, exit 0. 기본 Python의 lxml 부재로 건너뛴 첫 실행은 통과로 세지 않음 | `hwpx-final.log`, `hwpx-bundled-final.log` |
| `test:public` | CSP 해시·실패 주입 12/12 거절, 공개 빌드 재현/비공개 유출 방어 통과, exit 0 | `public-final.log` |
| `check:static` / `check:review-hygiene` / `check:sonar` / `git diff --check` | 통과, exit 0 / diff 오류 없음 | `static-final.log` |

지면 전체 RED 실행과 꼬리 선택 실행은 마지막 ‘좁은 화면 탭 전환 방어 제거’에서 관련 없는 넓은 화면 조립을 기다리며 완료되지 않았다.
기존 하네스가 변이 대상 전에 조립을 기다리는 문제를 부모가 확인해 좁은 탭 검사 공통 함수를 추출했다. 해당 변이만 그 경로를
직접 검사하도록 했으며, 정상 경로/나머지 변이의 검사 본문과 기준은 유지한다. 수정 후 정상 17개·300문항과 마지막 변이의 실제 실패를 확인했고 선택 실행은 exit 0으로 끝났다.
기존 두 실행의 중간 로그를 전체 exit 0/RED 14종 완료로 세지 않는다.

미실행/미검증: `check:fast` 전체·실제 Google 로그인·Safari/iPad·Rules 게이트/에뮬레이터(② 미구현).
현재 브라우저 검사는 Chromium·합성 계정/원문 fixture다. 실제 서버의 구형 편집기 거부나 ② 출시 조건까지 증명하지 않는다.
기존 CAS/충돌 검사의 통과와 새 그룹 단위 정규화/복제를 별도로 확인했으며, 그룹을 포함한 실제 계정 간 기기 왕복은 검증하지 않았다.

## U1.5 운영 및 HANDOFF-188

- PR #14·#15·#16 모두 병합, main `877a8e7`, Pages `built`.
- main의 PUBLIC_INPUTS와 PDF 자산 목록 **225/225 파일**을 운영 URL에서 받아 바이트/SHA-256 일치 확인.
  `production-comparison.json`에는 각 파일의 크기/해시·기준 ref·확인 시각이 있다.
- 운영 Chrome 탭은 열었다. CUA의 writable-root 심볼릭 링크 초기화 오류와 Chrome Apple Events JavaScript 비활성으로
  로그인 상태/실제 원본 패널은 확인하지 못했다. 브라우저 설정은 바꾸지 않았다.
- HANDOFF-188 상태 한 줄은 그 파일이 있는 로컬 `claude/u15-source-panel` 브랜치에 **`02f6c47`**로 커밋했다.
  main에는 해당 파일이 없어 한글 연구 변경 전체를 이 PR에 가져오지 않았다. 이 별도 로컬 커밋은 푸시하지 않았다.

## 다음 검토자에게

클라우드 Claude Opus가 위 범위를 독립 검토하고 이 파일의 검토 기록에 판정을 남긴다.
재현 결함은 같은 이슈 처리 규약을 따르며, ① 승인과 ② 출시 게이트 완료를 구분한다. 이 PR을 운영 완료로 병합하지 않는다.

## 검토 기록

- `2026-10-19` · 구현/통합 검증 완료, 독립 검토 대기. Claude Opus 판정은 아직 없음.
