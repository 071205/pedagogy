# PEDAGOGY 코드 탐색 지도

기준: 2026-09-13 작업 트리, `index.html` 8,075줄·461,948바이트. 이 문서는 전체 파일 목록이나
토큰 수 추정이 아니다. 유지보수 질문에서 먼저 읽을 파일·검색어·검사와 첫 분리 판단 근거를 남긴다.
줄 번호는 변하므로 함수·검색어를 함께 쓴다. 새 작업은 영향 항목만 갱신한다.

## 먼저 확인할 공통 경계

| 경계 | 먼저 볼 곳·검색어 | 이유 |
| --- | --- | --- |
| 로딩·공개 표면 | `index.html`의 `pedagogy-normalize.js`, `PedagogyRender`, `PedagogyPrint`; `scripts/build-public.mjs`의 `PUBLIC_INPUTS`, `SCRIPT_COUNTS` | 외부 classic script 순서와 `window` 표면은 계약이다. 새 파일은 공개 빌드 목록에도 넣어야 한다. |
| 신뢰 경계 | `pedagogy-normalize.js`: `normBlock`, `normProblem`, `normSet`, `safeUrl`; `index.html`: `reportNormDropped` | 가져오기·클라우드·AI 응답은 여기서 정규화한다. UI 모듈로 옮기지 않는다. |
| 전역 상태 | `index.html`: `sets`, `currentSetId`, `currentQId`, `currentUser`, `authEpoch`, `fbReady` | 저장·인증·동기화 함수가 이 상태를 공유한다. 첫 분리에서 이 묶음을 다시 설계하지 않는다. |
| file://·공개 산출물 | `scripts/check-public-browser.mjs`, `scripts/check-review-contracts.mjs`, `scripts/build-public.mjs` | ESM 전환은 하지 않는다. 일반 script와 공개 CSP가 `file://` 부팅을 유지해야 한다. |

## 기능별 진입점

| 유지보수 대상 | 주 파일·검색어 | 직접 관련 검사 |
| --- | --- | --- |
| 문제집 저장·동기화·계정 전환 | `index.html`: `loadSets`, `watchCloud`, `saveSets`, `writeCloudSnapshot`, `sessionContext`, `sessionMatches` | `npm run test:cross:fast`, `npm run test:review-contracts`, `npm run test:audit-browser` |
| 문제집·모의고사 라이브러리 | `index.html`: `renderLibrary`, `loadLibraryPrefs`, `renderMockLibrary`; `mock-library-store.js`: `MockStore` | `npm run test:library-ui`, `npm run test:mock-library-ui`, `npm run test:mock-library` |
| 문항 목록·블록 편집 | `index.html`: `showEditor`, `renderQList`, `renderEditor`, `blankBlockData`, `convertBlock` | `npm run test:cross:fast`, `tests/regression-test.html` |
| 미리보기·안전 HTML | `index.html`: `renderPreview`, `pvMeasure`, `pvSetZoom`; `pedagogy-render.js`: `blockHTML`, `groupHeadHTML`, `fitMathIn` | `npm run test:cross:fast`, `npm run check:static`, `npm run test:public-browser` |
| 인쇄 | `index.html`: `doPrint`, `fitPrintDoc`; `pedagogy-print.js`: `buildPrintDoc`, `awaitPrintImages` | `npm run test:hwpx-exam`, `npm run test:cross:fast` |
| 이미지 저장 | `index.html`: `storeImageFile`, `uploadBlobToStorage`, `releaseImage`, `dataUrlToJpegBlob` | `npm run test:cross:fast`, 저장 영향 `tests/regression-test.html` |
| 사진 AI 변환 | `index.html`: `confirmAiTransfer`, `prepImageForAI`, `aiBlocksToProblem`, `aiGenerateFromImage`; `worker/index.js`: `callAI` | `npm run test:worker`; 브라우저 영향 `npm run test:cross:fast` |
| 문서 AI·HWPX | `document-editor.html`, `hwpx-engine.js`, `hwpx-document.js`; Worker `callDocumentAI` | `npm run test:worker`, `npm run test:hwpx-browser`, `npm run test:cross:fast` |
| 로그인·App Check | `index.html`: `initFirebase`, `getAiAppCheckToken`, `onAuthStateChanged`; `worker/auth.js`, `worker/app-check.js` | `npm run test:worker`, `npm run test:auth-navigation` |

