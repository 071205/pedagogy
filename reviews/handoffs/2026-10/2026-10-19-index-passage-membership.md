# 변경 인계 — REV-108 ① 명시 소속과 ② 권 버전 쓰기 게이트

- ID: `HANDOFF-2026-194`
- 날짜: `2026-10-19`(①) · `2026-10-20~21`(②)
- 작성자: `Codex GPT-6 Sol / high 구현 · 부모 Codex 통합 검증/인계`
- 상태: `reviewed` — ①·② Claude Opus 독립 검토 결함 없음(135·136 포함). `3335d15` CI·로컬 Rules 정상/RED 통과. **Rules·PR #23 병합/Pages·main CI 완료. 실제 Chrome 테스트 권 저장/재진입·명시 소속·PDF·운영 무표식 쓰기 거절 확인. REV-108은 `resolved`; 별도 출력 결함 REV-137은 `in-progress`(HANDOFF-195)**
- 영향 영역: `index | normalize | render | firestore.rules | tests | docs`
- 관련 이슈: `REV-2026-108` (`resolved`, 2026-10-22 운영 확인)
- 브랜치: `codex/rev108-explicit-groups`
- 기준: `main 877a8e7` (PR #16 병합), 선행 판정 `0cc9945`

## ① 최초 인계 (2026-10-19 · 아래는 당시 상태)

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

## ② 권 버전·Rules 쓰기 게이트 인계 (2026-10-20 · Codex GPT-6 Sol / high)

**범위와 상태.** 기준 head `ad5fe91` 이후의 ② 구현이다. ①에 대한 Claude Opus 3회차 승인과 구분한다. 이번 ②는 `ready-for-review`다. Claude 전반 정적 검토 후 135·136을 추가 수정했고, 후속 Claude 호출은 시간 초과로 미완료다. 추가 수정은 Codex 독립 확인에서 결함 미발견이며 실제 Google 계정 왕복·Rules/Pages 운영 배포·main 병합은 아직 없다. 영구 계약은 [REV108-PASSAGE-GROUPS](../../../docs/REV108-PASSAGE-GROUPS.md)의 ② 절이다.

- `firestore.rules`: 모든 새 권/다음 revision/tombstone에 정수 `setSchemaVersion:1`을 요구하고, 기존 미래·손상 표식 문서를 지원 버전으로 덮어쓰지 못하게 한다. 무표식 옛 문서의 **지원 버전 다음 revision**은 허용한다. Rules는 권 최상위만 검증하며 문항 배열 속 소속을 재귀 검사하지 않는다. owner, CAS, 크기, 계정 영구 삭제 경계는 유지한다.
- `index.html`·`pedagogy-normalize.js`·`pedagogy-render.js`: 새 권·복제·충돌 사본·삭제 표식에 v1을 붙인다. 무표식 옛 문서는 원래 ID·본문·무관한 필드·`legacy` 검토를 보존하고 다음 revision에서 승격한다. 동등 본문 ACK가 승격을 생략하지 않으며, ACK 후 로컬 표식·영속 CAS 기준을 맞춰 재예약하지 않는다. `setJSON`은 표식이 실제 있을 때만 포함해 이전 지문을 유지한다. 미래·손상 버전은 알 수 없는 필드와 비배열 `problems`도 원형 보존하고 목록/백업/내보내기에서 읽기 전용이다. 로컬 초안과 미래 서버 자료가 충돌하면 자동 최신본 채택·서버 기준 선택·tombstone을 막되 다른 정상 권은 계속 저장한다. JSON 두 가져오기 경로는 자료 변경 전에 미래 버전을 거절한다. 옛 `users/{uid}.sets` 일괄 이관은 첫 쓰기 전에 모든 권의 버전을 검사한다. B6 문서 크기 예측은 다음 revision과 표식까지 포함한다.
- `scripts/check-set-schema.mjs`와 `scripts/verify-set-schema-rules.mjs`를 `test:set-schema`/`check:rules`에 연결하고 새 검사도 `check:fast`에 연결했다. 기존 B3 Rules 유효 fixture, B6 114 ACK fixture, `regression-test.html` 클라우드 표식 기대값, CAS/900KiB fixture를 표식 의미에 맞춰 갱신했다. 기존 보안·owner·epoch·intake 쓰기 보류와 ① 출력 계약은 변경하지 않았다.
- **후속 재현 수정:** 최종 읽기 검토 시작 직후 미래 권의 `problems:{}`를 로컬에 다시 쓸 때 `writeLocalNow()`가 `false`를 반환하는 점을 실제 브라우저 검사에서 재현했다. 알 수 없는 스키마의 문항 배열을 순회하지 않고 원형 JSON을 저장하도록 최소 수정했다. `index.html`의 이 추가 diff는 검토 시작 뒤 작성됐으므로 초기 Claude 읽기 범위의 승인으로 간주하지 않는다. 검사: 로컬 미래 권 읽기 전용·저장·원형 왕복 정상 9/9, 부모 독립 VM의 미래 권 저장/반복 저장·동일 배열 정상 intake 편집 판정 2건 통과(`parent-local-opaque.log`).

**실행 근거.** 로그 기준 `/private/tmp/rev108-schema-2026-10-20/`.

| 검사 | 결과 |
| --- | --- |
| `npm run test:set-schema` | 정상 Chromium 9/9 exit 0(`schema-browser-final.log`). 표식 생성·옛 무표식 동일 본문 승격·미래 서버 update/tombstone/충돌 선택 차단·불투명 권 로컬/백업/JSON 보존·ACK 영속 CAS·미래 snapshot 보류·JSON 가져오기 사전 거절·900KiB 예측. 표식 제거 변이 RED 3개, 원본 `ad5fe91` RED 4개 표적 실패 후 suite exit 0. `SET_SCHEMA_SKIP_MUTATION=1`은 `target stayed green`으로 예상 exit 1. |
| OpenJDK 21 + `npm run check:rules` | Firestore/Storage 실제 emulator에서 기존 Rules·B3 11경계와 새 v1/무표식·미래/손상 행렬 exit 0(`check-rules-final.log`). 새 기존-resource guard 제거 RED는 미래 문서가 실제 v1 revision 8로 다운그레이드됨을 읽어서 증명. `ad5fe91` Rules RED는 무표식 정상 create/next revision/tombstone 3건이 실제 허용됨을 증명. 변이 생략 제어는 서버 `PERMISSION_DENIED`, 예상 exit 1로 별도 확인. |
| ①·저장·기존 경계 | `test:rev108` 정상·RED exit 0, `test:set-revision` CAS 35+기준 RED exit 0, `test:sets-cloud` 정상·RED exit 0. 부모 `test:intake` B6/B7 정상·RED 전체 exit 0, U1.5 저장 정상·RED exit 0(`parent-intake-final.log`, `parent-u15-final.log`, `parent-cas-final.log`, `parent-size-final.log`). 초기 intake114의 ACK 뒤 표식 추가에 따른 기대값 3건만 실패했고 fixture 수정 뒤 정상 11/11+기존 RED 표적 7건 exit 0으로 재검증했다. |
| 브라우저·공개 CSP | `test:audit-browser` 175/175 + 잘못된 JSON 12개 거절 exit 0. 초기 2건은 기존 probe/허용 필드 기대 목록의 v1 표식 누락이어서 갱신 뒤 재실행했다. `check-source-csp` 인라인/법적 스타일 해시 및 실패 주입 12/12 exit 0. 부모 `test:public`·U1.5 저장 전체 exit 0(`parent-public-final.log`, `parent-u15-final.log`). |

**설계 검토 경계.** 부모가 `ask-claude-readonly.mjs`로 받은 설계 점검은 ② 최종 승인 **아니다**(`/private/tmp/rev108-schema-2026-10-20/design-review.md`). 제한된 읽기 도구 때문에 고정된 `ad5fe91` 소스 대신 당시 작업 트리를 읽었다. 제기된 ACK 반복 예약/영속 CAS, 미래 권 전체 삭제, 900KiB 실제 문서 크기, 비배열 미래 권은 구현과 위 검사로 대조했다. 제안된 Rules→Pages→soak→strict의 별도 4단계 운영 순서는 기존 레일의 병합 보류 판정과 다르므로 채택하지 않았다. 엄격 Rules를 먼저 적용하면 구형 Pages 쓰기가 차단되고, Pages를 먼저 적용하면 구형 탭 무표식 쓰기가 남는다. `service-config.js`의 `setRevisionSchema:1`을 확인했고, 독립 변경분 승인 뒤 운영자가 쓰기 중단 창과 배포 순서를 확정해야 한다. 계정 전체 영구 삭제는 명시적 개인정보 삭제 경로로 남기고, 일반 묶음 삭제는 미래 권을 사전 차단한다.

**다음 행동/미검증.** 아래 후속 기록대로 추가 수정의 독립 Codex 확인과 Claude 재검토 결과를 남긴다. PR #23의 ① 승인과 섞지 않는다. 실제 Google 로그인/Firestore 종단 왕복, 구형 배포 클라이언트의 실제 거절, Safari/iPad, 운영 Rules·Pages 및 쓰기 중단 창, Worker와 AI 실호출은 미실행이다. 코드/Rules/Pages/Worker 배포, 비밀 변경, main 병합도 하지 않았다. 검토·운영 전환 증거가 모일 때까지 REV-108은 `in-progress`다.

### ② 추가 보완·회귀 (2026-10-21 · Codex 확인 완료, Claude 후속 미완료)

- 부모의 실제 VM 재현으로 [REV-135](../../issues/2026-10/2026-10-20-index-future-set-selected-export.md): 미래 권 선택 내보내기에서 `folderId` 원문이 빠짐, [REV-136](../../issues/2026-10/2026-10-20-index-future-set-intake-shape-crash.md): 미래 권의 비배열 `problems`를 intake `.some()`에 넘겨 저장 상태/transaction이 예외로 중단됨을 확인했다. 두 이슈는 재현·수정·정상/RED 근거를 같은 파일에 기록해 `resolved`로 닫았다. **② 전체 승인/배포와는 별개**다.
- `index.html`: 미지원 권만 선택 내보내기에서 원형 복제해 `folderId`를 보존한다(정상 권은 기존 폴더 제외). `intakeNeedsUpdate()` 래퍼는 미지원 권을 배열 검사에 넘기지 않고 별도 schema guard에 맡긴다. 지원 v1/무표식 권의 미래 intake 보류는 유지한다. 최종 인라인 CSP를 다시 동기화했다.
- 실제 Chromium `test:set-schema`는 **14/14 정상**, 기존 표식 변이·새 `bulk-local`/`bulk-remote`/`account`/`export`/`future-intake` 변이·`ad5fe91` 기준 원본 RED 모두 exit 0(`/private/tmp/rev108-schema-2026-10-20/schema-browser-14-final.log`). 새 변이마다 대상 함수에서 실패하고, 변이를 생략한 5개 제어 실행은 정상 14/14 뒤 `target stayed green` 예상 exit 1이다. 일괄 삭제는 로컬 미래 권을 백업/원문 변경 전에 중단하고, 원격 미래 권이 뒤에 있어도 첫 정상 tombstone 전에 preflight하여 서버/로컬을 보존한다. 실제 `deleteAccountEverything()`은 본인 확인 모형 뒤 `cloudSetDocIds()`→`wipeCloudSets(realDelete:true)`의 하드 삭제까지 도달하며, 검사는 그 직후 의도적으로 중단해 Auth 삭제를 실행하지 않는다. 선택 버튼 Blob JSON을 읽었고, 로컬 미래 비배열 권을 둔 `idleSaveStatus()`·원격 transaction·정상 형제 권 저장을 확인했다.
- 실제 Firestore/Storage emulator의 확장 `check:rules` exit 0(`/private/tmp/rev108-schema-2026-10-20/check-rules-extended.log`): marker `0`/`1.5`/`true` 거절, 미래 서버 권의 타인 하드 삭제 거절·owner 하드 삭제 성공 확인. 신규 request-guard 제거 RED는 marker `0` 문서가 실제 서버에 저장됨을 다시 읽어 증명하고, 기존 resource-guard 제거 RED·`ad5fe91` 원본 RED도 통과했다. request 변이 생략은 서버 `PERMISSION_DENIED`로 예상 exit 1(`/private/tmp/rev108-schema-2026-10-20/request-red-control.log`).
- 부모는 최종 runtime 뒤 `test:audit-browser` 175/175+JSON12, `test:public` CSP12/빌드, `check:static`, B6 REV-114 정상11을 exit 0으로 확인했다. 로그는 같은 tmp 폴더의 `parent-audit-after-followup.log`, `parent-public-after-followup.log`, `parent-static-after-followup.log`, `parent-intake114-after-followup.log`를 대조한다. 이전 B6/B7/U1.5/CAS/size/① 검사는 영향 없는 범위를 반복하지 않고 앞선 통과 증거를 유지한다.
- ② 첫 좁은 Claude 호출은 timeout exit 124, 최종 답변/진행 내용이 비어 있어 **승인이 아니다**. 부모가 새 3파일 범위로 다시 요청했으나 이 호출도 timeout 124였고, 아래 Codex 독립 확인과 구분한다. 이 절의 구현자 검사는 독립 검토 판정을 대신하지 않는다.

### ② 독립 검토 상태 (2026-10-21 · 부모 Codex 기록)

- Claude Opus/high 래퍼 전반 정적 검토는 2026-10-20에 최종 답변을 받았다(`final-review.md`, exit 0). 무표식 승격/ACK·영속 CAS·Rules·미래 권 격리를 확인해 재현 결함 미발견으로 판정했다. `writeLocalNow()` 후행 수정도 최종 답변에서 구체적으로 읽었음을 확인했다. Claude에게 Bash가 없어 브라우저·에뮬레이터를 직접 실행한 승인은 아니다.
- 이 답변 뒤 부모가 선택 내보내기 폴더 손실(Claude가 일관성 사각으로 언급한 항목을 원형 보존 계약과 대조)과 intake 비배열 예외를 직접 재현해 REV-135·136으로 확정했다. 앞선 전반 판정을 이 후속 수정의 승인으로 재사용하지 않는다.
- 3파일(index·브라우저 schema 검사·Rules schema 검사) 후속 호출 두 번은 각각 **600초 timeout exit 124**였고, 진행 로그가 비어 있으며 최종 답변도 없다(`followup-review-progress.log`, `followup-review-retry-progress.log`). 로그인은 정상이나 호출 지연의 원인은 확인되지 않았다. 최초 호출 중 Codex 사용량 종료도 겹쳤으므로 단정하지 않는다. 두 호출 모두 비용 집계에 포함하며 **Claude 승인으로 기록하지 않는다**. 새 근거 없이 같은 호출을 반복하지 않고, 추가 수정은 구현에 참여하지 않은 Codex 에이전트에게 독립 확인을 요청했다.
- 소스 3파일은 후속 요청 전 해시를 고정했고(`followup-review-source.sha256`) 추가 변경이 없음을 대조했다. 부모가 신규 정상/RED·변이 생략 로그와 실제 emulator의 문서 재읽기 증거를 판독했으며, `check:review-hygiene`(열림 4, INDEX 118/120, 자기검사 6/6)·`git diff --check`도 통과했다.

- **Codex 독립 후속 검토(2026-10-21, `/root/rev108_data_review`, 구현 미참여): 추가 재현 결함 미발견.** 지정한 3파일의 135·136 수정·일반 전체삭제 사전 보류/계정 영구삭제를 확인했다. 실제 함수 VM으로 미래 권 선택 내보내기의 전체 필드/원본 불변, `writeLocalNow()`의 미래 권 보존과 지원 권의 B6 내용 검토 초기화를 확인했고, 정적 검토에서 owner·CAS 경계와 RED 실제 결과 단정을 확인했다. 전체 브라우저/에뮬레이터를 재실행하거나 운영을 확인한 판정은 아니다.
- **합의:** ① 기존 Claude 승인 유지. ② 전반 Claude 정적 검토 후 부모가 재현한 135·136은 코드·14/14 및 표적 RED·독립 Codex 확인으로 닫았다. **미합의:** 재현 결함은 없으나 후속 Claude 최종 답변은 없다. **다음 행동:** 후속 Claude가 추가 수정과 PR 최종 head를 확인한 뒤, 레일 ⑩-A3의 로컬/사용자 확인으로 Rules·Pages 쓰기 중단 창/전환 순서를 확정한다. 실제 계정·구형 운영 탭 거절·Safari/iPad는 남는다. PR은 draft, HANDOFF는 `ready-for-review`, REV-108은 `in-progress`를 유지한다.
- `2026-10-20` · **Claude Opus 클라우드 ② 검토(`ad5fe91..8dc7225`)** · 판정: **코드·Rules 결함 없음 · 배포 순서는 권고 1건(해리 결정)**.
  구현 불참. `test:set-schema` exit 0(PASS 88 · RED 6종·기준 RED) · `check:rules`(에뮬레이터) exit 0 — 요청/자원 가드·`ad5fe91` 기준 RED 확인.
  신뢰 경계 재현: 미래 버전 권(`problems` 객체 · 이름/본문/이미지에 주입 문자열)을 로컬에 심고 부팅 → 라이브러리 카드 3장, 편집기 열기 거부,
  주입 실행 0 · 위험 `img` 0 · 페이지 오류 0. 미래 권을 원형 보존해도 렌더 경로로 새지 않음을 확인.
  **권고(결함 아님)**: '쓰기 중단 창' 대신 **전환 Rules 한 단계**를 먼저 두면 창이 필요 없다 — `setSchemaVersion` 은 받되 생성엔 필수 아님,
  **표식이 있는 문서는 표식을 유지해야만 갱신·tombstone 가능**(`!('setSchemaVersion' in resource.data) || request…==resource…`).
  새 클라이언트는 항상 표식을 쓰므로 무표식 문서에는 `groupOf` 가 없다 → 구형 탭의 무표식 쓰기는 잃을 것이 없고, 표식 문서는 구형 탭에서 보호된다.
  순서: 전환 Rules → Pages(이 PR) → 구형 탭 소멸 관찰 → 지금의 엄격 Rules. 실제 로그인·구형 운영 탭 거절·Safari/iPad 는 미실행.


### ② 후속 검토·CI 확인과 운영 전환 준비 (2026-10-21 · 로컬 Codex · 배포 전 기록)

- **최신 판정:** [Claude Opus 후속 최종 답변](https://github.com/071205/pedagogy/pull/23#issuecomment-6295889465)은 `ad5fe91..8dc7225`의 코드·Rules 결함 미발견이다. REV-135·136을 포함한 `test:set-schema`·Rules emulator 및 미래 권 주입 문자열 부팅 검사를 실행했다고 보고했고, `570604d`에 같은 검토 기록이 있다. 이전 두 래퍼 timeout은 계속 미완료로 기록하며, 이 별도 클라우드 최종 답변과 구분한다. 같은 질문으로 Claude를 재호출하지 않았다.
- **현재 head:** 실제 worktree `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`를 깨끗한 `8dc7225`에서 `3335d15e9e5209bb40958a3ac81b96d658407b0c`로 fast-forward했다. 추가 변경은 검토 문서와 `check-audit-safety.mjs`의 VM 외부 경계 대역뿐이며 제품·Rules 소스는 같다.
- **CI:** `8dc7225`의 verify 실패는 새 schema 함수·상수 및 `writeLocalNow` 대역 누락이다. 로컬에서 당시 검사 파일을 임시 경로에 저장하고 현 제품 함수에 실행해 exit 1·11개 중 4개 실패(`ReferenceError` 포함)를 재현했다. `3335d15` 검사 파일은 exit 0·11/11 통과다. [최신 Verify 실행](https://github.com/071205/pedagogy/actions/runs/39458566478)은 verify·cross-platform·hwpx 모두 성공이며 check:fast·Rules·시각 회귀 단계도 성공이다. SonarCloud도 성공이다. 전체 check:fast의 **로컬 일괄 실행**은 하지 않았고 같은 head의 원격 결과를 재사용한다.
- **배포 전 로컬 검사:** `npm run check:rules` 최초 실행은 기본 Java 8 때문에 emulator 시작 전에 exit 1이었다. 설치된 JDK 21을 아래처럼 이번 프로세스에만 지정한 실행은 exit 0이며, Firestore/Storage·B3·schema 정상과 request/resource/`ad5fe91` RED를 모두 확인했다.
  ```bash
  env JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run check:rules
  ```
  배포 후보 `firestore.rules` SHA-256: `9b16c418fa782139f6040b299e575717aa6654e559e566cb9dd3285c33ea0277`.
- **운영 순서 확인:** [새 댓글](https://github.com/071205/pedagogy/pull/23#issuecomment-6305398698)은 해리의 “지금 쓰는 사람이 없으니” 결정을 전하며 엄격 Rules → PR 병합/Pages → 로그인 왕복 순서를 적었다. 현재 채팅의 직접 지시는 사용자 확인 전 draft·배포/병합 보류이므로 댓글만으로 배포하지 않고 최신 결정인지 확인을 요청했다. 답변 전에는 배포·ready 전환·main 병합을 하지 않는다. 엄격 Rules를 먼저 올리면 구형 운영 Pages의 쓰기는 새 Pages 도착까지 거절된다. 반대로 Pages를 먼저 올리면 기존 Rules의 `hasOnly`가 새 표식을 거절한다.
- **합의:** ①·② 코드/Rules 독립 검토 완료, CI와 로컬 준비 검사 통과. **미합의:** 재현 결함 없음; 이 채팅의 배포 승인 확인 대기. **다음 행동:** 확인되면 위 SHA의 Firestore Rules만 `pedagogy-huryul`에 배포하고 결과·해시를 이 인계에 추가한다. Pages/병합은 별도 승인된 분담을 따른다. 실제 Google 로그인 저장·새로고침 유지·옛 묶음 확인/인쇄, 구형 운영 탭의 거절, Safari/iPad는 미검증이며 REV-108은 `in-progress`다.
- 세션 로그: `/private/tmp/rev108-resume-2026-10-21/`의 `pr.json`, `ci-latest.json`, `audit-safety-before.log`, `audit-safety.log`, `check-rules.log`(Java 8 시작 실패), `check-rules-java21.log`(정상/RED 통과). 임시 로그 유실 시 위 명령과 고정 커밋으로 재현한다. `transcript.txt`는 읽거나 수정하지 않았다.


### ② 엄격 Firestore Rules 운영 배포 완료 (2026-10-21 14:44 KST · 로컬 Codex)

- **사용자 승인:** 이 채팅에서 “최신 결정이 맞음 — 검증 후 Rules 배포 승인”으로 댓글 `6305398698`의 바로 전환 결정을 직접 확인했다. 전환 Rules 단계 없이 **엄격 Rules → Claude PR 병합/Pages → 로컬 로그인 왕복** 순서를 확정했다. 구형 운영 Pages의 쓰기가 새 Pages 도착까지 거절되는 창을 수용한 승인이다.
- **배포 대상/명령:** 검증한 `3335d15`의 `firestore.rules`만 `firebase deploy --only firestore:rules --project pedagogy-huryul --non-interactive`로 배포했다. 원 프로세스 **exit 0**. Firebase 출력:
  ```text
  cloud.firestore: rules file firestore.rules compiled successfully
  firestore: released rules firestore.rules to cloud.firestore
  Deploy complete!
  ```
  배포 전/후 SHA-256 모두 `9b16c418fa782139f6040b299e575717aa6654e559e566cb9dd3285c33ea0277`. 배포 로그는 `/private/tmp/rev108-resume-2026-10-21/deploy-firestore-rules.log`다. Storage·Worker·Pages는 배포하지 않았다.
- **검증 재사용:** 위 JDK 21 `check:rules` 정상/RED exit 0 뒤 Rules·제품 코드는 바뀌지 않았다. `3335d15` 원격 CI 성공과 로컬 검사 샌드박스 11/11을 재사용한다. 이 배포는 운영 서버 컴파일·릴리스 완료 증거이며, 실제 인증된 데이터 쓰기/거절의 실행 증거를 대신하지 않는다.
- **다음 담당/범위:** Claude가 PR #23의 최신 head와 CI를 확인하고 ready 전환·병합하여 Pages 빌드를 확인한다. 로컬 Codex는 이 단계에서 PR 상태·main·Pages를 바꾸지 않았다. Pages 반영 뒤 로그인 → 검증용 권 저장 `✓ 저장됨` → 새로고침 유지 → 옛 묶음 일괄 확인 → 인쇄를 확인한다. 구형 운영 탭의 실제 거절·Safari/iPad도 미검증이다. 안전한 운영 왕복/전체 완료로 선언하지 않으며 REV-108은 `in-progress`다.


### ② 배포 후 운영 확인 (2026-10-22 · 로컬 Codex · REV-108 해결 확인)

- [PR #23](https://github.com/071205/pedagogy/pull/23)은 `625e19c286e7b4ae84d300586c0757930cd69bf3`로 병합됐다. Pages API의 source는 `main`/루트, 최신 build commit도 같은 SHA이며 `built`다. [병합 커밋 Verify](https://github.com/071205/pedagogy/actions/runs/39551536590)의 verify·cross-platform·hwpx 모두 성공이다. PR head `9bb1b77` 실행의 WebKit 1194×834 클릭 timeout 1건과 병합 커밋 성공을 구분하며, timeout을 재현 결함이나 해결된 코드 결함으로 단정하지 않는다.
- 운영 `index.html`·`service-config.js`·normalize·render·print·intake·intake-contract 7개를 시스템 curl로 읽어 검증 소스와 바이트/SHA-256이 모두 일치함을 확인했다. 최초 Python urllib는 로컬 CA 오류로 시작 실패했고, curl의 단발 503 뒤 한 번 제한 재시도하여 성공했다. TLS 검증은 끄지 않았다. 결과는 `/private/tmp/rev108-operational-2026-10-22/deployed-core-sha256.json`이다.
- 실제 사용자 Chrome 프로필에서 PEDAGOGY 운영 로그인과 기존 라이브러리 로드를 확인했다. 로그인 전 이용약관·개인정보 동의는 사용자가 직접 처리했다. 사용자 기존 문제집을 직접 선택해 편집·삭제·충돌 해소하지 않았다. 다만 아래 수동 저장은 전체 권의 이미지 이전/재전송 경로이므로 기존 서버 문서가 전혀 변하지 않았다고 단정하지 않는다. 계정 식별자·토큰은 기록하지 않는다.
- 자체 작성한 4문항 JSON `/private/tmp/rev108-operational-2026-10-22/rev108-legacy-fixture.json`을 준비했다. 구형 `groupSpan:3` 지문 1개와 무관한 4번으로 저장·새로고침·옛 묶음 확인·인쇄를 검증한다. native 파일창에서 해당 파일은 선택됐지만 열기가 비활성/무반응이었고 컴퓨터 제어가 `noWindowsAvailable`도 반환했다. JSON/모든 파일 필터·열기 액션·앱 재연결로 완료되지 않아 사용자의 직접 파일 열기를 요청했다. 이후 사용자가 열기를 완료했고 4문항 테스트 권이 정상 생성됐다. 파일창 도구 문제를 제품 가져오기 결함으로 등록하지 않는다.
- **실제 저장/옛 묶음 확인:** 테스트 권의 머리말만 `REV-108 운영 검증용 자체 작성 자료 · 저장 왕복 확인`으로 바꾸고 수동 저장했다. 새로고침 뒤 머리말과 옛 묶음 경고가 유지됐다. 사용자 인증 SDK의 `SETS_COL(currentUser.uid).doc(testId).get({source:'server'})` 읽기에서 문서 존재·`setSchemaVersion:1`·revision 3·4문항·머리말 일치·첫 문항 `groupReview:'legacy'`를 확인했다. `isCloudSynced(testSet, sets.indexOf(testSet))`는 true, 해당 테스트 권의 보류는 false, 로컬 기준 revision도 3이었다. 처음의 UID 인자 누락으로 발생한 읽기 거절과 order 인자 누락으로 나온 ACK false는 진단 코드 오류이며 제품 결함이 아니다.
- **실제 인쇄 경계:** 미확정 상태의 인쇄 시도에서는 Chrome 인쇄 미리보기가 열리지 않았다. 옛 묶음 `모두 이대로 확정` 뒤 경고가 사라지고 `[01~03]`이 표시됐으며 Chrome 실제 인쇄 미리보기(2쪽)가 열렸다. 4번은 독립 문항으로 표시됐다. PDF 저장 창의 자동 클릭/키 입력이 적용되지 않아 사용자에게 여백 없음·PDF 저장을 요청했다. 사용자는 다운로드 폴더의 기본 이름으로 저장했다. 해당 파일의 자체 작성 본문을 확인한 뒤 `/private/tmp/rev108-operational-2026-10-22/rev108-printed.pdf`로 증거 사본을 만들고 2쪽을 모두 PNG 렌더·육안 대조했다. `[01~03]`과 독립 4번은 정상이다. 다만 첫 쪽 하단에 화면용 `본문으로 건너뛰기` 링크가 찍혀 별도 REV-137로 등록했다. 인쇄 미관까지 결함 없음으로 선언하지 않는다.
- **기존 자료/충돌 한계:** 수동 저장의 전체 이미지 이전/재전송 뒤 계정 전체 `충돌 보류 5`와 사본이 보였다. 발생 원인은 아직 분리하지 못했고 기존 자료의 충돌 선택·해소·삭제는 하지 않았다. 테스트 권은 위 서버 ACK로 별도 확인했으며 전체 계정 정상 저장으로 확대하지 않는다. 코드의 수동 저장은 전체 라이브러리를 다루므로 기존 자료 무변경이라고 기록하지 않는다.
- **확정 후 서버/재진입:** 운영 Chrome에서 테스트 권의 schema 1·revision 3 저장/ACK·새로고침 유지, 옛 묶음 확정 후 revision 4·첫 3문항 동일 대표/4번 무소속·정규화 일치/ACK·재진입 유지를 확인했다. 실제 PDF 2쪽의 `[01~03]`과 독립 4번도 확인했다. 인증 SDK에서 무표식 다음 revision 덮어쓰기·신규 사본·tombstone이 모두 `permission-denied`였고 서버 원본은 불변이다. 구형 바이너리 탭 자체를 실행한 검증과는 구분한다. 원시 클라우드 `problems`와 로컬 배열은 저장 인코딩/정규화 때문에 단순 JSON 문자열이 달랐지만 `setJSON(local) === setJSON(docToSet(server))`는 true다. raw 비교 false를 데이터 유실로 판정하지 않는다. 주소창에서 운영 URL로 재진입해 로그인/테스트 권 복원·범위 유지와 서버 revision 4/정규화 일치/ACK를 다시 확인했다.
- **완료와 남은 한계:** 구현·독립 검토·정상/RED·Rules/Pages 배포·테스트 권 실제 왕복 및 운영 쓰기 차단 근거를 모아 REV-108을 `resolved`로 바꾼다. 실제 Safari/iPad·U1.5 원본 패널은 미검증이다. 계정 전체 충돌 보류 5는 원인 미분리 상태로 보존하며 전체 계정 정상 저장으로 확대하지 않는다. 실제 구형 탭 UI의 거절 안내는 미검증이다. 화면용 링크 출력 REV-137은 별도 결함이며 다음 UI 구현자가 수정/출력 회귀·깨보기를 확인한다. 그 뒤 기존 레일의 U2(Claude Sonnet 5 구현 → Codex Sol medium 검토)로 잇는다.
- **재현 자료:** 민감값 없는 관찰 `/private/tmp/rev108-operational-2026-10-22/observations.json`, PDF·`print-extracted.txt`·`print-page-1.png`·`print-page-2.png`. 임시 파일은 정리될 수 있으므로 위 fixture 구성/SDK 방식/판정을 영구 증거로 삼는다. 제품/Rules가 바뀌지 않아 기존 브라우저 175/175·Rules 정상/RED·병합 CI를 재사용했고 기록 변경에 review-hygiene·diff 검사를 실행한다.
- 작업 사본은 `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`, 브랜치 `codex/rev108-operational-checks`(`origin/main 625e19c` 기준)다. 기본 폴더의 예전 `claude/u15-source-panel` 브랜치·`transcript.txt`는 변경하지 않았다. 제품·Rules 변경/배포나 유료 AI 호출은 하지 않았다.

### 2026-10-22 종료 상태 보정

사용자가 발견 문제 해결과 사용량 종료 전 정리를 요청했다. 후속 출력 수정·검증 및 운영 충돌 정리의 최신 상태는 [HANDOFF-195](2026-10-22-index-print-ui-followup.md)를 따른다. REV-137은 구현/로컬 정상·RED 완료, Claude 주간 한도 때문에 독립 검토 미완료·운영 미배포다. 위 운영 확인 시점의 충돌 5건은 초안 JSON/계정 사본 보존 후 2건 정리돼 3건이 남았다. REV-108 해결과 출력/전체 계정 정리 완료를 혼동하지 않는다.
