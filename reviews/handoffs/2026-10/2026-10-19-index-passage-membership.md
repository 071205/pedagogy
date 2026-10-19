# 변경 인계 — REV-108 ① 지문 묶음 명시 소속과 출력 방어

- ID: `HANDOFF-2026-194`
- 날짜: `2026-10-19`
- 작성자: `Codex GPT-6 Sol / high 구현 · 부모 Codex 통합 검증/인계`
- 상태: `reviewed` — ① Claude Opus 3회차 결함 없음(REV-131~134·D-a/b) · **② 권 버전·Rules 게이트 미구현, 병합 보류**
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

Claude Opus 2회차 지적의 **REV-133 옛 묶음 보완·REV-134 옛 안내 숨김**만
`c2dba2b..PR #23 새 head`로 좁혀 독립 재검토한다. 2회차는 131·132·정상 묶음 133·D-a/b를 확인했지만,
이번 후속 수정은 아직 Claude가 승인하지 않았다.
① 승인과 ② 출시 게이트 완료를 구분하며 이 PR을 운영 완료로 병합하지 않는다.

## 후속 구현과 검증 (2026-10-19 · Codex GPT-6 Sol / high)

- `pedagogy-normalize.js`·`index.html`: 로컬 disk/B3 pending의 옛 관계를 원본 비교값·ID·본문/메타데이터를 보존하며 이관한다.
  raw 관계 변경만으로 `legacy` 경고가 사라지지 않는다. 검증된 묶음의 복제·JSON 삽입은 끝 뒤로 옮긴다.
- `pedagogy-render.js`·`index.html`: 정상 묶음 2→1 뒤 안내를 범위 없이 출력·편집한다.
  미리보기 경고에서 구조가 유효한 `legacy`만 일괄 확인한다(목록·항목 빼기·취소·한 단계 Undo·owner/epoch/권/자료 stale 차단).
  AI 공통지문에 구체적인 지문 블록 이동/묶음 풀기 안내와 한 단계 Undo 단추를 추가했다. 내용 자동 분리는 없다.
- 각 정상 실제 DOM 6경로, 방어 제거 RED 6개, 원본 `1a0fc50` RED 6개가 `npm run test:rev108`에서 exit 0.
  RED 변이를 건너뛰면 `target stayed green`으로 exit 1인 제어 검사를 확인했다.
  기존 지면 회귀는 대표 복제로 손상을 만들던 부분을 명시 손상 주입으로 갱신해 방어 제거 RED를 유지했다.
  로그: `/private/tmp/rev108-followup-2026-10-19/rev108-full-final.log`, `red-control.log`.
- `regression-test.html` 175/175와 JSON/클라우드 경계, `test:intake` 전체 B6/B7 정상·RED,
  `test:u15-storage`, `test:sets-cloud`, `test:set-revision`, `test:public` 통과.
  부모의 로컬 보존 VM probe는 pending 우선·원본 disk 기준·opaque intake·무관한 metadata·601문항/장문 보존을 확인했다.
  부모의 bulk UI probe 5건은 Escape/포커스 복귀·빼기/Undo·자료/epoch/owner stale 거부를 확인했다.
  로그: 같은 폴더의 `parent-audit-final.log`, `parent-intake-final.log`, `parent-u15-storage.log`,
  `parent-sets-cloud.log`, `parent-set-revision.log`, `parent-public.log`, `parent-local-preserve.log`, `parent-bulk-boundaries.log`.
- 최종 `check:static`(접근성 35개 포함)·`check:review-hygiene`(열림 4·INDEX 118/120·최근 5/5)·`git diff --check` 통과.
  로그: `parent-static.log`, `parent-hygiene.log`(같은 폴더).
- CSP 인라인 SHA-256 재계산 후 `check-source-csp` 실패 주입 12/12 통과. 이슈 131·132·133은 구현자 재현 검사로
  `resolved`; Claude 변경분 재검토는 대기다. **② 권 버전/Firestore Rules 게이트는 미구현·미배포**이며
  병합/배포·실제 AI 호출·비밀 변경은 하지 않았다.

