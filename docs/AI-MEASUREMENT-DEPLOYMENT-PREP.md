# OPS-6 — AI 측정 배포 준비 묶음

작성: 2026-09-13, 갱신: 2026-09-14. 최초 읽기 전용 조사와 이후 대화에서 확인한 staging 준비를 구분한다.
목표는 기존 Worker 측정 코드를 승인된 격리 환경에서 검증할 수 있게, 확인 사실과 미확인 사실·최대 호출
범위·복귀 조건을 한곳에 고정하는 것이다.

## 재개 시 먼저 확인할 최신 인계 상태

사용자가 감수서 검토를 위해 staging 실행을 중단한 뒤 2026-09-14 레일 재개를 요청했다.
[OPS-6A 어댑터 설계·구현·독립 검토](GEMINI-STAGING-ADAPTER-DESIGN.md)는 완료했다. 다음은 OPS-6B
배포 준비였다. 아래 첫 묶음은 과거 기록이고, 그 다음의 **2026-09-14 재확인**은 배포 전 콘솔을 읽기
전용으로 대조한 결과다. 이후 승인된 staging 변경으로 OPS-6B를 완료했다. OPS-7의 승인된 두 호출은
2026-09-14 실행됐으나 모두 provider 연결 단계에서 실패했으며 production 변경은 없다.

- 격리 Cloudflare Worker와 Firebase 프로젝트 `pedagogy-ai-staging`, 웹 앱 `pedagogy-ai-staging-web`을 생성했다.
  Worker에는 기본 Hello World 배포가 있으나 제품 코드·QUOTA 연결·Gemini 연결은 미완료다.
- staging Worker 생성 화면에서 로그 표본률 100%가 관찰됐다. 저장소의 10% 설정과 혼동하지 않는다.
  제품 검증 후 목표 10% 반영과 실제 설정 확인이 필요하다. 아직 복원 완료가 아니다.
- Firebase App Check/reCAPTCHA Enterprise localhost 등록과 Gemini API·전용 자격 증명 생성까지 진행했다.
  실제 토큰 발급/enforce, 정확한 app ID/project number, 모델 접근·비용 조건은 재확인해야 한다.
- Gemini 키를 Cloudflare secret으로 저장하거나 제품 Worker에 연결한 증거는 없다. 키 원문은 어떤 문서에도
  복사하지 않는다. 자격 증명이 대화/도구 출력 등에 노출됐다면 배포 전에 노출 범위를 평가하고 교체한다.
- 당시 기록상 공급자 AI 요청은 0회이며 이번도 0회다. 계정 전체 청구액을 검증한 $0로 표현하지 않는다.
  기존 이미지 1회+문서 1회·누적 2회/$1 승인을 유지하고 production `dawn-shape-2664`에는 적용하지 않는다.

실행 순서는 [통합 레일 OPS-6A·6B](DEV-TOKEN-ROADMAP.md)를 따른다.
Gemini 분기는 현재 소스에 구현되어 있지만, key 발급만으로 배포 준비가 완료되지는 않는다.

### 2026-09-14 OPS-6B 읽기 전용 재확인

| 항목 | 확인 사실 | 결론 |
| --- | --- | --- |
| Cloudflare staging 대상 | Worker `pedagogy-ai-staging` / workers.dev URL이 존재한다. 활성 version은 `2c23c722` 하나이며 수동 배포·트래픽 100%다. | 정확한 staging 대상은 고정했다. 이 version만 롤백 후보이며 제품 코드 배포본은 아니다. |
| Worker 준비 상태 | runtime variables/secrets 목록과 connected bindings가 모두 비어 있다. `QUOTA` migration/binding도 아직 없다. logs sampling은 100%다. | 이 상태에서 제품 Worker를 실행하거나 합성 호출하면 안 된다. 배포 전 secret 이름·QUOTA 생성과 설정 반영이 필요하다. |
| Firebase/App Check | `pedagogy-ai-staging` 프로젝트 번호 `450368559700`, 웹 앱 `pedagogy-ai-staging-web` ID `1:450368559700:web:5e8f86074f042dd7d12bc1`를 확인했다. App Check에는 reCAPTCHA Enterprise provider로 등록되어 있다. | staging 식별자는 production과 분리되어 있다. 실제 토큰 발급/monitor 관찰은 아직 하지 않았다. |
| Gemini 접근 | staging Google Cloud 프로젝트에서 Gemini API가 enabled 목록에 있고, Firebase 자동 생성 browser key와 별도 Gemini service account가 보인다. API key 원문은 열거나 기록하지 않았다. | Worker에 필요한 server-side `GEMINI_API_KEY` secret의 존재·권한·제한은 아직 확인하지 않았다. browser key를 Worker secret으로 쓰지 않는다. |

