# 좁은 화면의 지면 미리보기에서 쪽 이동·확대 도구가 가려짐

- ID: `REV-2026-157`
- 날짜: `2026-10-28`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-205`

## 요약과 영향

태블릿·휴대폰에서 시험지 지면을 열거나 마지막 쪽으로 이동하면 쪽 선택/확대 도구가 위로 밀려 가려진다. 인쇄 전에 지면·잘림·글꼴 경고를 확인하는 흐름을 방해한다. 좁은 화면의 paper viewport도 최소480px 때문에 실제 패널 바깥으로 잘린다.

## 재현 절차

1. 수정 전 cef4801 UI에 새 브라우저 컨텍스트, 합성 12문항/6쪽을 준비한다.
2. 768×1024 또는 375×812에서 지면 탭을 연다.
3. 마지막 쪽으로 이동한다. toolbar 중심점의 elementFromPoint와 sheetPane.scrollTop을 확인한다.

## 기대 결과 / 실제 결과

- 기대: 문항·쪽 이동은 지면 안에서만 스크롤하고 쪽/확대 도구는 계속 보인다.
- 실제: 768 첫진입 pane.scrollTop41/마지막쪽66, 375 첫진입236/마지막쪽419. 두 크기 모두 nav/zoom 중심 hit=false. desktop1194는0/도구 hit=true.

## 근거

- scope 제한 없는 scrollIntoView가 overflow:hidden인 sheetPane까지 이동한다.
- 좁은 화면 sheet-scroll min-height480에 도구/축소판/설정이 더해져 패널 전체 높이를 넘는다.
- guest 실제 화면 probe와 raw source 회귀 양쪽에서 확인했다. 새 회귀 `scripts/check-sheet-navigation.mjs`는 수정 전 `Preview tools must remain visible and outer panels stationary` 단언에서 exit1이다.
- 실제 자료·계정·원격 쓰기 없이 합성 자료만 사용했다. 출력 조판 경로 변경은 제안하지 않는다.

## 처리 기록

- `2026-10-28` — Codex: 재현 등록. 지면 내부 좌표 스크롤, 실제 viewport 높이 제한, 좁은 화면의 native details 문항 설정 접기 및 키보드 동작을 구현/검증 중.

- `2026-10-28` — 구현 Codex: scrollSheetTo로 종이만 이동, 큰 문항 시작 정렬. narrow min-height0과 native details 기본접기를 추가했다. 독립 검토에서 원본+설정 조합의 종이 가림을 추가 재현해 원본 flex/높이 제한과 overlay로 보완했다. 최종 정상3화면/RED9·기존 지면17/14·원본16/17·필수회귀175·PDF2쪽/RED·public/CSP·정적 검사 통과. HANDOFF205/감사 증거 참조.
- `2026-10-28` — 별도 GPT-6 Sol medium: 최종 정확본/실행/PNG·CI순서 확인, 추가 재현 결함 없음·합의. 외부 로그인/시스템인쇄/실기기/원격운영 미검증 유지.