미검증: 실제 Google 계정/Firestore 종단 왕복, Safari/iPad, ② Rules 에뮬레이터/운영 배포.
`check:fast` 전체는 이번 후속 범위에서 실행하지 않았다. 선택한 연관 검사의 증거만 위에 기록한다.

## 2회차 지적 후속 보완 (2026-10-19 · Codex GPT-6 Sol / high)

- Claude Opus 클라우드 댓글 `6257247920`은 `1a0fc50..c2dba2b`에서 131·132·정상 묶음 133·D-a/b를
  확인하고, 옛 `legacy` 묶음의 앱 삽입 위치(A)와 독립 문항의 숨은 안내 출력(B)을 새로 재현했다.
  Codex가 기준 `c2dba2b`에서 두 현상을 독립 재현했다. A는 REV-133 처리 기록을 재개했고 B는 REV-134(P3)로 등록했다.
- `pedagogy-normalize.js`: 정상 명시 묶음과 **구조가 유효한 `legacy` 후보**의 중간 삽입을 모두 마지막 구성원 뒤로 보정한다.
  옛 표식과 인쇄 차단은 유지하며 `invalid`·`intake`를 합법화하지 않는다.
- `pedagogy-render.js`: 자기 참조 대표(`groupOf===id`)만 `groupLead`를 출력한다. 구성원 삭제로 2→1이 된 대표는
  안내를 유지한다. 명시 `이 문항만`과 D-b `묶음 풀기`는 소속을 제거하므로 남은 안내 원문을 편집기에 보존하고 출력은 숨긴다.
- `npm run test:rev108` exit 0: 기존 경로와 새 실제 DOM 3경로(옛 묶음 대표 복제·구성원 뒤 JSON·독립 안내),
  각각 방어 제거 RED와 `c2dba2b` 기준 RED 3종. 새 RED 변이 생략 제어는 `target stayed green`으로 예상 exit 1.
  로그: `/private/tmp/rev108-review2-2026-10-19/rev108-second-full.log`, `red-control.log`.
  부모 독립 VM 7경계(정상/옛 후보·invalid/intake·singleton·명시 풀기) exit 0(`parent-boundaries.log`).
- 부모 `regression-test.html` 175/175와 클라우드/JSON 경계(`parent-audit.log`), 공개 CSP 12/12(`parent-public.log`) exit 0.
  최종 `check:static`·`check:review-hygiene`·`git diff --check`도 통과했다(`parent-static.log`, `parent-hygiene.log`).
  이전 head `c2dba2b`의 GitHub verify·cross-platform·hwpx·Sonar 검사는 모두 통과한 것을 확인했다. 새 head의 CI 결과와는 구분한다.
  현재 `index.html` 인라인은 바뀌지 않아 기존 CSP 해시를 유지한다. 이번 2회차 변경은 ① 검토용이며
  **② 권 버전·Rules 게이트 미구현/미배포, PR 병합/운영 적용 보류**다.

미검증: 실제 로그인/Firestore 왕복, Safari/iPad, ② Rules 에뮬레이터/배포. Claude의 3회차 변경분 재검토는 아직 시작됐다고 기록하지 않는다.

## 검토 기록

- `2026-10-19` · 최초 구현/통합 검증 시점: 독립 검토 대기(아래 후속 검토 기록 전).