로컬에는 이 대상을 명시하는 [`worker/wrangler.staging.toml`](../worker/wrangler.staging.toml)을 추가했다.
production `worker/wrangler.toml`은 수정하지 않았으며, 이 선언도 아직 배포하지 않았다. staging config는
`DAILY_LIMIT=2`, `GLOBAL_DAILY_LIMIT=2`, Gemini 2.5 Flash, App Check `monitor`, 10% logs를 명시한다.
두 limit은 요청 수 보호장치일 뿐 달러 한도가 아니며 `GEMINI_API_KEY` 값은 어떤 파일에도 넣지 않는다.

### 2026-09-14 OPS-6B 배포 완료

| 항목 | 완료 증거 |
| --- | --- |
| 자격 증명 | Gemini API만 허용하고 staging Gemini service account에 바인드한 `pedagogy-ai-staging-gemini-live`만 서버용 활성 key로 남겼다. 미사용 임시 key 3개는 삭제했고 Firebase browser key는 유지했다. |
| Cloudflare secret | staging Worker에만 `GEMINI_API_KEY`를 `secret_text`로 저장했다. Wrangler에서 이름·type만 확인했고 값은 파일이나 문서에 기록하지 않았다. |
| 제품 Worker | `worker/wrangler.staging.toml`로 `pedagogy-ai-staging`을 배포했다. version은 `e9b40db6-ba58-436d-8a99-e0fc9a1df840`; `QUOTA`/`DailyQuota`, Firebase staging 식별자, `APP_CHECK_MODE=monitor`, 2회 limits, Gemini 2.5 Flash, logs 10%가 반영됐다. |
| 무과금 확인 | 배포 후 `GET /health`가 `{"ok":true}`를 반환했다. 이 경로는 AI provider를 호출하지 않아 승인된 실제 호출 잔여는 이미지 1회·문서 1회 그대로다. |
| 분리/복귀 | production `dawn-shape-2664`는 무수정이다. 직전 rollback 기준은 Hello World `2c23c722`, 현재 검증 대상은 위 새 version이다. |

### 2026-09-14 OPS-7 실환경 결과와 복원

| 항목 | 확인 결과 |
| --- | --- |
| 실행 범위 | staging에만 logs 100% version `32c03142-05f8-4647-89bb-8307d0009f89`를 배포하고 합성 PNG 1회·개인정보 없는 문서 prompt 1회를 실행했다. provider 시도 2회, 재시도 0회로 기존 승인을 모두 사용했다. |
| 인증·App Check | 무효 Firebase 토큰은 provider·quota 전에 401로 거절됐다. 임시 익명 계정의 유효 토큰은 통과했다. App Check 토큰은 없어서 `monitor` 실패 로그가 남았지만 설정대로 거절하지 않았다. |
| quota·응답 | 두 유효 요청 모두 사용자·전역 quota의 reserve·consume을 완료한 뒤 이미지·문서 각각 502를 반환했다. 실패도 이미 소비됐으므로 429 확인용 세 번째 요청은 보내지 않았다. |
| 안전 로그 | 두 작업의 `ai_usage`는 provider `gemini`, 각 task, `outcome=request_error`, 미확인 token/HTTP 필드를 null로 남겼다. 요청 이미지·prompt·응답·UID·인증 토큰·secret은 기록하지 않았다. |
| 복원 | staging logs를 version `eeb668aa-1f81-4fc4-bb6b-a8546176613c`에서 10%로 복원했다. 임시 익명 계정을 삭제하고 익명 로그인 제공업체도 비활성화했다. production은 배포·설정·호출 모두 0건이다. |

