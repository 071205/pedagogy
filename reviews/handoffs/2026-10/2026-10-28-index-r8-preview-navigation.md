# 변경 인계 — R8 시험지 미리보기 도구·원본 대조·큰 문항 이동

- ID: `HANDOFF-2026-205`
- 날짜: `2026-10-28`
- 작성자: `Codex`
- 상태: `needs-follow-up` (PR36 병합·main CI/Pages 완료, 실기기/운영 게이트 후속)
- 영향 영역: `index`, `tests`, `docs`
- 관련 이슈: `REV-2026-157`

## 변경 내용

[동작](../../../docs/R8-PREVIEW-PRINT-UX.md) · [영구 증거](../../audits/2026-10-28/r8-preview/README.md).
사용자가 시험지 미리보기/출력 완성도를 우선 선택했다. 지면 이동이 바깥 패널까지 스크롤해
쪽/확대/경고 도구를 가리던 결함을 고쳤다. 좁은 실제 viewport 높이를 맞추고 설정 접기·원본
분할·큰 문항 시작 위치를 보완했다. 인쇄 조판·저장 스키마·원격 자원 변경은 없다.

## 위험과 검토 요청

- transform된 문항 좌표/100%/큰 문항, 실제 viewport와 조상 스크롤 분리.
- 원본 안내·긴 원본 이미지+설정 펼침의 높이 경합, native details 키보드/초점·resize.
- 미리보기·실제 출력의 공유 조판 경로와 원본 file/IDB/PDF 경계를 보존하는지.

## 검증

- 새 test:sheet-navigation 정상3화면 각6쪽·목표 RED10·정리 성공. warning→한 쪽→Undo,
  원본 없음/긴 합성이미지·설정·확대/쪽/선택·키보드/resize와 페이지 내용/치수 보존.
- 기존 sheet-view 정상17/RED14, sheet-source 정상16/RED17, serve.py 필수회귀175/175·JSON12,
  실제 Chromium PDF2쪽/본문·print UI RED1, public/CSP12·정적 검사 통과.
- 새 검사는 CI의 Chromium 설치 직후 먼저 실행한다. 실제 서비스/AI 요청은 차단한다.
- 실제 시스템 인쇄/한글·Safari/iPad 실기기·실계정·원격 운영은 미검증이다.

## 다음 검토자에게

index의 sheet CSS/markup 및 scrollSheetTo/선택·쪽·확대/설정 핸들러와 새 검사만 검토한다.
원본 파일 저장 경로는 기존 검사를 재사용한다. A1 추가 구축은 보류하며 다음도 사용자 선택인
미리보기/출력 완성도를 우선한다. main Sonar와 실제 운영 게이트를 닫지 않는다.

## 검토 기록

- 2026-10-28 · 별도 Codex 1차: 원본을 열고 문항 선택 시 지면이 패널 아래로 사라짐을
  독립 재현. source 경계와 inspector overlay로 보완했으나 capacity 오류로 최종 판정0.
- 2026-10-28 · Claude opus/high inline 진단150초 timeout/의견0. 승인으로 세지 않고 반복하지 않았다.
- 2026-10-28 · 별도 GPT-6 Sol medium(레일 배정) 최종: 코드·PNG·정확본 정상3/RED10/cleanup·
  CI 순서 확인, **합의/미합의 없음**. Escape 단정은 선택 함수 재열기를 놓친 것으로 철회했으며,
  선행조건·내부 버튼 Escape·handler 제거 RED를 보강했다. 원문 판정은 감사 폴더에 보존.

## 최종 guest QA·CI 재개

- guest 배너 환경에서 원본 영역12px/scrollHeight159/연결버튼hit=false를 추가 재현했다.
  종이 flex-basis0으로 원본의 사용 공간을 보존했고 원본 없음/긴 이미지 각각 최소높이·버튼hit를
  새 회귀에 추가했다. mobile153px/hit=true, desktop/tablet도hit=true. 별도 Sol 최종 합의 갱신.
- 최종 정상3/RED10, guest 실제산출물3화면, CSS 보완 뒤 serve.py175/JSON12·public 통과.
  앞선 지면17/14·원본16/17·PDF/정적 통과와 마지막 좁은flex 보완의 검증 범위를 구별한다.
  정확한 head153bccf의 전체검사도 PR36 CI4개 모두 통과했다.
- PR36 첫 head bdf31ae의 Verify40656600196은 최종 수정 때문에 취소했다. 성공으로 세지 않는다.
- 수식/표/그림 합성4문항 A4 PDF2쪽도 공유 print 경로로 export해 PNG 시각 대조, 본문/화면 UI
  제외·텍스트 경계·폰트8개 임베딩을 확인했다. 최종 PDF는 head153bccf에서 다시 생성해 검토했고
  [안전 요약](../../audits/2026-10-28/r8-preview/pdf-visual-check.json)에 source head/바이트 SHA를 보존했다.
  로컬 샘플: `/Users/huryul/.codex/visualizations/2026/10/27/01a17c3f-65f5-74c0-879a-8245f9a0f683/pedagogy-print-check/output/pdf/preview-print-synthetic.pdf`.

## 새 채팅 재개 체크포인트

- [PR36](https://github.com/071205/pedagogy/pull/36) 최종 head `153bccf`의 Verify40660384414 필수4job·PR Sonar 통과 후 merge `9cff81d`로 병합했다. 병합 후 main Verify40664044913도 필수4job 모두 success다.
- Pages40664044930 success/built·핵심5파일 바이트 일치. 실제 공개 Pages에서 새 Chromium 문맥3개(PC/태블릿/모바일)·합성12문항6쪽의 처음/마지막 쪽·확대·원본 연결버튼 hit/높이·바깥 스크롤0을 확인했다. 실제 backend 요청은 차단했다.
- [CI](../../audits/2026-10-28/r8-preview/pr36-ci.json) · [main CI](../../audits/2026-10-28/r8-preview/main-ci.json) · [Pages](../../audits/2026-10-28/r8-preview/pages-verification.json) · [공개 UI](../../audits/2026-10-28/r8-preview/published-ui.json).
- 기존 guest worker는 갱신하지 않았다. 로컬 guest 산출물 검증과 공개 Pages 배포를 구별한다.
- 다음도 사용자가 고른 시험지 미리보기·출력 완성도를 우선한다. A1 추가 backend 자동 진행 보류, 실제 시스템 인쇄/한글·Safari/iPad·main Sonar 보안 출시 게이트·R7/R8 운영 전체는 미완료다. 이 기록의 후속 문서 커밋은 PR36 검증 head와 구별한다.
