# 변경 인계 — 라이브러리 모드 선택기와 설정 모달

- ID: `HANDOFF-2026-116`
- 날짜: `2026-09-11`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | tests | docs`
- 관련 이슈: `없음` (사용자 요청에 따른 UI 변경)

## 변경 내용

- `index.html`의 작은 문제집/모의고사 탭을 큰 메뉴 버튼으로 바꿨다. 버튼은 현재 모드와
  짧은 설명을 표시하고, 펼친 메뉴는 두 모드의 용도·현재 선택 체크를 함께 보여 준다.
- 문제집 카드에는 사용자가 고른 A안(겹친 시험지) 벡터 아이콘을, 모의고사 카드에는 같은
  선 굵기의 시험지 아이콘을 추가했다. 아이콘 안 문항 수는 시각적 보조이며 전체 아이콘은
  `aria-hidden="true"`라 기존 카드 텍스트를 중복 낭독하지 않는다.
- 설정을 별도 화면 대신 native `<dialog>`로 바꿨다. 라이브러리·문제집 편집기·모의고사
  편집기를 배경에 그대로 둔 채 약한 블러 scrim 위에 열고, ESC·닫기 버튼·포커스 복귀를
  지원한다. `#settings/<tab>` 딥링크와 데이터 삭제 후 라이브러리 복귀 계약은 유지했다.
- 화면 설정의 테마·언어를 각각 독립된 필드 카드로 나누고 14px 간격, 42px 선택 상자,
  모바일 단일 열 배치를 적용했다.
- `scripts/check-library-ui.mjs`, `scripts/check-mock-library-ui.mjs`,
  `scripts/check-accessibility.mjs`, `scripts/check-cross-platform.mjs`의 계약을 새 메뉴/모달
  의미와 동작에 맞춰 갱신했다.

## 위험과 검토 요청

- 문제집/모의고사 전환 메뉴는 레일의 overflow에 잘리지 않도록 `position:fixed`로 띄우고
  열릴 때·스크롤/리사이즈 때 뷰포트 안으로 위치를 다시 계산한다. 캡처에서 sticky 레일의
  stacking context 때문에 카드가 메뉴 오른쪽을 덮는 현상을 재현해, 열린 동안 레일만
  위로 올리고 실제 겹침 좌표를 검사한다. Safari/Firefox에서도
  하단에 가까운 좁은 뷰포트에서 메뉴가 화면 안에 남는지 독립 확인해 달라.
- 설정은 native dialog의 top layer와 포커스 가둠을 쓴다. 설정을 문제집·모의고사 편집기에서
  열고 ESC/닫기로 돌아갈 때 편집 상태와 포커스가 유지되는지, 데이터 삭제 성공 뒤에는
  dialog가 닫히고 라이브러리로 가는지 다시 확인해 달라.
- 데이터 탭은 내용이 길어 dialog 내부 `st-shell`만 스크롤한다. 200% 확대와 iOS 가로 화면에서
  닫기 버튼·위험 구역이 가려지지 않는지 추가 수동 확인 가치가 있다.
- 배포는 하지 않았다.

## 검증

- 회귀검사 선행 실패: 새 계약을 먼저 추가한 뒤 `npm run test:library-ui`에서
  `library mode switcher and settings modal preserve context accessibly`가 실패함을 확인했다.
- 첫 캡처에서 메뉴 오른쪽을 카드가 덮는 현상을 재현했고, `elementFromPoint()`로 겹침 좌표의
  최상단 요소를 검사하도록 보강한 뒤 수정 전 실패·수정 후 통과를 확인했다.
- `npm run test:library-ui` — 17개 시나리오 통과.
- `npm run test:mock-library-ui` — 정상 시나리오 전부 통과, `MOCK_UI_RED=1` 고장 주입이
  대응 항목들을 실제로 실패시킴.
- `npm run test:cross:fast` — Chromium의 데스크톱·태블릿·아이패드 가로·375×812에서
  가로 넘침, 터치 목표, 모의고사 진입, 스크립트 오류 검사 통과.
- 디자인 스킬의 Python Playwright 경로는 환경에 `playwright` 모듈이 없어 실행 불가했다.
  새 의존성을 설치하지 않고 저장소의 고정 Playwright로 1194×834, 768×1024, 375×812의
  메뉴·모달·가로 넘침·reduced-motion·dark mode를 확인하고 `/tmp/pedagogy-ui-review/`에
  캡처했다.
- `npm run check:fast`는 요청대로 한 번만 실행했으나, 제품 검사 전에 열린 이슈
  `REV-2026-074`의 `Icon\r` 메타파일 3,667개(`.git/refs` 131개)에서 중단됐다.
  `scripts/clean-mac-icons.mjs`가 이름이 정확히 `Icon\r`이고 0바이트인 파일만 지우며 다른
  FinderInfo 비트가 섞인 폴더는 건드리지 않음을 읽어 확인한 뒤 같은 스크립트로 정리했다.
  재확인 결과 `macOS 아이콘 메타파일 없음`이다.
- 중단 뒤 아직 돌지 않은 하위 검사(`test:worker`, `test:fixtures`, `test:mock-layout`,
  `test:mock-library`, `test:hwpx`, `test:hwpx-exam`, `test:hwpx-browser`, `check:static`,
  `test:audit-browser`, `test:review-contracts`)를 개별 실행해 모두 종료코드 0을 확인했다.
  HWPX의 Python 대조는 기존처럼 `lxml` 부재로 건너뛰었다.
- `regression-test.html`은 현재 저장소에 없어 그 경로는 실행하지 못했다.

## 다음 검토자에게

`index.html`의 `.library-mode-*`, `libraryCardVisual()`, `setLibraryTab()`/
`wireLibraryTabs()`, `showSettings()`/`closeSettingsDialog()`와 위 네 검사 파일을 우선 보라.
로그인하지 않은 로컬 상태로도 핵심 동작을 재현할 수 있다. 사용자 요청과 직접 관련 없는
기존 미커밋 보안 검토 파일·출시 게이트 변경은 이 handoff 범위가 아니며 그대로 보존했다.
