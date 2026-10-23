# R8 연결 여정 로컬 감사 probe — 2026-10-23

보존 위치: `reviews/audits/2026-10-23/r8-connected-journey.mjs`와 같은 폴더의 이 `README.md`.
저장소 루트는 이 위치에서 상대 경로로 계산한다. 복사 전 임시 위치에서 검증할 때만
`R8_REPO_ROOT=/absolute/repo/root`를 지정한다. Playwright와 서버 lifecycle helper는
그 루트의 pinned `node_modules`와 `scripts/serve-static-staging.mjs`에서 로드한다.
기본 결과 폴더는 OS temp 아래의 새 `pedagogy-r8-*` 폴더다. `R8_OUT_DIR`로 별도
임시 결과 폴더를 지정할 수 있다. 기존 사용자 브라우저 프로필은 열지 않는다.

저장소 루트에서 정상 실행 한 명령:

```sh
node reviews/audits/2026-10-23/r8-connected-journey.mjs
```

한 화면 RED 대조 한 명령(종료 코드 1이 기대값):

```sh
R8_RED=drop-result-local node reviews/audits/2026-10-23/r8-connected-journey.mjs
```

이식 전 실제 검증은 `R8_REPO_ROOT`를 지정해 임시 파일을 실행했다. 정상 로그는
`/private/tmp/r8-2026-10-23/portable/normal.log`, 결과 JSON은
`/private/tmp/r8-2026-10-23/portable/normal/connected-journey.json`이다.
1194×834, 768×1024, 375×812 모두 `complete:true`, exit 0이었다.
RED 로그는 `/private/tmp/r8-2026-10-23/portable/red.log`, 결과 JSON은
`/private/tmp/r8-2026-10-23/portable/red/connected-journey-red.json`이다.
1194×834에서 `PM_SETS_V7:guest`의 결과 5권을 격리된 context에서만 제거해
6권→1권으로 만든 뒤, 재로드 결과 ID 보존 단언에서 `complete:false`, exit 1이었다.
두 실행 모두 임시 브라우저 close 및 소유 `serve.py` SIGTERM 정리가 기록됐다.

합성 guest 원본 8문항과 합성 PNG 원문 1쪽은 fixture로만 준비한다. 이후 라이브러리에서
보존 구성 초안 열기, 5권 요청(자동 제안 4권의 차이 확인), 오분류 이동·Undo,
원문 열기, 다섯째 목적지 수동 추가, 채택, 결과 편집기↔지면, 재로드·재진입은 UI 클릭으로
이어간다. 전체 plan snapshot과 목적지 문항 목록의 Undo 복구, 원본·결과 8문항의
고유 본문 payload(title·answer·desc·blocks) 보존, 결과 문항 ID의 별도 신규 발급과
중복·누락 없음, 다섯 결과 ID의 재로드 보존을 단언한다. 결과 행은 모두 guest 로컬 저장
상태여야 한다.

이 검사는 실제 PDF 추출, 실패 쪽/부분 채택, 새 편집 저장, 인쇄·한글 출력, 실계정·
클라우드 ACK, 실기기, 유료 AI, 인간의 첫 클릭·오조작·복구 관찰을 증명하지 않는다.
소유 127.0.0.1 `serve.py`, 임시 Playwright context만 사용하고 외부 요청을 차단한다.

세션 인계 마감 때 영구 경로에서 `R8_REPO_ROOT` 없이 정상 명령을 다시 실행해 세 화면 complete=true·exit0 및 브라우저/소유 서버 정리를 확인했다. 인계 로그: `/private/tmp/r8-2026-10-23/handoff-location.log`. 원래 정상/RED JSON은 같은 폴더의 `r8-connected-journey-normal.json`, `r8-connected-journey-red.json`에 보존한다.


## R8 추가 로컬 검증 — 편집 저장·Chromium PDF (2026-10-23)

기존 기본 명령/기존 정상·RED 자료는 유지한다. `R8_EDIT_PRINT=1`을 지정하면 같은
5권 구성 여정 뒤 결과 한 문항의 제목·정답·14줄 본문을 실제 UI로 수정한다.
이 기기 저장의 값 일치를 기다린 뒤 지면에 끝 표식이 반영되는지, 인쇄 UI의
정답 포함 경로가 준비를 마치는지 확인한다. `window.print()`만 계측 대역으로 바꾸고
Chromium의 실제 `page.pdf()`를 생성한다. PDF.js로 앱/출력 쪽수 일치,
본문 시작/끝·정답 표식 보존과 화면 링크 제외를 확인한다. 재로드 뒤 원본 8문항
불변·수정된 결과 payload·다섯 결과 권 ID 보존을 함께 확인한다.

```sh
R8_EDIT_PRINT=1 node reviews/audits/2026-10-23/r8-connected-journey.mjs
```

새 단언의 실패 주입(둘 다 예상 exit 1):

```sh
R8_EDIT_PRINT=1 R8_RED=drop-edit node reviews/audits/2026-10-23/r8-connected-journey.mjs
R8_EDIT_PRINT=1 R8_RED=blank-print node reviews/audits/2026-10-23/r8-connected-journey.mjs
```