- `2026-10-19` · **Codex 독립 에이전트 2명 대체 검토**(사용자 승인, Claude 한도 대체) · 판정: **보완 필요**.
  정확 범위 `877a8e7..cd24e61`, 구현 불참 검토자가 저장/ID와 편집/출력을 나누어 읽기 전용 검토했다.
  데이터 검토자: **REV-2026-131(P2)** — 실제 옛 로컬 부팅은 정규화하지 않아, 삭제/무관한 소속 변경 뒤 검토 경고가 지워지고 출력이 허용됨.
  출력 검토자: **REV-2026-132(P2)** — 정상 안내 전용 묶음이 2→1로 줄면 안내 문자열은 남지만 미리보기/조판에서 빠지고 편집 칸도 숨음.
  부모가 두 실제 Chromium UI probe를 동일 head에서 재실행했고, 두 이슈에 담은 이식 가능한 Node 재현도 기대 단언 실패(exit 1)를 확인했다.
  검토자의 추가 경계 15건·실제 저장 함수 5건(클라우드 codec·JSON·충돌 사본 재진입·백업) 통과.
  출력 검토자는 새 UI 정상, UI RED delete/undo/sheet·API RED range/print, 좁은 화면 분기 정상/RED를 독립 확인했다.
  전체 suite는 중복 재실행하지 않았다. 실제 계정/Firestore·Safari/iPad·실제 인쇄/PDF·AI 중복 채택의 별도 브라우저 실행은 미검증.
  즉시 Undo 지연·기본 Ctrl+P의 오래된 printDoc 노출은 기준 main에서도 동일하게 재현되어 신규 이슈에서 제외했다.
  따라서 인쇄 차단 검증은 앱 인쇄 경로에 한정하며 네이티브 Ctrl+P까지 막았다고 주장하지 않는다.
  합의: 신규 확정 2건, 승인 보류. 미합의: 없음. 다음 행동: 131·132 수정/회귀·RED → 독립 재검토; ② 게이트는 별도.
  재현/검토 로그: `/private/tmp/rev108-review-2026-10-19/`의 `parent-legacy.log`, `parent-print.log`, `issue-repro-check.log`, `results.md`.
  이번 후속 변경은 이슈/인계/레일 기록이며 기능 수정·병합·배포는 하지 않았다.

- `2026-10-19` · **Claude Opus 클라우드 1회차 검토** · 판정: 보완 필요.
  PR #23 댓글 `6257002399`에서 REV-131·132를 재확인하고 새 REV-133을 실제 UI에서 재현했다.
  해리 결정 댓글 `6257030716`이 D-a·D-b를 같은 PR 범위로 추가했다. Codex는 위 후속 구현/검증을 완료했으며,
  Claude Opus의 **변경분 재검토 판정은 아직 없다**. ②·병합/배포는 보류한다.

- `2026-10-19` · **Claude Opus 클라우드 2회차 검토** · 판정: 작은 2건 보완 필요.
  PR #23 댓글 `6257247920`, 범위 `1a0fc50..c2dba2b`. 131·132·정상 133·D-a/b는 확인,
  REV-133 옛 묶음 삽입 누락과 REV-134 독립 문항 안내 부활을 재현했다.
  Codex가 위 두 건을 수정/검증했다. 다음 Claude 검토는 이번 좁은 변경분이며 아직 판정이 없다.
- `2026-10-19` · **Claude Opus 클라우드 3회차(변경분 `c2dba2b..5f3e65e`)** · 판정: **결함 없음 · ① 승인**.
  구현 불참. 합성 자료로 재현: 구조가 맞는 옛 묶음 대표 복제 위치 `1`→`3`(진단은 `옛 묶음 소속 검토 필요` 하나 유지 · 일괄 후보 1 유지) ·
  잘린 옛 묶음(`invalid`)과 `intake` 는 위치를 밀지 않고 일괄 후보 0 · 묶음 아닌 문항의 남은 안내는 출력 `""`·값 보존(REV-134) ·
  2→1 자기 참조 대표 안내 출력 유지(REV-132) · 명시 묶음 풀기는 출력만 숨기고 값 보존 · 옛 안내 전용 묶음은 범위 머리와 함께 보임.
  `npm run test:rev108` exit 0(PASS 40 · RED/BASELINE 19 기대 실패) · `check:static` 통과. 실제 로그인·Safari/iPad·`check:fast` 전체는 미실행.
  합의: ① 결함 없음. 미합의: 없음. 다음: **② 권 버전 표식 + Rules 쓰기 게이트(Codex Sol high) → 검토 → Rules 배포(로컬) → 병합**. ①만으로 병합하지 않는다.
