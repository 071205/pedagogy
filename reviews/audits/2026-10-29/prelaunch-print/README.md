# 출시 전2 — 로컬 저장·Chrome/Safari·한글 실제 출력

2026-10-29 · Chrome/Safari는 main9cff81d와 동일 코드. 아래 한글 쪽수 오류 REV158은 수정 포함.

## 새로 확인한 공백

- 새 임시 Chrome 프로필·합성4문항(수식/선지/표/직사각형 그림) JSON 파일을 실제 import input으로 불러왔다. 본문 textarea 수정→저장→새로고침의 편집기 자동 복원→JSON 내보내기 내용 전체 deepEqual 통과. ID·4문항·정답·그림 보존. 미리보기2쪽/fontProblems0.
- 자동검사는 모든 backend 요청 차단(CDN 정적 자원만 허용), 생성한 프로필/서버 정리 성공. 검사 파일은 세션용 probe이며 정규 CI 검사가 아니다. 처음2회는 자동 편집기 복원·배열형 JSON export를 잘못 가정해 실패했고 하네스만 수정했다. 제품 결함으로 등록하지 않는다.
- 별도 일반 Chrome의 localhost:8896에서는 자동검사 export 파일을 **native 파일선택창**으로 불러와 4문항·수정본문을 화면에서 확인했다. 로그인하지 않은 로컬 모드다. 이 부분은 backend 전면 차단 네트워크 검사가 아니며 원격 계정/ACK를 입증하지 않는다.
- 앱 인쇄→정답 포함→실제 Chrome 인쇄 미리보기에서 페이지2쪽·대상PDF로 저장·여백없음/시트당1쪽·배경그래픽OFF 확인. 실제 저장 대화상자로 출력했다. 실제 프린터 전송은 없다. 저장 뒤 앱 편집기와 수정본문 유지 확인.
- Poppler pdfinfo: Chrome156/Skia m156 생성, A4 594.96×841.92pt·2쪽·64,508bytes. 4문항·4정답·수정본문 보존, 화면용 로그인/skip-link/불러오기 문자열 없음. 텍스트bbox 모두 페이지 안, 폰트8개 모두 embedded. PNG2쪽의 수식/표/그림/쪽번호를 시각 대조했다.

[로컬 저장/재진입](local-journey.json) · [native PDF 검증](native-print-verification.json) · [합성 입력](synthetic-fixture.json).
[세션 probe](local-journey-probe.cjs)는 당시 호스트 절대경로·CDN 의존이며 독립 재사용 시 경로/포트/정리 확인 필요.

PDF: `/Users/huryul/.codex/visualizations/2026/10/27/01a17c3f-65f5-74c0-879a-8245f9a0f683/prelaunch-journey/output/pdf/prelaunch-print-native.pdf`.

## 재사용·남은 범위

구성/Undo/채택/로그인ACK는 HANDOFF197, 긴 문항/원문/복구/3화면은200/202/205 증거 재사용. 이번에 같은 전체 검사를 반복하지 않았다.
실제 Chrome/Safari 로컬 여정과 Mac 한글 시험지 출력 공백을 보완했다. iPad/iOS·Windows 한글·범용 문서 경로/전체 지원 범위·인간 사용자 관찰은 별도 미결이다. 계정·이미지 원격 검증/AI/출시 호스트 전환 증거로 확대하지 않는다. Chrome/Safari 여정만으로는 제품 변경이 없었다. REV158 수정에는 아래 필수 회귀/실패 주입·독립 검토를 적용했다.

## 실제 Safari 추가 확인

[safari-native-verification.json](safari-native-verification.json): Chrome export 합성4문항을 native 파일선택창으로 불러오기→상단문구 수정/저장→새로고침 복원→앱 인쇄→실제 macOS 인쇄창 A4/100%/2쪽·브라우저 머리말꼬리말OFF→PDF저장/앱복귀 확인. Safari PDF2쪽 PNG 시각 대조에서 수식/표/그림·정답 보존. 파일선택/저장 활성 상태의 도구 지연은 fresh AX/키보드 선택으로 해결됐고 제품 결함으로 등록하지 않았다. iPad/iOS·실계정·실프린터 검증은 아니다.