provider HTTP 응답 자체가 없어서 모델 접근·출력 구조·실제 token 측정은 미확인이다. 기존 2회/$1 승인은
소진됐으며 추가 호출로 원인을 탐색하지 않는다. 다음은 Terra medium의 외부 호출 없는 credential 전달·header·
Cloudflare fetch 경계 진단이고, 수정 후 재검증은 별도 횟수·금액 승인을 받아 OPS-7 안에서 수행한다.

## 최초 조사 범위 (2026-09-13; 현재 원격 상태의 증거가 아님)

| 항목 | 로컬에서 확인한 사실 | 운영에서 아직 확인할 사실 |
| --- | --- | --- |
| API 주소 | 문제·문서 화면은 `https://dawn-shape-2664.dbruddl79.workers.dev`를 사용한다. 공개 `GET /health`는 2026-09-13에 `{"ok":true}`를 반환했다. | 이 주소가 production인지, 어떤 Worker version을 가리키는지, 실제 배포 코드가 `caa22f6`과 같은지는 미확인이다. |
| Worker 배치 | `worker/wrangler.toml`은 `dawn-shape-2664`, `QUOTA` Durable Object, migration `v1`을 선언한다. 별도 staging environment·route·custom domain 선언은 없다. | 실제 `QUOTA` binding/migration, 다른 Worker의 전역 quota 공유 여부, preview/workers.dev 우회 차단은 미확인이다. |
| AI 설정 | 로컬 기본 모델은 `claude-haiku-4-5`, 두 경로의 `max_tokens`는 4096, 사용자/전역 일일 상한은 50/5000, kill switch는 0이다. | 배포 변수 override, 실제 모델 ID, plan 상한, `ANTHROPIC_KEY` 연결·범위, Anthropic 지출 제한·알림은 미확인이다. secret 값은 이 문서에 기록하지 않는다. |
| 측정 | `ai_usage`는 작업·모델·입출력 토큰·중단 사유·시간·결과·HTTP 상태만 기록한다. 로컬 `head_sampling_rate`는 0.1이다. | 플랫폼 로그 보존 기간·실제 표본률·로그 접근자와 원문 비노출 경계는 미확인이다. |
| App Check | 클라이언트 전송·Worker 검증 코드는 있으나 로컬 설정은 `APP_CHECK_MODE=off`다. | staging/production의 site key, monitor/enforce 상태와 정상·거절 비율은 미확인이다. |

`GET /health`는 AI key·quota·측정·App Check를 거치지 않는다. 따라서 이 응답은 endpoint 도달만 뜻하며,
배포 version이나 AI 호출 준비 완료를 증명하지 않는다.

## 합성 검증 승인과 비용 재산정

아래 Haiku 가격 계산은 최초 계획의 역사적 근거이며 **Gemini 총비용 상한에 사용할 수 없다**.
Gemini 2.5 Flash의 2026-09-14 가격·출력/생각 설정과 보수적 비용 계산은
[어댑터 설계 §6](GEMINI-STAGING-ADAPTER-DESIGN.md)에 기록했다. 실제 모델 접근·입력 자료·전체 비용 전제는
OPS-6B에서 재확인하며 설계 계산만으로 실호출 승인 조건이 충족됐다고 보지 않는다.

승인된 **격리 staging**에서만 권장한다. 운영 사용자 자료·실계정 자료는 사용하지 않는다.

