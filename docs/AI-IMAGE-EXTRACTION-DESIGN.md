# DEV-2 — AI 이미지 전처리·응답 변환 추출 설계

2026-09-13 · 설계 기준 `8650e7a` · 구현 기준 `fb9b946` · 상태: DEV-3 구현 완료, 독립 검토 전.
결정: 후보 A의 일부를 `pedagogy-ai-image.js` 하나로 추출했다. 다음 DEV-4/Sol medium.
이 문서는 구현 경계를 정하며 제품 동작 변경·배포 승인을 의미하지 않는다.

## 선택 근거와 효과 한계

| 후보 | 현 소스에서 확인한 경계 | 판단 |
| --- | --- | --- |
| A 중 전처리·변환 | index 6758~6810: 53줄/3,073바이트. 의존 함수 3개, FileReader 사용. 인증·저장·DOM 상태 접근 없음 | 선택. 이미지 표현과 공급자 응답→문항 계약을 독립적으로 읽고 시험할 수 있음 |
| B 확대 제어 | 핵심 6962~7005: 44줄/1,735바이트. 추가로 renderPreview·폭 조절·탭·버튼·휠이 pvZoom/pvFitted를 직접 읽고 씀 | 보류. 지도에 있던 약 250줄은 하나의 연속된 독립 확대 모듈이 아님 |
| C renderEditor | 5956~6724: 769줄/43,738바이트. 데이터 수정·저장·비동기 이미지·이벤트 결합 | 첫 추출에서 제외. 읽기 이득은 크지만 동작 변경 위험·검증 부담도 큼 |

`git log HEAD -L :함수:index.html --no-patch`는 성공했다. prepImageForAI는 3개, aiBlocksToProblem은
2개, pvMeasure는 1개, renderEditor는 32개 커밋이 반환됐다(함수 도입 포함 전체 HEAD 계보, 최근 빈도 아님).
A가 가장 자주 바뀐다는 근거는 없다. 최근 index 변경에는 표·선지·라이브러리 작업이 많다.
이번은 큰 절감이 아닌 작은 경계 추출의 첫 사례다. 53줄 모두가 순감소하지 않으며 연결 코드·검사 비용이 추가된다.
DEV-5에서 순이익이 불명확하면 후속 추출을 하지 않는다. OPS의 Worker 작업에 이 파일 전체를 항상 읽도록 하지 않는다.

## 옮길 것과 본체에 남길 것

- 이동: blobToBase64, AI_MAX_DIM=1568, AI_QUALITY=0.8, prepImageForAI, aiBlocksToProblem의 구현.
- 본체 유지: fileToBase64(현재 호출 검색 결과 없음, 이번에 제거하지 않음), fileToDataURL,
  dataUrlToJpegBlob, confirmAiTransfer, aiStatus, AI_PROXY_URL, aiGenerateFromImage와 모든 이벤트 등록.
- `normProblem`은 pedagogy-normalize.js의 기존 신뢰 경계를 그대로 호출한다. 복사·생략하지 않는다.
- 동의·로그인·App Check·20MB 제한·HTTP 처리·대상 문제집 확인·문항 반영·저장·포커스·오류 안내는 변경하지 않는다.
  기존 비동기 동작에 별도 결함이 재현되면 같은 추출에 숨겨 고치지 않고 이슈·후속 경계로 분리한다.

## 모듈과 호출 계약

새 파일은 기존 모듈과 같은 IIFE classic script다. 외부 공개는 `window.PedagogyAIImage.create` 하나다.
모듈 로드 시 DOM 조회·이벤트 등록·FileReader 실행·fetch·저장·로그 출력은 없다.
`create({fileToDataURL, dataUrlToJpegBlob, normProblem})`는 인스턴스를 반환한다.
반환 항목: AI_MAX_DIM, AI_QUALITY, blobToBase64, prepImageForAI, aiBlocksToProblem.
의존 함수 누락은 생성 시 명확한 예외로 드러내고, 원문이나 사용자 식별자를 오류에 붙이지 않는다.

index의 기존 blobToBase64 선언 위치에서 인스턴스를 한 번 만든다. 주입은 아래처럼 호출 시 본체 이름을
조회하는 작은 wrapper로 하여 기존 테스트의 함수 대체와 일치시킨다(함수 결과를 미리 계산하지 않음).

```js
const aiImageTools = window.PedagogyAIImage.create({
  fileToDataURL: file => fileToDataURL(file),
  dataUrlToJpegBlob: (url, maxDim, quality) => dataUrlToJpegBlob(url, maxDim, quality),
  normProblem: value => normProblem(value),
});
const { AI_MAX_DIM, AI_QUALITY, blobToBase64 } = aiImageTools;
async function prepImageForAI(file) { return aiImageTools.prepImageForAI(file); }
function aiBlocksToProblem(p) { return aiImageTools.aiBlocksToProblem(p); }
```

생성 전에 namespace 누락을 검사해 파일명을 포함한 명확한 오류를 내고 정규화 우회 fallback은 두지 않는다.
필수 스크립트가 누락되면 이 위치 이후 초기화가 중단될 수 있다. 정상 산출물의 누락을 공개 빌드 검사로 잡는다.
원래 function인 prepImageForAI·aiBlocksToProblem은 window 속성으로 유지한다. 상수와 blobToBase64는
전역 lexical 이름을 유지하며 window 속성으로 새로 올리지 않는다. tests/regression-test.html의 installHooks를 유지한다.

