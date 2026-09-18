# OPS-6A — Gemini staging 어댑터 구현 계약

## 2026-09-15 OPS-7 모델 접근 수정 (아래 최초 2.5 계약보다 우선)

직전 staging의 이미지·문서 호출은 모두 Gemini HTTP 404였다. Google 공식 지원 답변은
2.5 모델을 과거 활성 사용자에게 제한하며 신규 프로젝트에는 3.1 Flash-Lite 또는 3.5 Flash를
안내한다. staging은 2026-09-14 신규 프로젝트라 이 조건에 해당하는 것으로 추론한다.
종료 일정의 “종료일 미발표”나 models.list 성공만으로 프로젝트의 생성 접근을 보장할 수 없다.
[공식 지원 답변](https://discuss.ai.google.dev/t/auth-key-can-list-models-but-generatecontent-returns-http-404-not-found-for-gemini-2-5-flash/180197/2).

사용자의 OPS-7 재시도·원인 해결 요청에 따라 단일 staging 모델을 `gemini-3.1-flash-lite`로
변경한다. REST 경로의 모델과 config allowlist, 회귀 fixture를 함께 변경하고 이전 2.5 설정은
quota 전에 거절한다. Gemini 3 요청은 `thinkingConfig={thinkingLevel:"minimal",includeThoughts:false}`.
minimal은 생각 0을 보장하지 않으므로 생각 토큰 양수도 정상 측정값이며 누락은 계속 null이다.
후보 1개·출력 4096·JSON MIME·기존 prompt·validator·인증·quota 소비 순서·단일 fetch는 유지한다.
production 설정과 Anthropic 경로는 바꾸지 않는다. 자동 fallback·재시도는 없다.
[모델 계약](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite),
[생각 설정](https://ai.google.dev/gemini-api/docs/generate-content/gemini-3).

2026-09-15 공식 Standard 가격은 text/image 입력 $0.25/백만 토큰, 생각 포함 출력 $1.50/백만 토큰이다.
입력 최대 1,048,576·출력 4096을 적용한 2회 토큰 성분 상계는
`2 × (1,048,576 × 0.25 + 4096 × 1.50) / 1,000,000 = $0.536576`이다.
실제 테스트는 256×128 합성 PNG와 500바이트 미만 문서뿐이다. 도구·파일 업로드·cache·grounding은 없다.
이는 클라우드 전체의 달러 차단기가 아니며 실제 청구액으로 쓰지 않는다. 기존 개인정보 제한을 유지한다.
[가격](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite).

이번 재시도는 이미지·문서 각 1회, 최대 $1로 제한하고 첫 실패 시 남은 생성 요청도 중지한다.
동일 UTC 날짜의 기존 4회 때문에 검증 동안 전역 한도 6·logs 100%를 사용하고 종료 후
전역 한도 2·logs 10%로 복원한다. 사용자별 한도는 2이고 기존 quota 카운터는 초기화하지 않는다.
상세 실행 증거와 독립 검토 여부는 통합 레일과 HANDOFF-143에 기록한다.

2026-09-14 · Codex / Astra high · 기준 코드 `6f4f828`.
**설계·Terra 구현 완료, Sol 독립 검토·실환경 적격성 확인은 미완료.** 진행 상태는
[통합 레일](DEV-TOKEN-ROADMAP.md)만 갱신한다. 이번 설계는 production 채택/배포 승인이 아니다.

## 1. 결정과 제외 범위

- 첫 후보는 기존 대화의 `gemini-2.5-flash`를 유지한다. 최신 모델 추격이나 공급자 비교 실험은 하지 않는다.
  공식 모델 문서는 이미지 입력/텍스트 출력과 안정 버전을 명시하고, 확인한 종료 일정에는 종료일이 없다.
  **해당 staging 프로젝트/키의 실제 접근 가능성은 아직 미확인**이다.
  [모델](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash),
  [종료 일정](https://ai.google.dev/gemini-api/docs/deprecations).
- Gemini Developer API의 단발 REST `generateContent`를 Worker에서 호출한다. SDK·Vertex AI·Interactions·
  파일 업로드·검색/grounding·도구·명시적 cache·스트리밍·자동 재시도·자동 fallback은 도입하지 않는다.
- Gemini 두 작업 모두 `candidateCount=1`, `maxOutputTokens=4096`,
  `thinkingConfig={thinkingBudget:0,includeThoughts:false}`, `responseMimeType="application/json"`로 고정한다.
  2.5 Flash는 0으로 생각을 끌 수 있고 출력 한도는 생각 토큰도 포함한다. 이는 품질 검증 결과가 아니라
  첫 smoke 검증의 비용/출력 경계를 고정한 설계 선택이다.
  [생각 설정](https://ai.google.dev/gemini-api/docs/generate-content/thinking).
- 기존 SYSTEM_PROMPT / DOCUMENT_SYSTEM_PROMPT 문구와 4096 Anthropic 한도, Firebase/DO/브라우저
  저장·정규화 계약은 바꾸지 않는다. 문서 prompt 예시와 허용 type 규칙 사이의 불일치도 이번에 섞어 고치지 않는다.
  JSON 모드는 의미 검증이 아니며 별도의 전체 블록 JSON Schema를 복제하지 않는다. 기존 파서/validator를 유지한다.
- `worker/wrangler.toml`과 `service-config.js` 등 production 기본 설정은 무수정.
  staging 설정/secret 작성과 배포는 구현·독립 검토 뒤 OPS-6B/7의 명시적 대상 확인을 거친다.

## 2. 변경 경계와 함수 책임

| 파일 | 구현할 경계 | 보존할 경계 |
| --- | --- | --- |
| `worker/index.js` | 공급자 preflight, Gemini 단발 transport·오류 래핑, 공개 callAI/callDocumentAI의 명시적 분기 | createWorker 주입 인자와 aiGeneration(value,telemetry), Anthropic 요청/오류/파싱, 기존 인증·quota 순서 |
| `worker/gemini.js` (신규) | 순수 요청 body 생성·응답 parts/finish/usage 해석. secret·환경·fetch·console을 소유하지 않음 | DOM·Firebase·DO·index.js 역방향 import 없음 |
| `worker/gemini.test.mjs` (신규) | 순수 변환 및 실제 Worker 경유 Gemini 경계, 전송 횟수·로그 안전성·실패 주입 | 가짜 fetch/JWT/DO 사용, 실제 키/네트워크 호출 없음 |
| `worker/worker-contract.test.mjs` | 필요한 공급자 preflight 경우 추가, 기존 Anthropic 단언 유지 | 기존 정확한 로그 키 목록/원문 비노출 단언을 느슨하게 하지 않음 |
| `package.json` | 신규 검사를 test:worker에 연결 | 기존 test:worker/check:fast의 검사 제거 없음 |
| `reviews/audits/2026-09-13/worker-telemetry-review.mjs` | 필요할 때만 이동한 mutation anchor/import를 정확히 수정 | 4개 원문 누출 변이 검출 의무. 코드를 옮겨 검사가 무효가 되지 않게 함 |
| 운영 문서 | Gemini 필드 의미/후보 상태·복귀 절차를 연결 | Anthropic production이 전환된 것으로 기술하지 않음 |

권장 순수 함수 표면: `buildGeminiRequest({system,parts})` → JSON body,
`decodeGeminiEnvelope(data)` → `{text,finishReason,blocked,inputTokens,outputTokens,thinkingTokens,model}`.
이 결과의 text는 파싱용 메모리에만 존재한다. telemetry 객체로 spread하지 않는다.
Gemini 네트워크 helper와 `AiGenerationError`는 index.js 안에서 결합해 순환 의존을 피한다.
기존 `callAI(env,imageBase64,mimeType)`·`callDocumentAI(env,prompt)` export와 주입 테스트 계약을 유지한다.

## 3. 환경 선택과 호출 전 차단

| 설정 | 규칙 |
| --- | --- |
| `AI_PROVIDER` | 미설정/빈 값은 기존 `anthropic`. 명시 값은 `anthropic` 또는 `gemini`만. 알 수 없는 값은 503, fallback 금지 |
| `ANTHROPIC_KEY`, `AI_MODEL` | Anthropic에서만 기존 동작 유지 (`claude-haiku-4-5` 기본) |
| `GEMINI_API_KEY` | Gemini에서만 필요한 Worker secret. Anthropic key가 없어도 Gemini preflight 통과 가능 |
| `GEMINI_MODEL` | Gemini에서는 정확히 `gemini-2.5-flash` 필수. 누락/다른 모델은 503. 기존 AI_MODEL을 재활용하지 않음 |

선택/모델/secret 검증은 현재 ANTHROPIC_KEY 검사 위치, 즉 본문 검증 뒤 **quota reserve 전**에 한다.
callAI/callDocumentAI 직접 호출도 동일 config 검증을 거치게 한다. 알려진 설정 오류는 quota/공급자 호출 0회다.
공개 오류는 기존 일반 503 메시지를 유지하고 secret/모델 설정 원문은 노출하지 않는다.

기존 본문 8MiB·문서 prompt 12,000자 한도는 그대로다. Gemini 입력 MIME은 기존 목록과 공식 목록의
교집합인 PNG/JPEG/WebP만 허용한다. Gemini 직접 GIF 요청은 **400과 일반 이미지 형식 오류, quota 전 차단**.
Anthropic GIF 허용은 유지하고 HEIC/HEIF를 새로 열지 않는다. `pedagogy-ai-image.js`의 `prepImageForAI`는
이미 JPEG로 변환하므로 UI 무수정으로 주요 경로를 보존한다. 직접 API의 차이는 회귀와 인계에 명시한다.
[공식 이미지 형식](https://ai.google.dev/gemini-api/docs/image-understanding).

변경하지 않는 처리 순서:
Origin → kill switch → Firebase ID token → App Check → body/config/MIME → 개인 reserve → 전역 reserve
→ 전역 consume → 개인 consume → 선택한 공급자 1회 → 파싱/문서 검증 → 로그 1건/응답.
공급자/파싱 실패 뒤 사용량을 환급하지 않는다. 부분 reserve 실패만 기존 release 규칙을 따른다.
전역 consume 후 개인 consume 실패처럼 기존의 보수적 소비 동작도 이번에 재설계하지 않는다.

## 4. REST·응답·오류 계약

전송은 `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`에 POST.
secret은 `x-goog-api-key` 헤더에만, URL/query/body/log에는 넣지 않는다. `Content-Type: application/json`.
고정 origin/model 경로를 사용하고 사용자/환경 값으로 임의 URL을 조립하지 않는다. redirect는 error로 거절한다.
Gemini 요청에는 60초 AbortController deadline을 두고 응답 body를 읽을 때까지 유지, finally에서 timer를 정리한다.
timeout도 재시도하지 않는다. 클라이언트 abort가 공급자 연산/청구를 취소한다고 주장하지 않는다.

- `systemInstruction.parts=[{text:기존 작업별 system prompt}]`.
- 이미지: `contents=[{role:"user",parts:[{inlineData:{mimeType,data:imageBase64}},
  {text:"이 이미지의 문제를 지정된 JSON 구조로 변환해 줘."}]}]`.
- 문서: `contents=[{role:"user",parts:[{text:trim한 prompt}]}]`.
- 생성 설정은 §1의 고정값만 사용. 추가 온도/프롬프트/모델 튜닝은 OPS-8~10 판단 밖에서 임의로 하지 않는다.
- candidates는 정확히 하나만 해석한다. `thought===true` part는 본문으로 연결하지 않는다.
  나머지는 text part만 순서대로 합치며 functionCall/inlineData 등 예상 밖 part는 거절한다.
  빈 text, candidate 없음/복수, 비객체 envelope는 실패다. raw text나 finishMessage를 로그로 보내지 않는다.
- 정상 종료 `STOP`인 경우만 JSON을 기존 방식으로 파싱한다. 이미지 배열 또는 `{problems:[...]}`를 기존
  `callAI`처럼 받으며 브라우저 정규화를 우회하지 않는다. 문서는 기존 `validateDocumentResponse`까지 통과해야 성공이다.
- `MAX_TOKENS`는 JSON이 파싱돼도 불완전 가능성이 있어 Gemini에서 실패 처리한다. prompt 차단 또는
  안전/저작권 등 거절 종료, 미확인 종료도 실패 처리한다. 안전 설정을 완화하거나 차단을 우회하지 않는다.
- 네트워크/timeout/redirect=`request_error`, HTTP 실패=`http_error`, 잘못된 envelope/JSON=`json_parse_error`,
  잘림/차단/미확인 종료 및 문서 validator 실패=`validation_error`로 기존 outcome 집합을 재사용한다.
  HTTP 실패 body는 읽어 로그/오류로 복사하지 않는다. body JSON 이후 파싱 실패는 확보한 usage를 유지한다.
- 외부 응답은 기존 200 `{problems,usage}` 또는 `{document,usage}`, 실패는 일반 502다.
  여기서 usage는 **앱 일일 호출 수**이며 모델 토큰/가격을 넣지 않는다. 로그 sink 실패가 사용자 성공을 뒤집지 않는다.

공식 계약 근거: [generateContent](https://ai.google.dev/api/generate-content),
[키 전달·보호](https://ai.google.dev/gemini-api/docs/api-key).

## 5. 측정 매핑 — 본문과 생각 토큰을 혼동하지 않기

Anthropic의 기존 로그 10개 키와 의미는 그대로 둔다. Gemini만 안전한 숫자 키 `thinking_tokens` 하나를 추가한다.

| ai_usage 필드 | Gemini 원천/규칙 |
| --- | --- |
| provider / task | 고정 gemini / 기존 problem_image 또는 document |
| model | 안전 문자 검사를 거친 modelVersion, 없으면 요청 모델. 자유 텍스트는 unknown |
| input_tokens | usageMetadata.promptTokenCount |
| output_tokens | usageMetadata.candidatesTokenCount — 사용자 응답 후보 토큰, 생각을 포함한 청구 총량이 아님 |
| thinking_tokens | usageMetadata.thoughtsTokenCount. 미제공을 0으로 바꾸지 않음 |
| stop_reason | STOP→end_turn, MAX_TOKENS→max_tokens, 알려진 안전/거절 사유→refusal, 나머지→unknown, 미제공→null |
| outcome / duration_ms / http_status | §4 분류 / 요청~body 해석 시간 / 안전한 HTTP 상태 또는 null |

안전/거절 allowlist는 SAFETY, RECITATION, BLOCKLIST, PROHIBITED_CONTENT, SPII로 고정한다.
promptFeedback.blockReason이 있으면 성공으로 처리하지 않고 알려진 거절만 refusal, 미확인은 unknown이다.
source가 음수·소수·문자열·unsafe integer거나 없으면 각 토큰 값은 null. 예외·차단에도 유효 usage는 보존한다.
Gemini 로그는 정확히 기존 10키+thinking_tokens만 허용한다. free-form 오류·finishMessage·parts·thoughtSignature·
이미지·prompt·응답·UID·인증/키 헤더는 금지한다. 두 공급자 결과를 spread해서 로그를 만들지 않는다.

Gemini 청구 추정은 유효한 입력과 후보+생각 토큰을 사용한다. 생각 토큰이 null이면 0이라고 합산하지 않고
추정 미확인으로 둔다. caching 할인과 누락 표본 때문에 계산을 실제 청구액으로 표시하지 않는다.
생각을 0으로 요청했더라도 응답에 양수가 오면 그대로 기록하고 실환경 계약 이상으로 남긴다.
[usage/finish 정의](https://ai.google.dev/api/generate-content),
[생각 과금](https://ai.google.dev/gemini-api/docs/generate-content/thinking).

## 6. 합성 2회/$1 예산과 개인정보 적격성

2026-09-14 공식 Standard 가격: text/image 입력 $0.30/백만 토큰, 생각 포함 출력 $2.50/백만 토큰.
[가격](https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash).

- 2회 출력 성분 최대: `2 × 4096 × 2.50 / 1,000,000 = $0.02048`.
- 모델 입력 한도 1,048,576을 각 회 최대라고 잡으면 성공적으로 수락된 2회 생성의 보수적 계산은
  `2 × (1,048,576 × 0.30 + 4096 × 2.50) / 1,000,000 = $0.6496256`.
  이는 실제 예상 사용량/청구 보장/앱의 달러 차단기가 아니다. 모델 한도 내 단발 text/image Standard 호출,
  도구 없음·후보 1개·출력 한도 준수를 전제로 한 공급자 토큰 성분 상계다. 무료 티어라고 $0로 예산 잡지 않는다.
- 실제 자료는 권리/개인정보 없는 작은 합성 PNG 1개(512×512 이하, 100KiB 이하), 짧은 문서 요청 1개
  (UTF-8 500바이트 이하)로 고정하고 §1 설정과 system prompt 해시·자료 바이트 수만 증적에 남긴다.
  토큰 한도 최대 크기의 요청을 만들어 보내지 않는다. 불필요한 countTokens/연결 테스트 생성도 추가하지 않는다.
- OPS-6B에서 모델 접근·가격/한도·잔여 승인·계정 지출/자동 충전과 Cloudflare/Firebase 비용 조건을 재확인한다.
  이번 수치는 전체 클라우드 비용/오류 요청 청구까지 증명하지 않는다. 총 $1 준수를 확인할 수 없으면 호출 보류.
- 누적 생성 시도는 이미지 1회+문서 1회뿐이다. provider에 도달한 실패/timeout/응답 유실도 회수하지 않는다.
  Gemini 거절 뒤 Anthropic 재호출, 날짜/작업 전환으로 횟수 초기화는 금지한다.

무료 서비스는 입력·응답이 제품 개선/사람 검토 대상이 될 수 있으므로 **합성·비기밀 자료만 허용하는 설계**다.
Paid Services는 프로젝트의 활성 billing 연결 여부로 구분되며 학습 미사용과 무보존은 다르다.
유료도 악용 방지 목적 보존·국외 처리 가능성이 있으므로 개인 자료 처리의 보존/삭제/이전 적격성은 미완료다.
실사용자 자료, 미공개 문제집 원문, production 사용 승인은 없다. billing 연결·유료 전환도 이번에 수행하지 않는다.
[Google 추가 약관](https://ai.google.dev/gemini-api/terms).

## 7. 구현 종료 검증과 실패 주입

| 검사 묶음 | 필수 단언 |
| --- | --- |
| config | 기본 Anthropic 보존, Gemini는 Gemini key만 필요, 다른 provider/모델/키 누락은 reserve/fetch 0 |
| 선행 거절 | Origin/Auth/App Check/kill/body/문서 길이/MIME 실패에서 양 공급자 호출 0; GIF는 Gemini만 차단 |
| 요청 | 두 작업의 URL/header/body, system prompt 동일, 생각0/4096/후보1, secret URL 비노출, fetch 정확히1 |
| 응답 | 두 JSON 형식·한글/LaTeX·여러 text parts·thought 제외·문서 validator와 client 정규화 유지 |
| 실패 | HTTP429/5xx·network·timeout·redirect·bad envelope/text/JSON·MAX_TOKENS·차단·미확인 종료·복수 candidate |
| quota | 개인/전역 reserve→consume 후 1회 호출, 실패 후 추가 release/환급/재호출 없음. 부분 실패 기존 동작 유지 |
| telemetry | 성공/실패 각각 로그1, usage 누락/비정상은 null, 생각 포함 비용과 visible 구분, sink 실패에도 성공 보존 |
| 비노출/복귀 | console 전 메서드·공개 오류에서 가짜 민감 marker 부재; provider 미설정으로 Anthropic 회귀 유지 |

신규 검사의 red 검증은 파일을 영구 훼손하지 않는 메모리/임시 사본 변이로 수행한다.
① Gemini body/key 로그 누출 ② 생각0/4096 설정 제거 ③ 누락 토큰을0으로 변환 ④ HTTP 실패 후 두 번째 fetch
⑤ MAX_TOKENS 성공 처리 ⑥ provider config 검사를 quota 뒤로 이동: 각각 관련 assertion에서 종료1이어야 한다.
구문/import 오류, mutation anchor 미일치, 네트워크 미설치로 실패한 것은 red 검출이 아니다.

구현 시 실행: 신규 `node worker/gemini.test.mjs`, `npm run test:worker` 전체, `npm run test:ai-image`,
`npm run check:static`, `npm run test:public`. 기능 변경이므로 serve.py의 regression-test.html도 실행한다.
신규 파일이 공개 산출물에 섞이지 않는지 build:public/check:public로 확인한다. 테스트 추가를 test:worker에
연결하면 CI check:fast 경로에 포함된다. 기존 telemetry mutation import/anchor와 privacy 단언도 직접 확인한다.
개별 검사를 이미 동일 코드·환경에서 통과했다면 같은 턴에 중복 실행하지 않는다. 제품/검사 변경 후에는 재검증한다.

## 8. Terra 인계·배포 전 대기 항목·복귀

Terra medium 구현은 `worker/gemini.js`와 `worker/gemini.test.mjs`, `worker/index.js`의 명시적 provider
분기로 끝냈다. `AI_PROVIDER` 미설정은 Anthropic을 유지하며 Gemini는 `GEMINI_API_KEY`와 정확한
`GEMINI_MODEL=gemini-2.5-flash` 없이는 quota 전 503이다. 새 검사는 test:worker/CI 경로에 연결했다.
OPS-6A의 **Sol medium 독립 검토는 완료**됐다. 실제 키·계정 접근 없이 diff·가짜 경계를 대조했고,
REV-091·092 수정 뒤 별도 probe와 Chromium regression 158/158로 승인했다. 다음은 OPS-6B/Terra medium이며,
실제 접근·개인 자료 적격성·staging 배포 준비는 아래 항목에서 확인한다.

구현 검증(2026-09-14): `node worker/gemini.test.mjs`, `npm run test:worker`, `npm run test:ai-image`,
`npm run check:static`, `npm run test:public`, `npm run check:public`, `npm run test:cross:fast` 통과.
serve.py의 `regression-test.html`은 수정 뒤 Chromium 158/158 통과했다. Gemini test의 in-memory red probe는
기준 통과 뒤 4096 제거·thinking 0 해제·누락 thinking token의 0 대입·body/key 누출·두 번째 fetch·
MAX_TOKENS 성공 처리·quota 뒤 config 검사가 각각 AssertionError로 실패함을 확인한다.
기존 telemetry audit의 prompt/image/provider response/UID 누출 변이도 각각 exit 1로 검출했다.

OPS-6B에서 확인할 남은 실제 항목:

- staging Worker/Firebase/DO 분리와 프로젝트 번호·app ID·승인 origin. Anthropic production 값 복사 금지.
- 실제 Google 토큰 발급/App Check 계약, Gemini 모델 접근과 API key의 서비스/프로젝트 제한.
- 이전 출력 노출 가능 키의 취급/교체와 사용 이력 확인. secret 값은 읽어 답변/증적에 넣지 않는다.
- 합성 자료·호출 장부·비용 전제·100% 로그의 민감 경계와 검증 후 10% 반영/확인.
- Worker 배포 버전·bindings/migration·검증 전 placeholder rollback 버전. Hello World로 복귀는
  제품 서비스 복원이 아니라 staging 실험 중지라는 점을 기록한다.

복귀: production은 애초에 변경하지 않는다. 로컬은 신규 Gemini 분기/파일/검사만 되돌릴 수 있게 분리한다.
staging 장애 시 직전 확인 버전으로 복귀하거나 AI를 중지하되 자동 Anthropic 유료 호출로 전환하지 않는다.
Anthropic 코드 경로 복귀는 오프라인으로 검증하며 실제 재호출은 승인 횟수/대상 밖에서 하지 않는다.