| 항목 | 제안 |
| --- | --- |
| 자료 | 권리 문제가 없는 작은 합성 PNG 1개, 개인정보가 없는 짧은 한국어 문서 요청 1개 |
| 호출 수 | 문제 이미지 1회 + 문서 1회, 합계 최대 2회. 자동 재시도·수동 반복 없음. 인증·quota·JSON 실패 주입은 이미 로컬에서 검증했으므로 유료 호출로 반복하지 않는다. |
| 측정 확인 | task별 `ai_usage`의 안전 필드만 확인한다. 기존 10% 표본으로는 2회에서 이벤트가 없을 수 있으므로, staging에서만 100% 표본으로 올리고 검증 직후 10%로 복원하는 변경을 승인 묶음에 포함한다. production 표본률은 바꾸지 않는다. |
| 출력 비용 상한 | Haiku 4.5의 현재 출력 가격은 $5/MTok이며 각 요청 출력 상한은 4096이다. 따라서 2회 출력 성분의 최대는 `2 × 4096 × $5 / 1,000,000 = $0.04096`이다. [공식 가격](https://www.anthropic.com/pricing) 기준 확인일: 2026-09-13. |
| 입력 비용 | Haiku 4.5의 현재 입력 가격은 $1/MTok이다. 이미지의 실제 시각 토큰과 배포된 system prompt·문서 토큰은 호출 전 정확히 알 수 없어, 위 $0.04096은 총액 상한이 아니라 출력 성분 상한이다. Worker는 이미지 본문 8MiB와 문서 입력 길이를 제한하지만 금액 단위의 입력 예산을 강제하지 않는다. |

2026-09-13에 사용자는 **격리 staging만**, 합성 이미지 1회·문서 1회(총 2회), 자동 재시도 금지,
총 $1 한도, production 배포·설정 변경·실사용자 데이터 접근 제외를 승인했다. 이 승인은 staging
대상과 분리된 자격 증명이 확인된 경우에만 적용된다.

현재 코드의 호출 quota는 금액 상한이 아니며, `GLOBAL_DAILY_LIMIT=5000`도 Anthropic 청구액을 보장하지 않는다.

## 실행 전 읽기 전용 확인 목록

1. staging Worker URL/version, staging Firebase project/App Check app ID, 선택한 공급자의 staging key가 production과 분리됐는지 확인한다.
2. staging Worker의 `QUOTA` binding과 migration, `DAILY_LIMIT`·`GLOBAL_DAILY_LIMIT`·`AI_KILL_SWITCH`,
   `AI_MODEL`, observability 표본률을 값을 노출하지 않는 방식으로 기록한다.
3. deploy 직전의 Worker version ID, 정적 산출물 commit/manifest, App Check mode, 사용 가능한 롤백 version을 기록한다.
4. 선택한 공급자의 콘솔에서 해당 key/project의 모델 접근, 사용량 알림·지출 한도·자동 충전 상태를 확인한다.
5. Cloudflare Logs의 접근 권한·보존 기간과 `ai_usage` 이외 원문/헤더를 열지 않는 검토 절차를 확인한다.

1~3의 배포 전 항목은 위 완료 기록으로 대조했다. 공급자 사용량/비용과 로그의 실제 이벤트는 OPS-7의 승인된
두 합성 호출에서 확인한다. 중복 리소스를 생성하거나 production 변수를 바꾸지 않는다.

## 승인 뒤의 한 번의 실행 범위와 복귀

승인을 받으면 별도 OPS-7에서 다음 순서로만 실행한다.

1. 승인된 staging에 현재 Worker를 배포하고 version ID·설정 차이·바로 전 rollback version을 기록한다.
2. staging 표본률을 승인 범위에서 100%로 설정하고, 합성 이미지·문서 요청을 각 1회 실행한다.
3. 응답 결과, 인증 거절 경계, quota, `ai_usage` 안전 필드와 선택한 공급자 콘솔 사용량을 대조한다.
4. staging 표본률을 10%로 복원하고, 이상이 있으면 직전 Worker version으로 되돌린다.

production은 별도 대상 승인 없이는 배포·호출·표본률 변경을 하지 않는다. rollback은 frontend와 Worker의
App Check 계약을 함께 유지해야 하며, 진행 중인 공급자 요청이나 이미 발생한 비용을 취소하지 않는다.