| 함수 | 기존 계약 유지 |
| --- | --- |
| blobToBase64(blob) | FileReader로 data URL을 읽고 콤마 뒤 base64 반환. 실패 메시지 “이미지 변환 실패” 유지 |
| prepImageForAI(file) | fileToDataURL → dataUrlToJpegBlob(url,1568,0.8) → base64. {base64,mimeType:"image/jpeg",bytes:blob.size} 반환 |
| 전처리 실패 | 읽기 rejection을 전파하고 JPEG 변환 null이면 기존 형식 안내 오류. 원본 전송으로 대체하지 않음 |
| aiBlocksToProblem(p) | 허용된 블록만 변환, 선택지 5개 채움/자름, 빈 결과 statement 기본값, 마지막 normProblem 호출 유지 |

주입 경계는 문항 상태를 전달하지 않는다. normProblem의 ID 생성·길이 제한·공유 정규화 상태 등 기존 부수 효과도 유지한다.
외부 API 스펙·화질 한도에 대한 새 주장을 추가하지 않는다. 기존 1568/0.8은 이 추출의 동작 보존값이다.

## 로딩·변경 파일·복귀

- index: mock-library-store.js 뒤, 기존 본체 인라인 script 앞에 새 외부 script를 둔다. defer/async/type=module 금지.
- scripts/build-public.mjs의 PUBLIC_INPUTS에 새 파일을 추가한다. 인라인 script 수는 여전히 3이므로
  SCRIPT_COUNTS를 바꾸지 않는다. CSP 완화·eval·새 네트워크 출처 추가 없음.
- 코드 변경 파일: index.html, 새 pedagogy-ai-image.js, scripts/build-public.mjs.
  검사 변경: 새 scripts/check-ai-image.mjs, package.json. 필요 시 기존 빌드 검사에 기대 파일 목록만 반영한다.
- package.json에 test:ai-image를 추가하고 check:fast에 연결한다. 문서는 CODE-MAP·레일·새 구현 인계를 갱신한다.
- 한 추출 커밋으로 묶는다. 회귀 발생 시 이 커밋만 명시적으로 revert하는 방식으로 복귀하며, 사용자 변경을
  checkout/reset으로 지우지 않는다. 새 모듈·연결·빌드 항목·검사 연결을 함께 되돌리고 이전 본체 구현을 복원한다.

## DEV-3 검증 계약

새 check-ai-image는 실제 페이지/모듈과 브라우저 FileReader·canvas를 사용한다. 외부 요청을 차단하고
합성 이미지·응답만 쓴다. 공급자 API·Firebase 실계정 접속은 필요 없다. 기존 동작을 먼저 확인한 뒤 추출한다.

1. Chromium·Firefox·WebKit에서 HTTP 원본과 공개 산출물의 window/lexical 표면, 정상 부팅을 확인한다.
   공개 산출물 file://에서도 모듈 로드와 합성 변환을 확인하고 allow-file-access-from-files 우회 인자를 제거한다.
2. 합성 가로/세로 이미지의 긴 변 1568 상한·작은 이미지 확대 없음·JPEG 출력·bytes와 base64 일치를 확인한다.
   서로 다른 이미지의 동시 처리 결과가 섞이지 않는지 확인한다. JPEG 바이트를 플랫폼 간 고정 스냅샷으로 비교하지 않는다.
3. 입력 읽기 실패, JPEG null, FileReader 실패를 주입하여 각각 rejection·기존 안내를 확인한다.
   테스트용 create 의존성으로 전달 인자 1568/0.8도 확인한다. 입력 원본 fallback이 없어야 한다.
4. statement/boxed/conditions/examples/choices, 부족/초과 선택지, null·unknown 블록과 빈 입력을 확인한다.
   실제 normProblem으로 긴 title/text 상한, 외부 id 미채택, 임의 필드 제거를 확인한다.
   ID 값은 난수라 동일 문자열을 기대하지 않는다. HTML 이스케이프를 정규화가 한다고 가정하지 않는다.
5. 본체 wrapper도 호출하여 주입·정규화가 실제 경로를 통과하는지 확인한다. fake 공급자 응답 한 건으로
   기존 aiGenerateFromImage의 문항 반영까지 확인하고 Worker 전송은 route stub으로 막는다.
6. 메모리/응답 교체로 (a) normProblem을 우회하는 변이, (b) 전처리 상한을 바꾸는 변이를 각각 실행한다.
   해당 단언이 exit 1로 실패해야 하며 import/구문 실패는 검출로 인정하지 않는다. 원본은 baseline exit 0이어야 한다.

필수 마무리: npm run check:fast, npm run test:cross,
PUBLIC_ENGINES=chromium,firefox,webkit npm run test:public-browser.
check:fast의 test:audit-browser가 serve.py의 regression-test.html을 실행한 완료 결과도 확인한다.
겹치는 검사는 마지막 코드·환경에서 통과한 결과를 재사용하고, 인계에 명령·종료코드·커밋·환경·미실행 항목을 적는다.
새 검사의 실패 주입과 공개 CSP 기존 검출을 유지한다. 운영·실기기 인증까지 검증했다고 선언하지 않는다.
DEV-2에서는 문서·소스 대조만 수행했다. 위 테스트의 실행 완료를 미리 주장하지 않는다.

## DEV-4·5로 넘길 것

DEV-4/Sol medium은 위 계약과 실제 diff·실패 주입 결과를 독립 확인한다.
DEV-5/Terra medium은 CODE-MAP의 기존 두 질문을 유지한다. AI 전체 흐름 질문은 파일 수가 늘 수도 있어
그 결과를 그대로 적고, 미리보기 질문은 미변경 대조로 쓴다. 전처리만 읽는 이득은 별도 보조 관찰로 기록한다.