## 실제 Mac 한글·REV158 수정

[검증 JSON](hwpx-native-verification.json). 기존 시험지 정합 표본9문항을 실제 한글에서 PDF로 저장하니3쪽인데 분모는 원본20이었다. 정상 parity가 함께 틀리는 공백이라 REV158로 등록했다.

한글 입력→상용구→전체 쪽수로 별도 문서를 직접 저장해 `autoNum numType="TOTAL_PAGE" num="1"` 구조를 확인했다([공식 도움말](https://help.hancom.com/hoffice_mac/2022/ko-KR/hwp/insert/autotext/all_page_number.htm)). 실험 표본의 바탕쪽 분모만 이 필드로 바꾸자1/3·2/3·3/3이 인쇄됐다. 계획 쪽나눔 집계를 전체 쪽수로 쓰지 않는다.

제품은 JS/Python 틀 열기에서 **바탕쪽 PAGE 문단+숫자만 있는 분모 문단의 쪽번호 셀**만 전환한다. 원본 틀 자산은 보존하며 이후 실제 한글 조판이 총수를 계산한다. 수정 생성물은 기존 표본과 바탕쪽4파트만 다르고 다른 파트는 bytes 동일하다. 실제 한글에서 고유 파일명으로 열어3쪽 PDF·9문항/수식/표/그림·고의 그림 누락 안내/선택 기하를 시각 대조했다. 다른 이름 저장→닫기→재열기→PDF도3쪽, 3쪽 PNG 모두 수정본과 bytes 동일·TOTAL_PAGE 유지다.

- 정상: [시험지 parity](hwpx-fixed.log), 바탕쪽 전체 구조/속성/텍스트 + PAGE4/TOTAL_PAGE4/고정 숫자 없음.
- 실패 주입: [브라우저](hwpx-red-browser.log)·[Python](hwpx-red-python.log)·[양쪽](hwpx-red-both.log) 전환을 각각 끄면 exit1. 양쪽이 함께 틀리는 경우도 기대값 검사로 잡는다.
- 기존 필수: [HWPX12묶음](hwpx-suites.log)·[문서 브라우저 정합](document-browser-parity.log)·정적 검사·[회귀175/175](regression.log).
- 독립 진단 [Claude](claude-diagnosis.md)의 '필드 미증명/양식 결정' 의견은 **그 당시 근거**다. 이후 native 필드 실험으로 기존 양식을 유지하는 해법을 증명했다. 최종 검토는 인계207에 기록한다.

Windows 한글·실제 프린터·계정 동기화·AI 성공의 증거로 확대하지 않는다. 초기 동명 `browser-exam.hwpx`는 이미 열린 구본을 재선택한 도구 실수여서 고유명 수정본으로 재검증했다. 실제 결과와 이 도구 혼동을 구분한다.

## 사용자 지적·제목 가운데 정렬 (REV159)

3쪽 선택과목 제목은 원본 양식의 JUSTIFY+앞공백으로 배치돼 짧은 기하로 바꾸자 중심이 왼쪽으로 치우쳤다. [native 측정/해시](hwpx-centering-verification.json): 수정 전 ink중심329.5px/종이380px. 제목 단독 문단만 공유 서식의 CENTER 사본으로 바꾸고 앞공백/줄 캐시를 제거했다. 실제 한글3쪽의 ink중심377.5/380/379px, 원본 공유 서식5/24는 JUSTIFY 유지·본문9문항과 정확한 쪽수 보존. 다른 이름 저장/닫기/재열기 PDF3쪽 PNG도 동일하다. 정상 제목4개/공유 서식·Python/JS 정합과 [브라우저](center-red-browser.log)/[Python](center-red-python.log)/[양쪽](center-red-both.log) RED가 각각 실패했고 필수 회귀175/HWPX12/정적도 통과했다.

REV158은 [최종 독립 합의](claude-total-final.md) 완료. REV159도 [정정 최종 합의](claude-center-final.md) 완료. 초기 의견의 후행공백 추정·검사시점 전제는 [실제 생성물](center-exact-subjects.json)로 정정받았다. 최초240s timeout과 inline 검토/정정 성공을 구별하며, 새 근거 없는 재검토는 하지 않았다. 사용자가 정리를 요청한 완료 시험 창5개를 닫았고 현재 한글 창은1개다.

## 일반 문서 native 출력 공백 추가 보완

[일반 문서 검증](document-native-verification.json)·[생성/정합 로그](document-builder-native-fixtures.log): 기존 document-sample/extra-blocks/page-notes 브라우저 생성물을 실제 Mac 한글에서 열어 PDF저장→다른 이름 저장→닫기→재열기→PDF로 대조했다. 표본3종/총4쪽: 표·상자·보기·선지·행렬/경우/극한 수식·각주1/2·명시적 쪽나눔·머리말/꼬리말 표시. 재열기 PDF의4쪽 PNG 모두 원출력과 bytes동일. 새 제품 변경/결함은 없다. 검증 후 한글 앱은 종료해 시험 창0개다. 브라우저 조판기→native 출력 검증이며 실제 로그인/클라우드/문서 복귀·UI 파일다운로드/iOS·Windows/실프린터까지 검증했다고 확대하지 않는다.

## PR·원격 반영

[PR38 head e3b402f CI](pr38-ci.json): 필수4개와 PR Sonar 성공 후 squash merge0fbe604. [Pages40831760039](pages-verification.json) built/주요7파일 bytes동일. [공개 HWPX](published-hwpx.json): 실제 공개 mock editor의 조판기로 합성9문항 생성, 저장ZIP에 PAGE4/TOTAL_PAGE4·제목4 CENTER/공백0·공유5/24 JUSTIFY 보존. backend 요청 차단한 새 Chromium 문맥이며 실제 native 검증은 위 별도 증거와 연결한다. guest Worker를 갱신한 것은 아니다.

Sonar 새7건은 [CODE_SMELL](sonar-new-maintenance.json): 문자열 상수/함수복잡도/문자클래스/list 사본 권고. 새 보안 finding이 아니며 gate통과. 특히 순회 중 XML을 변경하는 list 사본과 Python의 ASCII 숫자 범위는 검사 권고만 보고 바꾸지 않았다. M1에서 근거가 있을 때 정리한다. 병합 main CI 상태는 인계207을 따른다.

## 공개·로컬 문서 편집기 버튼과 안내 (REV160)

[공개 UI](document-public-ui.json): 공개 문서 편집기에서 합성 JSON 검증·미리보기→실제 HWPX 버튼 다운로드 성공. backend/localhost 차단 문맥의 파일 ZIP 모든 파트가 위 native 검증의 기본 문서 표본과 bytes동일하다. 이 과정에서 로컬 서버 필수라는 낡은 안내를 재현했다. 브라우저 직접 생성 우선/실패 시 로컬 서버 시도로 안내를 고쳤다. 같은 화면에서 각주·쪽 나눔·머리말·꼬리말을 미지원으로 잘못 쓴 베타 안내도 실제 지원 범위에 맞췄다. [수정 후 로컬 UI](document-local-guide.json)에서 새 문구 표시·구 서버 필수 문구 없음·다운로드 성공·ZIP 11파트 동일, 페이지 오류0. [두 문구 렌더](document-local-copy.json)에서 상충한 베타 안내도 사라졌다. [Claude 독립 검토](claude-document-guide-final.md)는 실제 제어 흐름과 문구가 일치하며 차단 의견 없음. 공개 Pages에는 후속 PR 병합 전까지 옛 문구가 남아 있다.

## PR38 병합 main 최종 검사

[main CI](pr38-main-ci.json): merge0fbe604의 verify·cross-platform·hwpx·secrets 4개 모두 success. [main Sonar](pr38-main-sonar.json): 같은 revision의 Quality Gate OK/new_security_rating=1. 이는 기존23건 판정 뒤의 최신 분석 결과다.

## 문서 그림 검증·누락 방지 (REV161)

[기존 브라우저 재현](document-image-loss-repro.json): 합성 GIF image.data를 validate가 받았지만 HWPX에서 그림 BinData0·경고1이었다. Claude의 베타 문구 [독립 검토](claude-document-beta-review.md)에서 나온 단서를 직접 재현했다. 브라우저 image 검증에서 base64·2.5MiB 한도·PNG/JPEG 바이트/양수 크기를 출력 전에 확인하고, Python 문서 계약도 24바이트 이하/0픽셀을 거부하게 했다. 브라우저 엔진을 못 불러오면 로컬 서버의 검증/출력 대체 경로를 유지한다. 지원 문구를 PNG·JPEG base64로 한정했다.

[의도한 RED](document-image-red.log)는 수정 전 GIF를 받아 exit1. [정상/정합](document-image-browser-parity.log)은 미지원5종 브라우저·Python 모두 거부, 정상 PNG/JPEG 각각 BinData 포함 12파트·조판 신호/ZIP 정합. [실제 로컬 UI](document-image-local-ui.json)는 GIF 사전 거부·PNG/JPEG 미리보기 표시/다운로드 성공, [엔진 차단 시 로컬 서버 경로](document-image-server-fallback.json)는 PNG BinData1 포함해 성공했다. [HWPX12](document-image-hwpx-suites.log)·[Python 문서](document-image-python.log)·[CSP](document-image-csp.log)·[정적](document-image-static.log)·[공개 빌드](document-image-public.log)·[브라우저 회귀175](document-image-regression175.log) 통과. 실제 한글에서 일반 문서 그림 표본을 별도로 열어 본 증거는 아니므로 그 범위로 확대하지 않는다. [Claude 첫 의견](claude-document-image-first.md)의 폴백/서버 검사 지적을 반영했고 [최종 독립 검토](claude-document-image-final.md)에서 재현 가능한 차단 결함 없음. 첫 후속180초 timeout은 검토 완료로 세지 않았다. 오류 표현/검사 상수·그림 치수 비교는 비차단 후속 관찰이다.

## PR40 첫 Sonar 유지보수 게이트와 수정

[첫 분석](pr40-initial-sonar.json): head ac882c9의 새 보안·신뢰성 평가는 1/OK였으나, 기존 한 줄짜리 `validate`를 수정하자 함수 전체가 새 코드가 되어 유지보수성 4/ERROR·CODE_SMELL 52건으로 차단됐다. 정책/품질 게이트를 바꾸지 않고 원래 검증 함수 줄을 main과 동일하게 되돌린 뒤, 정규화된 결과의 image 블록만 `window.validate` 래퍼에서 검사한다. [Claude 독립 재검토](claude-document-image-wrapper-final.md)는 모든 사용자 호출 경로·PNG/JPEG/GIF·서버 폴백 보존에 합의했고, 제안에 따라 함수 선언 직접 재할당 대신 전역 프로퍼티를 갱신했다. 이후 [브라우저/Python 정합](document-image-browser-parity.log)·[CSP](document-image-csp.log)·[정적](document-image-static.log)·[공개](document-image-public.log)·[회귀175](document-image-regression175.log)·실제 UI/폴백을 재확인했다. PR 최신 head의 Sonar/CI 결과는 인계207에 이어 기록한다.