## 고정한 탐색 기준선

아래는 실제 업무가 아닌 같은 구조를 비교하기 위한 합성 질문이다. 답을 이미 안다고 전체 파일 재탐색을
하지 않는다. DEV-5에서 같은 질문으로 파일·범위·재탐색 횟수만 비교하며, 이를 실제 토큰 절감으로 환산하지 않는다.

| 질문 | 현재 첫 탐색 경로 | 읽어야 할 경계 |
| --- | --- | --- |
| “사진 AI 변환에서 인증·전송 동의·이미지 축소·응답 반영은 어디서 처리되는가?” | `rg aiGenerateFromImage` → index의 `confirmAiTransfer`~`aiGenerateFromImage` → Worker `callAI` | index의 약 6731~6909, `getAiAppCheckToken`, `dataUrlToJpegBlob`, `normProblem`, `sets/currentSetId` |
| “미리보기 확대가 문제집 저장·동기화와 독립적인가?” | `rg pvSetZoom` → index의 `pvMeasure`~`pvApply` → `renderPreview` | preview DOM·`pvZoom/pvNat/pvFitted`; 문제 데이터는 `renderPreview`의 입력 경계까지만 |

## 첫 분리 후보 — 아직 선택하지 않음

| 후보 | 근거·예상 탐색 절감 | 결합·검사 부담 | DEV-2가 확인할 것 |
| --- | --- | --- | --- |
| A. AI 요청 준비·응답 변환 | `confirmAiTransfer`~`aiBlocksToProblem`은 약 80줄의 목적이 명확한 경계다. OPS-6~10의 Worker 작업도 같은 기능을 다시 읽게 되므로 재탐색을 줄일 가능성이 있다. | `dataUrlToJpegBlob`, `fileToDataURL`, `normProblem`에 의존. 실제 요청·상태 반영은 `currentUser`, `sets`, 렌더·저장에 얽혀 있다. | 순수 준비/변환만 추출할지, DOM 상태 변경은 본체에 남길지. 입력 adapter와 오류 계약. |
| B. 미리보기 확대 제어 | `pvMeasure`~`pvApply`은 독자적인 DOM 상태 묶음이며 저장·인증 상태를 직접 바꾸지 않는다. 약 250줄의 화면 제어 문맥을 본체에서 제외할 여지가 있다. | `renderPreview` 직후의 초기 측정 순서와 `#pvContent/.preview` DOM 계약, 키보드·휠 이벤트를 유지해야 한다. | 실제 함수 범위, 공개 이름 유무, `renderPreview`와의 callback 경계, Chromium·Firefox·WebKit 검증. |
| C. 블록 편집기 렌더 | `renderEditor`는 가장 큰 단일 탐색 구간이라 향후 편집 기능 변경의 읽는 범위를 크게 줄일 수 있다. | `activeQ`, `saveSets`, history, 이미지 업로드, Sortable, 미리보기, AI drop zone과 직접 연결돼 첫 분리 위험이 높다. | 첫 후보로 적합하지 않다면 하위 블록 종류 하나만 안전하게 분리할 수 있는지. |

현재 수치만으로 “최근 수정 빈도”를 확정하지 않았다. `git log -S` 탐색은 `REV-2026-074`의 깨진
`refs/codex/.../Icon?` 때문에 `fatal: bad object`로 중단됐다. 이 지도는 현재 함수 경계와 2026-09
구조 인계의 증거를 사용한다. 이슈 074를 해결한 뒤에만 이력 빈도를 보강한다. 실계정 재현이 필요한
로그인 이슈 075도 열린 상태로 유지하며, AI·문서·인증 경계 작업에서만 관련 재현을 추가한다.

## 다음 단계에 넘길 결론

DEV-2/Astra high는 후보 A·B·C 중 하나를 고르거나 분리 보류를 결정한다. 저장·동기화·인증 전체,
ESM 전환, 프레임워크 도입은 선택 대상이 아니다. 선택할 때 상태 읽기/쓰기, DOM·이벤트 순서,
window 계약, 공개 빌드·CSP·file://, 관련 회귀와 실패 주입, 추출만 되돌리는 파일 묶음을 설계한다.
