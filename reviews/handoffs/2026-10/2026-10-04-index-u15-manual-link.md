# 변경 인계 — U1.5 ⓑ 수동 연결·원문 관리 화면

- ID: `HANDOFF-2026-184`
- 날짜: `2026-10-04`
- 작성자: `Claude / Opus 5.5`
- 상태: `ready-for-review` — **REV-2026-118 보완 완료 · Codex Sol medium 재검토 전 merge 금지** (#14·#15 는 2026-10-08 main 에 merge)
- 영향 영역: `index | tests | docs`
- 관련 이슈: `REV-2026-118` (REV-2026-108 선행 판정 기록을 같은 브랜치에 실었다)
- 브랜치: `claude/u15-manual-link` (기준 `codex/u15-storage` = PR #15 `f29af93` · 그 아래 PR #14). **#14 → #15 → 이것** 순서로만 merge.

## 변경 내용

U1.5 의 마지막 묶음. 저장 묶음 API(`registerSource`·`assignPages`·`reconnect`·`forSet`·`readLinked`·`impact`·`deleteSource`)를 화면에 잇는다.

- **원본 패널(지면 배치)** — 보여 주는 순서: ① 문항에 쪽이 지정된 원문(`forProblem`) ② 이 문제집에 연결된 원문 자유 탐색(`forSet`→`readLinked`,
  여럿이면 고르기) ③ 없으면 `원본 파일 연결`. 문항 지정 원문이 이 브라우저에 없으면 `다시 연결`.
  - `이 문항 = n쪽` · `+ n쪽 더하기` · `쪽 지정 해제`. ⚠️ `assignPages` 는 출처 목록을 **통째로 교체**하므로 다른 원문(예: AI 출처)의 지정을 합쳐 넘긴다.
  - `다시 연결`: 같은 파일(내용 확인)이면 그 원문을 **이 문제집에도 연결**(`linkSource`) — 기록이 다른 권에만 이어져 있으면 안 보였다.
    다른 파일이면 새 원본으로 보관할지 묻고, 옛 쪽 지정은 옮기지 않는다(U0 §5-2).
  - 처음 쓰기 전에 한 번 **다른 탭을 닫았는지** 묻는다(B6: 구형 탭 확인은 호출자 명시). 취소하면 저장소도 만들지 않는다.
  - '원본' 단추는 이제 **모든 문제집**에서 보인다(연결하려면 있어야 한다). 누르기·읽기만으로는 저장소를 만들지 않는다.
- **설정 → 데이터 → 이 기기에 보관한 원본** — 목록·사용량/1GB·보관 보장 상태(`persisted()` 만, 요청 창을 띄우지 않는다)·`원문 삭제`.
  삭제는 `impact()` 의 영향 범위(쓰는 문제집·진행 중 작업·복구본)를 확인창에 보인 뒤 그 확인표로만 지운다. 문항·문제집은 그대로.
- 상태 변수는 부팅 중 `closeSheetSource()` 가 불리므로 스크립트 앞에 둔다(TDZ).

## 검증

- `test:sheet-source` **15개 · 깨보기 15종 전부 빨간불**(ⓐ 10 + ⓑ 5): ⑪-a 파일 연결(취소 시 저장소 없음) · ⑪-b 쪽 지정·더하기·⌘Z ·
  ⑪-c AI 출처 보존 · ⑪-d 다시 연결(같은/다른 파일) · ⑪-e 설정 원문 삭제(영향 범위 문구). 새 깨보기: 다른 탭 확인 건너뜀 · 쪽 더하기가 기존 쪽 버림 ·
  다른 원문 출처 버림 · 같은 파일 재연결이 권에 안 이음 · 설정 삭제가 기록 식별자를 잘못 읽음.
- 검사가 잡은 실제 결함 1: 설정 삭제가 `listSources()` 기록의 `id` 를 `sourceId` 로 읽어 '원문 없음' 이었다 → 고침.
- `check:static`·`check:sonar`·`check:review-hygiene`·`test:worker`·`test:public`(CSP) 통과. 1440·375 화면과 설정 칸을 눈으로 확인(가로 넘침 0).
- 못 한 것: **`check:fast` 전체**와 **Codex 독립 검토**(세션 마무리 요청으로 멈춤). 실제 Safari/iPad 의 보관·회수(R8).

## 검토 요청 (Codex GPT-6 Sol medium)

범위: `git diff origin/codex/u15-storage...claude/u15-manual-link -- index.html scripts/check-sheet-source.mjs`.
특히 ① 읽기가 권 연결 확인 API 만 쓰는지 ② `assignPages` 에 넘기는 목록이 다른 원문 지정을 잃지 않는지 ③ 다시 연결에서 `linkSource` 를 부르는 조건이
'같은 파일임을 내용으로 확인한 경우' 뿐인지 ④ 원문 삭제가 `impact` 확인표 없이 지울 길이 없는지 ⑤ 저장소를 읽기만으로 만드는 경로가 없는지.

## 검토 기록

- `2026-10-08` · **Codex GPT-6 Sol / medium 독립 검토** · 판정: **보완 필요**.
  검토 범위는 요청한 `origin/codex/u15-storage f29af93..claude/u15-manual-link 114ba27`의 6개 파일.
  [REV-2026-118](../../issues/2026-10/2026-10-08-index-source-list-owner-race.md): 설정 원문 목록이
  `persisted()`를 기다리는 사이 owner가 바뀌면, 이전 owner의 파일명/크기/쪽수·삭제 단추가 다음
  계정 설정에 표시됨. 부모가 실제 `onAuth` 전환과 합성 자료로 브라우저 재현했고 Sol medium이
  probe/로그를 코드와 대조했다. Blob 접근/타인 원문 삭제까지 확인한 것은 아니다.
  지정 저장 API·기존 출처 보존·같은 파일 재연결 경계에서 추가 확정 결함은 발견하지 않았다.
  `test:public` 통과(CSP red 12/12·공개 빌드), `check:static` 통과(리뷰 위생 자기검사 6/6 포함).
  `test:sheet-source`: 정상 **15/15 통과**, 실패 주입 **15/15 빨간불**(359초, exit 0).
  로그 `/tmp/u15-184-sheet-source.log`; 새 owner 경합 probe `/tmp/u15-184-owner-race.log`.
  검토 기록 추가 후 리뷰 위생(이슈 118/열림 5·INDEX 120줄·최근 5·자기검사 6/6)과 `git diff --check` 통과.
  Sol 검토자의 localhost 실행은 EPERM으로 막혔고 부모는 승인된 실행으로 브라우저 검사를 수행했다.
  `regression-test.html`은 이 브랜치에 없어 실행 불가. `check:fast` 전체·실제 Safari/iPad·Google
  로그인은 미실행. 이번 변경은 검토 기록/이슈 등록이며 기능 수정·merge·배포 없음.
  다음: REV-118의 owner/세대 방어와 경합 회귀를 구현한 뒤 같은 범위를 독립 재검토.
- `2026-10-08` · **보완(구현자 Claude · 클라우드 세션)** — REV-2026-118 수정과 SonarCloud 신뢰성 C 해소. 재검토 요청.
  · `renderDataSources()` 가 세대(`dsGen`)·owner·epoch 를 잡고 오류 표시·DOM 쓰기 직전에 확인한다(오류 처리도 안으로 옮겨
    `prepDataPane()` 의 `catch` 를 걷었다). `onAuth` 계정 전환 구간에 `resetDataSources()` — 세대를 올리고 목록을 비운다.
  · 회귀 **⑪-f**(`check-sheet-source.mjs`): 전환 즉시 비움 · 붙잡힌 이전 목록을 전환 뒤 놓음 · Codex 재현 순서 그대로 ·
    같은 계정 역순 완료. 깨보기 2종(`live()` 제거 · 비우기 제거) 추가 → 둘 다 ⑪-f 빨간불.
  · Sonar S2681 3곳(한 줄 `if … return;`·`if(currentUser)flushToCloud(…);renderLibrary();`)을 중괄호로 — 동작 같음.
    인지 복잡도·`Error()`·label·`role=status` 경고는 maintainability 라 이 보완에 넣지 않았다.
  · `check-audit-safety` 의 `onAuth` 샌드박스에 `resetDataSources` 대역.
  · 실행: `test:sheet-source` **16/16 통과 · 깨보기 17/17 빨간불**(380초, exit 0) · `check:static`·CSP 12/12·`test:worker`·`test:review-contracts`·`test:library-ui`·
    `test:intake`·`test:u15-storage`·리뷰 위생·`git diff --check` 통과.
  · 재검토 범위: `7229f62..` 이 보완 커밋 — `index.html`(`renderDataSources`·`resetDataSources`·`onAuth` 한 줄·S2681 3곳)·
    `scripts/check-sheet-source.mjs`·`scripts/check-audit-safety.mjs`. 특히 `deleteSourceFromSettings()` 의 await 뒤 `toast` 는
    세션 검사를 하지 않는다(쓰기 클라이언트가 owner/epoch 로 거절하므로 남는 것은 안내 한 줄) — 이 판단이 맞는지.