`drop-edit`는 격리 guest의 저장된 편집 문항만 수정 전 값으로 돌린다. 재로드의
`after reload: result body payload` 단언에서 실패했다. `blank-print`는 인쇄 DOM의
본문만 비워 `PDF retains edited payload: R8-EDIT-BEGIN` 단언에서 실패했다.
실제 서비스 저장 장애나 출력 장애를 재현했다는 의미는 아니다.

영구 증거: [정상 JSON](r8-edit-print-normal.json), [편집 유실 RED](r8-edit-print-red-edit.json),
[빈 본문 RED](r8-edit-print-red-print.json), [합성 출력 표본](r8-edit-print-sample.pdf).
정상 1194×834·768×1024·375×812는 모두 complete=true/exit0이며 각 PDF는 A4 1쪽이다.
표본을 Poppler로 렌더해 12개 긴 본문 행·끝 표식·정답의 잘림/겹침이 없음을 확인했다.
두 RED는 각각 지정 단언에서 complete=false/exit1이고 소유 브라우저/서버는 정리됐다.
새 독립 Codex(`/root/r8_edit_print_review`, GPT-6 Sol / medium)가 실제 코드 diff,
정상/RED JSON, 표본 PDF의 text/page metadata를 대조해 이 좁은 범위에 추가 재현
결함 없음·병합 가능으로 판정했다. 구현자의 자기검증과 구분한다.

**범위:** 외부 요청을 전부 차단한 합성 guest 검사다. KaTeX 부재 확인창에서 명시적으로
계속을 선택하며 본문은 수식 없는 텍스트다. 따라서 오프라인 폰트 대체·Chromium PDF
결과이고 정상 CDN 글꼴/수식 출력, 실제 시스템 인쇄 대화상자·종이·한글 앱, 실계정 ACK,
실제 PDF 입력 추출, 유료 AI, 실기기 Safari/iPad와 인간 사용자 관찰을 증명하지 않는다.
R8 전체 운영 완료가 아니다. 임시 로그는 `/private/tmp/r8-edit-print-*.log`,
전체 세 크기 PDF는 `/private/tmp/r8-edit-print-2026-10-23/normal/`에 있다.


## R8 실제 PDF 원문 연결 — 수동 입력·렌더·재진입 (2026-10-23)

```sh
R8_SOURCE_PDF=1 node reviews/audits/2026-10-23/r8-connected-journey.mjs
R8_EDIT_PRINT=1 R8_SOURCE_PDF=1 node reviews/audits/2026-10-23/r8-connected-journey.mjs
```

helper `r8-pdf-source.mjs`는 결정적인 실제 2쪽 PDF(652바이트)를 만든다. 기존 결과 문항에
유효한 PNG 참조를 실제 UI로 먼저 연결한 뒤, filechooser·다른 탭 닫기 확인창·PDF.js
1쪽 파랑/2쪽 빨강 canvas 픽셀·2쪽 지정·기존 원문 참조 보존을 검증한다. 재로드 후에는
동일 source/question ID, Blob 바이트·SHA-256·참조를 대조하고 복수 원문 선택자로
같은 PDF 2쪽을 다시 열어 실제 빨간 픽셀까지 확인한다. PDF는 helper에서 재현 가능하며
Poppler의 2쪽 렌더로 파랑/빨강 입력을 별도로 확인했다.

새 실패 주입은 모두 예상 exit1이다.

```sh
R8_SOURCE_PDF=1 R8_RED=drop-pdf-source node reviews/audits/2026-10-23/r8-connected-journey.mjs
R8_SOURCE_PDF=1 R8_RED=blank-pdf-canvas node reviews/audits/2026-10-23/r8-connected-journey.mjs
R8_SOURCE_PDF=1 R8_RED=drop-prior-ref node reviews/audits/2026-10-23/r8-connected-journey.mjs
```

각각 격리 guest Blob 제거, 쪽 문구를 남긴 canvas 픽셀 제거, 격리 제공 HTML의 앱
assignSourcePage에서 다른 원문 참조 보존 제거다. 마지막 변이는 inline CSP를 재해시하며
저장소 제품 HTML은 수정하지 않는다. 목표 단언은 Blob 보존/2쪽 실제 픽셀/기존 참조 보존이다.

영구 증거는 `r8-source-pdf-normal.json`, `r8-source-pdf-combined.json`,
`r8-source-pdf-default-control.json`, `r8-source-pdf-red-blob.json`,
`r8-source-pdf-red-pixels.json`, `r8-source-pdf-red-prior.json`이다.
세 정상 모드는 각각 1194×834·768×1024·375×812 complete=true/exit0, 세 RED는
complete=false/exit1이며 소유 서버와 브라우저가 정리됐다. 독립 Codex가 기존 refs가
비어 공허하게 통과하던 검사 결함 REV-151을 발견했고 실제 PNG 참조 준비·비어 있지
않음 단언·앱 동작 변이 RED로 수정 후 재검증 합의했다. 같은 이슈 파일에서 resolved다.

**범위:** 외부 요청 차단, 합성 guest와 합성 PDF의 수동 원문 연결이다. PDF AI 추출,
실패 쪽/부분 채택, 유료 AI, 클라우드 ACK, 시스템 인쇄/한글 앱, Safari/iPad 또는 인간
사용자 관찰을 증명하지 않는다. R8 운영 완료가 아니다. 임시 전체 로그는
`/private/tmp/r8-source-pdf-verified-*.log`와 `r8-source-pdf-fixed-red-prior.log`에 있다.
