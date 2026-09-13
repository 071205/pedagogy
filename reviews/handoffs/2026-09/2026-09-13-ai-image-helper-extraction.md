# 변경 인계 — DEV-3 AI 이미지 경계 추출

- ID: `HANDOFF-2026-131`
- 날짜: `2026-09-13`
- 작성자: `Codex`
- 상태: `reviewed`
- 영향 영역: `index`, `server`, `tests`, `docs`
- 관련 이슈: `없음` (열린 `REV-2026-074`, `REV-2026-075` 유지)

## 변경 내용

`index.html`의 AI 이미지 전처리와 AI 응답→문항 변환 53줄을 새 classic script
`pedagogy-ai-image.js`로 옮겼다. 모듈은 `window.PedagogyAIImage.create` factory 하나만 공개하고,
`fileToDataURL`, `dataUrlToJpegBlob`, `normProblem`을 호출 시점에 주입받는다. DOM·fetch·Firebase·저장·사용자
상태에는 접근하지 않는다.

본체는 기존 `prepImageForAI`, `aiBlocksToProblem` lexical 함수를 얇은 wrapper로 유지했다. 따라서 기존 호출과
`regression-test.html`의 lexical hook은 그대로 쓸 수 있다. 1568/0.8, JPEG 변환 실패 안내, 허용 블록 변환,
선택지 다섯 개 보정과 최종 `normProblem` 호출도 보존했다. AI 전송 동의·App Check·HTTP·quota·응답 상태 반영은
이동하지 않았다.

새 파일은 `index.html`에서 본체 inline script보다 먼저 읽고, `scripts/build-public.mjs`와 `serve.py` 허용 목록에
추가했다. `scripts/check-ai-image.mjs`와 `npm run test:ai-image`는 factory 계약, 실제 canvas 전처리, HTTP와
`file://` classic loading, JPEG 변환 실패 및 누락 의존성을 확인한다. 이 검사는 `normProblem` 호출을 제거한 변이를
별도 프로세스에서 주입해 AssertionError가 나는지도 확인한다.

## 검증

- `node scripts/check-ai-image.mjs` 통과: HTTP/file, 주입 계약, 실제 전처리, 실패 경계 통과. 정규화 우회 변이는 예상대로 AssertionError.
- `node scripts/build-public.mjs` 및 `node scripts/build-public.mjs --check` 통과: 공개 산출물 23개.
- `npm run test:audit-browser` 통과: `regression-test.html` 158/158, JSON malformed 요청 12건 거부·서버 정상.
- `npm run test:cross` 통과: Chromium 데스크톱·태블릿·아이패드·휴대폰 및 저장/인쇄/접근성 경로.
- `PUBLIC_ENGINES=chromium,firefox,webkit npm run test:public-browser` 통과: 세 엔진의 공개 산출물, strict CSP red probe, `file://`, HWPX, private 404.
- `git diff --check` 통과.
- `npm run check:fast`는 새 검사 이전 단계의 `npm run check:icons`에서 중단했다. 열린 `REV-2026-074`의 `.git/refs` 안 macOS 아이콘 107개가 원인이며, 이 작업에서 해결하거나 우회하지 않았다.

## 다음 작업자에게

DEV-4/GPT-5.6 Sol medium은 HANDOFF-130 설계, 이 diff, `pedagogy-ai-image.js`와 `scripts/check-ai-image.mjs`를
독립적으로 대조한다. 재현 가능한 결함만 이슈로 열고, 결함이 없으면 이 인계의 결과만 승인 기록으로 남긴다.
다른 추출 후보·Worker·quota·max_tokens·공급자·배포에는 착수하지 않는다. `transcript.txt`는 사용자 미추적 파일로 유지한다.

## 독립 검토 결과 (2026-09-13)

승인한다. `bc9c6f9`의 실제 diff를 HANDOFF-130 설계와 대조하고 핵심 회귀를 다시 실행했다.

- 이동된 구현은 기존 53줄의 상수·오류 문구·블록 변환·선택지 보정·최종 `normProblem` 호출을 유지한다.
- `PedagogyAIImage.create`는 명시한 세 함수만 주입받으며 DOM·fetch·Firebase·저장·사용자 상태를 읽지 않는다.
- 본체의 `prepImageForAI`, `aiBlocksToProblem` 함수와 `AI_MAX_DIM`, `AI_QUALITY`, `blobToBase64` lexical 계약이 유지된다.
- 새 script가 본체보다 먼저 로드되고 공개 빌드·로컬 서버 목록에 포함된다. AI 동의·인증·HTTP·quota·상태 반영은 이동하지 않았다.
- `npm run test:ai-image`를 독립 재실행해 HTTP·`file://`·실제 canvas 전처리·실패 경계를 확인했다.
  `normProblem` 우회 변이는 정상 실행 실패가 아니라 기대한 `AssertionError`로 검출됐다.
- 재현 가능한 새 결함은 없었다. 제품 코드와 검사는 수정하지 않았으며 DEV-5 효과 확인으로 넘긴다.
