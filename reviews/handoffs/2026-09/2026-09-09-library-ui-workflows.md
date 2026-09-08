# 변경 인계 — 라이브러리 폴더·선택·정렬 사용 흐름 수정

- ID: `HANDOFF-2026-078`
- 날짜: `2026-09-09`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | tests | docs`
- 관련 이슈: `REV-2026-053 ~ REV-2026-058` (6건 resolved)
- 기준 HEAD: `96e9d83`

## 변경 내용

폴더 삭제는 기존에도 있었지만 오른쪽 클릭·길게 누르기 후 이름을 비워야 실행되는 숨은
동작이었다. 폴더 옆 관리 버튼에서 이름 변경과 명시적인 폴더 삭제를 할 수 있게 했다.
새 폴더도 같은 대화상자를 사용하며 생성 뒤 바로 그 폴더를 보여 준다. 삭제 확인에는
문제집 보존을 안내하고 기존 tombstone·동기화 처리를 유지한다.

문제집 이동은 번호를 입력하는 prompt 대신 폴더 이름을 선택하는 대화상자로 바꿨다.
한 카드의 메뉴에서도 이동할 수 있고, 선택 모드에서는 동작하지 않던 카드 메뉴를 숨긴다.
모두 선택/해제 문구와 화면 밖 선택 개수도 현재 상태를 보여 준다.

폴더 안에서 만든 새 문제집과 복제본은 해당 폴더에 남는다. 검색은 전체를 대상으로 하되
결과 카드의 소속을 표시하고, 폴더를 클릭하면 검색을 지워 그 폴더로 이동한다.
정렬 버튼은 현재 기준을 표시하고 Escape로 닫힌다. 실제 직접 재정렬 조작이 없는
manual 항목의 이름은 ‘기본 순서’로 바꿨다(저장 값과 순서 자체는 동일).

라이브러리 이름 변경은 마지막으로 열었던 문제집이 아니라 실제 변경한 카드의 시각을
기록한다. `saveSets(changedSetId=currentSetId)`를 사용해 편집기 기존 호출은 유지했다.
이름 변경과 복제에는 기존 160자 이름 상한을 적용한다.

폴더 이동은 `historyStep`으로 즉시 한 단계로 기록한다. A단계의 로컬 소속 지도도
snapshot에 포함하며 Undo/Redo 뒤 로컬 메타에 저장한다. 폴더 이름 목록과 삭제 기록은
되돌리지 않으므로 과거 소속 복원보다 tombstone이 계속 우선한다.

## 위험과 검토 요청

- 기본 `libraryCloudSchema: 0` 유지. 이동·생성·복제는 `setFolder`로 A/B 계약을 따른다.
- 새 대화상자의 변경 시점에 세션 세대를 확인해 다른 계정에 열린 조작이 적용되지 않는다.
- 폴더는 최대 200개까지만 생성한다. 기존 정규화·규칙 상한과 같다.
- 375px 대화상자와 터치 버튼 크기를 확인했다. 커진 폴더 버튼으로 화면이 11px 넘던 중간
  구현은 라이브러리 줄 간격 조정으로 해결한 뒤 기존 화면 높이 검사를 다시 통과했다.
- 검증 범위는 격리된 Chromium 및 mock remote 경계다. 실제 계정·운영 Firebase에는 쓰지 않았다.

## 검증

- `npm run test:library-ui`: 실제 클릭·입력·취소·새로고침 11개 시나리오 통과.
- `LIBRARY_UI_RED=1 npm run test:library-ui`: 수정 전 96e9d83 index를 응답하게 해
  당시 8개 시나리오 모두 실패 확인. 이후 추가한 즉시 Undo 검사는 수정 중 구현에서도
  A/B 모두 실패를 확인한 뒤 historyStep·A 소속 snapshot 반영으로 통과했다.
- `npm run test:review-contracts`: 19개 통과. 원격 삭제/Undo 순서, 실패 재시도,
  tombstone, A/B 분리, 계정 전환과 HWPX 경로 포함.
- `npm run test:audit-browser`: serve.py의 regression-test.html 154/154 통과.
- `npm run test:cross:fast`: Chromium 데스크톱·태블릿·휴대폰·CDN 차단 및 검사 자기검증 통과.
- `npm run test:worker`, `npm run check:static`, `git diff --check` 통과.
- `test:library-ui`를 `check:fast`에 연결했다.

## 다음 검토자에게

독립 검토는 폴더 이동의 즉시 Undo/Redo, A단계 소속 지도 보존과 삭제 tombstone 우선 판정,
현재 편집 대상과 다른 카드의 이름 변경 시 수정 시각을 우선 확인한다.
구조 3단계는 아직 시작하지 않았다. 원격 push·Firebase/Worker 배포 없음.
`.tmp.driveupload/`는 다른 작업자 자료이므로 읽거나 수정·커밋하지 않았다.
