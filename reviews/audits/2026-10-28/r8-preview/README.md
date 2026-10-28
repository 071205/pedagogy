# R8 시험지 미리보기 — 2026-10-28

[동작](../../../../docs/R8-PREVIEW-PRINT-UX.md) · [HANDOFF205](../../../handoffs/2026-10/2026-10-28-index-r8-preview-navigation.md).
[수정 전](before-navigation.json)은 실제 guest의 합성12문항6쪽에서 좁은 화면 nav/zoom hit=false,
pane scrollTop>0을 보존한다. [최종 회귀](navigation-results.json)는 raw source의 새 컨텍스트에서
375/768/1194 각6쪽·원본 안내/긴 합성이미지·설정·경고 해결/Undo·확대/resize와 목표 RED10를 확인했다.
[소스/검사](verification.json), [최종 독립 검토](independent-review.md). PNG3개는 수정된 raw UI의
합성 자료이며 실제 사용자 데이터/인증은 없다. offline 안내는 검사에서 backend를 차단한 결과다.

원본 레이아웃용 이미지 주입은 file/IDB/PDF 저장 성공 증거가 아니다. 그 경로는 기존
sheet-source 정상16/RED17로 별도 검증했다. 기존 sheet-view17/RED14, 필수회귀175·JSON12,
PDF2쪽/본문 보존+print UI RED, public/CSP12·정적 검사 통과. 실제 OS 인쇄/한글·Safari/iPad는 미검증.

32/38줄의 짧은 fixture는 clip 아닌 shrink였고, 45줄/24긴줄은 한 쪽에도 남아 테스트 전제에
맞지 않았다. 최종20긴줄은 좁은 단의 실제clip→한 쪽의clip해소→Undo clip복구 선행조건을
직접 단언한다. 테스트 전제 실패를 제품 결함이나 통과로 세지 않는다.

[원본 영역 전후](source-flex-before-after.json): 첫 PR head bdf31ae의 guest 원본 영역12px/
버튼 hit=false를 재현했다. 최종 종이 flex-basis0 뒤 mobile153px/hit=true, 세 viewport
모두 hit=true다. `paper-flex-basis` 제거는 실제 사용성 목표에서 실패한다. 원본/종이 둘 중
하나만 남아도 통과하지 않도록 양쪽을 검사한다. 첫 CI40656600196은 이 최종 수정을 위해
취소했고 전체 통과로 세지 않는다. 최종 head의 CI는 별도 확인한다.

[최종 합성 PDF 대조](pdf-visual-check.json)는 head153bccf의 공유 print 경로를 사용했다. A4 2쪽/4문항·수식23개·표1개·정상 이미지1개, 조판 넘침0/글꼴 준비 문제0, 본문 보존·화면 UI 제외·텍스트 페이지 경계·폰트8개 임베딩·PNG2쪽 시각 검토를 확인했다. 실제 시스템 인쇄 검증은 아니다.

PR36 head153bccf 필수CI4개/PR Sonar·merge9cff81d의 main CI4개 및 Pages 완료. [PR CI](pr36-ci.json) · [main CI](main-ci.json) · [배포 바이트](pages-verification.json) · [실제 공개 UI 3화면](published-ui.json). 공개 UI는 backend 요청 차단·합성 문항이며 기존 guest worker는 갱신하지 않았다.
