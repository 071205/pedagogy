# PEDAGOGY SaaS 보안·소스 보호 심층 검토

- 검토일: 2026-09-11 (KST)
- 기준 코드: `dfa0a51` 및 2026-09-11 현재 작업 트리
- 검토 범위: GitHub Pages 정적 웹 앱, Firebase Authentication/Firestore/Storage,
  Cloudflare Worker, Anthropic API, GitHub Actions 공급망, 사용자 브라우저 저장소
- 선행 문서: `HANDOFF-2026-114`, `HANDOFF-2026-115`, 2026-09-08 보안 감사
- 성격: 설계·운영 의사결정용 독립 검토. 법률 자문 또는 침투 테스트 보고서가 아니다.

## 1. 결론부터

PEDAGOGY의 API 키 보호와 사용자별 과금 제한은 이미 꽤 단단하다. Anthropic 키는
Cloudflare Worker secret에 있고, Worker는 Firebase ID token을 검증하며, 사용자별·UTC
일자별 quota를 Durable Object transaction으로 직렬화한다. 요청 본문도 실제 읽은 바이트를
기준으로 8 MiB에서 멈춘다. Firestore/Storage Rules는 UID별 경계를 두고 문서 모양·개수·크기를
제한한다. 현재 `npm audit` 결과도 운영·개발 의존성 모두 알려진 취약점 0건이다.

그러나 사용자가 가장 걱정한 **코드 복제·재사용**에는 이 방어들이 거의 영향을 주지 않는다.
현재 GitHub 저장소는 실제로 `public`이고 GitHub API의 `license` 값은 `null`이다.[^1]
또한 배포물은 459 KB, 8,022줄의 `index.html`에 읽기 쉬운 JavaScript가 인라인으로 포함된
정적 앱이다. GitHub Pages는 저장소의 HTML/CSS/JavaScript를 정적으로 배포하는 서비스이고,[^2]
브라우저 개발자 도구는 로드된 HTML/CSS/JavaScript를 누구나 검사할 수 있다.[^3]

따라서 이 앱의 클라이언트 코드를 사용자의 브라우저에 보내면서 동시에 그 사용자에게서
완전히 숨기는 방법은 없다. 난독화는 복제 비용을 높일 뿐 보안 경계가 아니다. 실질적인 해법은
다음 세 가지를 조합하는 것이다.

1. **원본 저장소를 비공개로 전환하고 배포 산출물만 공개**하여 주석·테스트·Git 이력·서버 코드의
   일괄 복제를 막는다.
2. **정말 가치 있는 로직만 서버로 이동**하여 브라우저에 아예 전달하지 않는다.
3. **권리 고지·저작권 등록·배포 증거·탐지/대응 절차**를 마련해 기술적으로 막을 수 없는 복제에
   법적·운영상 대응한다.

이와 별개로 출시 전에 가장 높은 보안 효율을 내는 작업은 (a) App Check의 실제 enforcement,
(b) 사용자별 한도를 넘어서는 전역 과금 차단기, (c) Storage download token 설계 변경,
(d) 엄격한 CSP와 HTTP 보안 헤더, (e) GitHub 공급망 보호와 운영 알림이다.

## 2. 무엇을 보호해야 하는가

### 2.1 자산

| 자산 | 현재 위치 | 손실 시 영향 |
|---|---|---|
| 편집·조판·HWPX 변환 로직 | 공개 저장소와 브라우저 배포물 | 경쟁 제품이 기능과 UX를 빠르게 복제 |
| Worker 프롬프트·검증·quota 로직 | 공개 저장소, 실제 실행은 Cloudflare | 방어 규칙을 분석해 우회 연구, 제품 차별화 복제 |
| Anthropic API key와 잔액 | Cloudflare secret, Anthropic 계정 | 직접 과금·서비스 중단 |
| 사용자 문제집·모의고사·이미지 | localStorage, Firestore, Storage | 개인정보·교육자료 유출, 신뢰 훼손 |
| Firebase 로그인 세션 | 브라우저 Firebase SDK | 계정 데이터 접근·AI quota 소비 |
| 배포 파이프라인 | GitHub Actions와 저장소 권한 | 악성 배포, 공급망 오염 |
| PEDAGOGY 이름·디자인·고객 신뢰 | 공개 서비스 | 사칭 서비스·피싱·브랜드 혼동 |

### 2.2 현실적인 공격자

- 주소만 아는 익명 방문자: 배포 HTML/JavaScript와 네트워크 호출 구조를 내려받는다.
- GitHub 사용자: 공개 저장소를 fork/clone하고 전체 이력·테스트·Worker 코드를 분석한다.
- 정상 Google 계정을 다수 만든 자동화 사용자: UID별 하루 50회 제한을 계정 수로 우회한다.
- 탈취한 ID token 또는 Storage download URL을 가진 사람: 토큰 유효기간 동안 API/이미지에 접근한다.
- 악성 의존성·GitHub Action·기여자 계정: 빌드나 배포 산출물을 바꾼다.
- 공용 PC의 다음 사용자 또는 같은 origin에서 실행되는 악성 JavaScript: 브라우저 저장 자료를 읽는다.
- 설정 실수: Firebase Rules, App Check, API key restrictions, Cloudflare secret, Anthropic auto-reload를
  콘솔에서 코드와 다르게 운영한다.

### 2.3 신뢰 경계

PEDAGOGY에는 하나가 아니라 최소 네 개의 독립 경계가 있다.

| 경계 | 실제 주소/서비스 | 주 방어 |
|---|---|---|
| 정적 UI | `071205.github.io/pedagogy` | CSP, SRI, 안전한 DOM 처리, 배포 무결성 |
| Firebase 데이터 | `*.googleapis.com`, Firebase endpoints | Auth, Rules, App Check, API 제한 |
| AI API | `*.workers.dev` Worker | Origin, ID token, App Check/Turnstile, quota, 전역 예산 |
| 공급망/운영 | GitHub, Cloudflare, Google, Anthropic consoles | MFA, 최소권한, 리뷰, 비밀 탐지, 감사 로그 |

Cloudflare WAF를 PEDAGOGY 사용자 도메인 앞에 둬도 브라우저가 Firebase에 직접 보내는 요청은
Cloudflare를 지나지 않는다. 반대로 Firebase App Check를 켜도 Cloudflare Worker의 custom backend는
별도로 token을 받아 검증해야 한다. `HANDOFF-2026-114`의 제안은 방향은 맞지만 이 경계를
합쳐서 생각하면 보호 범위를 과대평가하게 된다.

## 3. 현재 구현에서 확인한 강점

### 3.1 AI 과금·API key

- `ANTHROPIC_KEY`는 브라우저 코드나 저장소 설정값이 아니라 Worker secret으로 분리되어 있다.
- Worker는 `Authorization: Bearer <Firebase ID token>`을 요구하고 서명·issuer·audience를 검증한다.
- Origin을 정확한 문자열 allowlist로 제한한다. CORS만 인증으로 오해하지 않고 ID token을 함께
  검증하는 점이 옳다. OWASP도 Origin은 브라우저 밖에서 위조할 수 있어 접근통제 수단으로만
  의존하지 말라고 권고한다.[^4]
- quota는 `uid + UTC 날짜`를 해시해 Durable Object 하나로 모으고 transaction 안에서
  reserve/consume하므로 동시 요청으로 한도를 넘기는 고전적인 read-modify-write 경쟁을 막는다.
- 외부 AI 호출 전에 quota를 확정해 네트워크 단절 후 공급자 과금 여부가 불명확한 경우에도
  상한을 보수적으로 지킨다.
- 기본 한도는 50회/일이며 코드의 최종 상한은 10,000회다. 입력 본문은 8 MiB, Anthropic 출력은
  `max_tokens: 4096`으로 제한된다.

Anthropic API는 현재 선불 usage credit 방식이고, credit이 소진되면 호출이 중단된다. auto-reload를
끄면 계정 잔액 자체가 최종 금전 상한이 된다.[^5] 이 운영 설정은 저장소만으로 확인할 수 없다.

### 3.2 데이터 권한

- Firestore Rules는 `/users/{uid}` 아래에서 로그인 UID가 일치해야만 읽고 쓸 수 있게 한다.
- 허용 필드, 배열 개수, 문자열 길이, 문서 크기, tombstone 모양을 제한하고 catch-all deny가 있다.
- Storage는 `users/{uid}/images/{imageId}` 한 단계만 허용하고 UID, 파일명 길이, 5 MiB,
  허용 MIME을 검사한다.
- Firebase Web API key가 클라이언트에 있는 것 자체는 비밀 유출이 아니다. Firebase 공식 문서도
  이 키는 프로젝트 식별자이고 실제 권한은 Rules와 App Check가 담당한다고 설명한다.[^6]
  다만 콘솔의 API allowlist 제한 여부는 별도로 확인해야 한다.

### 3.3 입력·출력과 브라우저

- AI 이미지 MIME allowlist, 크기 제한, UTF-8/JSON 파싱, 문서 프롬프트 12,000자 제한이 있다.
- 외부 라이브러리 script에 SRI가 적용되어 있고 정적 검사에서 이를 확인한다.
- `postMessage` 경로는 정확한 target origin과 source/origin 검사를 사용하도록 과거 이슈에서 보강됐다.
- Worker 응답은 `Cache-Control: no-store`, `nosniff`, `Referrer-Policy: no-referrer`를 사용한다.
- AI 원문/출력을 로그에 남기지 않는 운영 원칙이 `wrangler.toml`과 `SECURITY.md`에 명시돼 있다.

### 3.4 공급망의 현재 상태

- `package-lock.json`과 `npm ci`를 사용한다.
- 2026-09-11 실행한 `npm audit --json` 결과는 운영·개발 의존성 모두 알려진 취약점 0건이다.
  이는 오늘 알려진 advisory가 없다는 뜻이지 미래 취약점이나 악성 패키지가 없다는 보증은 아니다.
- GitHub Actions의 기본 token 권한은 `contents: read`라 최소권한 원칙에 부합한다.
- CI는 브라우저 회귀, Firebase Rules emulator, HWPX 변환, 정적 검사까지 폭넓게 실행한다.
- 루트 `SECURITY.md`가 존재하고 공개 이슈 대신 비공개 신고를 받으라는 원칙이 있다.

## 4. 코드 복제·재사용 위험: 정확한 판단

### 4.1 지금 상태에서는 복제가 매우 쉽다

GitHub 공개 API로 확인한 저장소는 `visibility: public`, `private: false`, `license: null`이다.[^1]
저장소에 루트 `LICENSE`나 `NOTICE`는 없다. 배포물 역시 큰 인라인 스크립트와 설명 주석을 그대로
포함한다. 별도의 source map은 없지만, 원본과 배포 코드가 사실상 같은 형태이므로 source map이
없다는 사실이 큰 방어가 되지 않는다.

GitHub 문서상 라이선스가 없으면 기본 저작권이 적용되어 타인에게 복제·배포·2차적 저작물 작성
권한이 자동으로 주어지는 것은 아니다. 그러나 공개 저장소는 GitHub 이용약관상 열람과 fork가
허용되고, 나중에 private으로 바꿔도 이미 만들어진 fork와 local copy는 남는다.[^7]

즉, **라이선스 없음은 오픈소스 허가가 아니지만 기술적 비공개도 아니다.** 지금은 “법적으로는
대부분의 재사용을 허가하지 않았지만, 복제에 필요한 자료는 가장 편한 형태로 공개”된 상태다.

### 4.2 각 대책이 실제로 막는 것

| 대책 | 일괄 복제 | 브라우저 역분석 | 실행 위치 제한 | 법적 증거 | 비용/부작용 | 판단 |
|---|---:|---:|---:|---:|---|---|
| 저장소 private 전환 | 강함 | 못 막음 | 없음 | 보통 | 협업·Pages 플랜/배포 변경 | 즉시 권장 |
| private 원본 → 공개 build 산출물 | 강함 | 일부만 지연 | 없음 | build 기록 | 빌드 체계 필요 | 가장 균형 좋음 |
| 서버로 핵심 로직 이동 | 매우 강함 | 강함 | 강함 | 서버 이력 | 비용·지연·오프라인 기능 저하 | 핵심 IP에만 권장 |
| Terser minify/mangle | 약함 | 약함 | 없음 | 없음 | 무료, 디버깅 어려움 | 기본 위생 |
| source map 비공개 | 원본 노출 감소 | 약함 | 없음 | 없음 | 운영 디버깅 절차 필요 | 반드시 적용 |
| 상용 난독화/anti-tamper | 중간 | 중간 | domain lock 가능 | watermark 옵션 | 비용·성능·오탐·디버깅 | 선택적 2차 방어 |
| CSP/SRI/WAF/App Check | 복제 못 막음 | 못 막음 | API 악용은 억제 | 로그 | 각기 다름 | IP 보호와 혼동 금지 |
| proprietary 고지/약관 | 못 막음 | 못 막음 | 계약상 제한 | 강함 | 법률 검토 | 반드시 명확화 |
| 저작권 등록·배포 서명 | 못 막음 | 못 막음 | 없음 | 강함 | 행정/운영 비용 | 가치 높은 버전 권장 |

Terser는 변수명 축약과 압축을 제공하지만 source map도 생성할 수 있고, property mangling은
코드를 깨뜨릴 수 있다고 자체 문서가 경고한다.[^8] 따라서 minify는 보안 제품이 아니라
“주석과 의미 있는 이름을 생산 배포물에서 제거해 낮은 노력의 복제를 불편하게 하는” 빌드 단계다.

Jscrambler 같은 상용 제품은 난독화, anti-debugging, anti-tampering, domain lock, watermark를
제공한다고 설명한다.[^9] 그러나 이는 공급자 주장이고, 결국 정상 실행을 위해 브라우저에 코드와
복호화/실행 메커니즘이 함께 도착한다. 숙련된 공격자를 완전히 차단한다고 예산을 잡아서는 안 된다.
PEDAGOGY에서는 private source/build 분리와 서버 IP 경계를 먼저 한 뒤, 복제품이 실제 사업 위험으로
나타났을 때 핵심 모듈에만 성능 회귀를 측정하며 적용하는 순서가 맞다.

### 4.3 PEDAGOGY에 권장하는 IP 구조

**권장안: private monorepo 또는 private source repo + 공개 정적 산출물 저장소**

- private 영역: 사람이 읽는 원본 모듈, 주석, 테스트, HWPX Python/브라우저 엔진 원본,
  Worker 코드·prompt, 운영 문서, threat model.
- 공개 산출물: 해시 이름의 minified JS/CSS, HTML, 필요한 이미지와 공개 설정만.
- 서버 영역: Anthropic prompt와 응답 검증, quota, 유료 플랜 판정, 장기적으로는 차별화가 큰
  조판/변환의 일부.
- 배포: GitHub Actions가 private 원본에서 build하고 Pages 또는 Cloudflare Pages에 배포.
  production source map은 공개하지 않고, 오류 해석용 map은 접근 제한된 artifact로 보관.
- 검증: 산출물 manifest에 파일 SHA-256, commit, build 시각을 기록하고 release/tag와 연결.

모든 HWPX 조판을 서버로 옮기면 소스 보호는 좋아지지만 PEDAGOGY의 로컬·오프라인 장점과 사용자
자료의 외부 전송 최소화가 사라진다. 따라서 “경쟁력이 큰 작은 알고리즘”만 서버로 옮기고,
일반 렌더링·미리보기는 클라이언트에 두는 hybrid가 합리적이다.

### 4.4 권리와 대응

루트 `LICENSE`에는 MIT 같은 오픈소스 라이선스를 무심코 넣지 말고, 의도가 무단 재사용 금지라면
권리자·연도·허용 행위·금지 행위·별도 허가 연락처를 명확히 한 proprietary notice를 법률가와
검토해야 한다. 제3자 오픈소스 라이브러리는 각 원 라이선스를 계속 고지해야 한다.

한국저작권위원회는 저작권 등록 시 저작자·창작일 등에 추정력이 생기고, 등록 저작권 침해자의
과실이 추정되는 등의 효력을 안내한다. 창작일 추정을 받으려면 창작 후 1년 이내 등록이라는 조건도
있다.[^10] 가치가 큰 정식 출시 버전은 프로그램 저작물 등록을 검토할 만하다. Git commit, CI log,
서명된 release manifest, 디자인 원본과 기획 기록도 함께 보관한다.

GitHub에 명백한 무단 복제가 올라오면 GitHub에는 저작권자용 DMCA notice와 상대방의 counter
notice 절차가 있다.[^11] 자동 탐지 결과만으로 곧바로 신고하지 말고, 원본성·복제된 표현·라이선스·
상대 저장소 이력을 사람이 확인하고 필요하면 변호사와 판단해야 한다. 상표·사칭은 저작권과 다른
신고 절차다.

## 5. API 과금 공격: 현재 방어와 남은 구멍

### 5.1 현재 사용자별 quota는 좋지만 조직 예산은 막지 못한다

현재 방어가 보장하는 것은 대략 다음 식이다.

`한 UID의 하루 호출 수 <= 해당 플랜 limit`

하지만 사업자가 원하는 금전 상한은 다음 식이다.

`모든 UID 호출 비용 + 재시도/도구 비용 <= 조직의 일/월 예산`

Google 계정 100개를 자동 생성하거나 탈취 계정을 모으면 UID별 50회 제한은 최대 5,000회가 된다.
Origin 검사는 브라우저의 다른 사이트 호출을 막는 데 유용하지만 스크립트 클라이언트는 Origin을
위조할 수 있다. 코드의 `MAX_DAILY_LIMIT = 10_000`은 잘못된 plan 설정의 상한이지 조직 전체
상한이 아니다.

### 5.2 필요한 4중 과금 차단

1. **Anthropic 계정 최종 상한**
   - PEDAGOGY 전용 workspace/API key를 사용한다.
   - 초기에는 auto-reload를 끄거나 매우 낮게 두고 선불 잔액을 손실 최대치로 삼는다.[^5]
   - Console의 usage tier, RPM/ITPM/OTPM, spend limit을 주기적으로 증거화한다. Anthropic은
     rate limit을 조직 단위 RPM·input token/min·output token/min으로 설명한다.[^12]

2. **Worker 전역 circuit breaker**
   - 전체 사용자 합산 `global:{date}` Durable Object에 일일 호출/추정 비용 상한을 둔다.
   - 최근 1분·10분 burst, 오류율, 신규 UID 비율을 별도 집계한다.
   - 환경 변수 또는 KV/DO로 즉시 AI 기능만 끌 수 있는 kill switch를 둔다.
   - quota를 “호출 횟수”뿐 아니라 입력 byte/token·출력 token의 보수적 최대 비용으로 계산한다.

3. **클라이언트 진위·자동화 억제**
   - Firebase App Check를 먼저 monitor mode로 배포하고 정상/비정상 지표를 본 뒤 Firestore와
     Storage에서 enforcement한다. Firebase도 등록만으로는 차단되지 않고 enforcement를 켜야
     한다고 명시한다.[^13]
   - Worker 요청에는 App Check token을 별도 header로 보내고 custom backend에서 검증한다.
     limited-use token과 replay protection은 latency와 구현 복잡도가 있으므로 AI POST처럼 비싼
     endpoint에 우선 적용한다.[^14]
   - 의심 traffic 또는 가입/고비용 기능에는 Turnstile을 붙일 수 있다. client widget만으로는
     보호되지 않고 server-side Siteverify가 필수이며 token은 5분·1회용이다.[^15]

4. **edge rate limit과 알림**
   - Worker를 `workers.dev`에서 `api.<custom-domain>`으로 옮긴다. Cloudflare도 production
     Worker에는 route/custom domain을 권하고 `workers.dev`는 hobby 용도라고 설명한다.[^16]
   - custom domain의 path/method별 rate limiting을 적용한다. Free plan은 IP 기준 1개 rule과
     10초 period 등 제약이 크고 고급 특성은 상위 플랜 의존이다.[^17]
   - custom domain 전환 뒤 기존 `workers.dev` endpoint를 꺼야 우회 경로가 남지 않는다.
   - 429, 401/403 급증, Anthropic 5xx, 전역 quota 50/75/90%를 알림으로 보낸다.

Google Cloud budget alert만 믿으면 안 된다. 공식 문서도 alerts-only budget은 사용량이나 청구를
자동으로 막지 않는다고 경고한다.[^18] Pub/Sub 알림을 Worker kill switch나 운영 runbook과 연결해야
비로소 제어가 된다.

### 5.3 추가 가용성 조치

Worker의 Anthropic `fetch()`에는 명시적인 `AbortController` timeout이 없다. 플랫폼 상한만 기다리면
느린 공급자 응답이 동시 처리와 UX를 오래 점유할 수 있다. 45~60초 같은 명시적 timeout, 한정된
재시도(POST 자동 재시도 금지 또는 idempotency 설계), 실패율 circuit breaker를 둔다. 이미 외부 호출
전에 quota를 소비하는 정책은 비용 상한 측면에서는 보수적이므로 유지하되 사용자에게 “실패도 시도
1회로 계산”됨을 명확히 알린다.

## 6. App Check와 WAF를 PEDAGOGY에 정확히 적용하는 법

현재 `service-config.js`의 `appCheckSiteKey`는 빈 문자열이다. 앱에는
`ReCaptchaEnterpriseProvider` 초기화 코드가 있지만 key가 없으면 실행되지 않는다. Worker의
preflight는 `Content-Type, Authorization`만 허용하며 App Check header를 받거나 검증하는 코드가
없다. Firebase 콘솔 enforcement 상태는 저장소로 확인할 수 없다.

따라서 현 상태를 “App Check 대응 완료”라고 표시하면 안 된다. 권장 rollout은 다음과 같다.

1. production 도메인만 허용한 reCAPTCHA Enterprise web key를 만든다. Firebase는 production key에
   `localhost`를 넣지 말라고 권고한다.[^13]
2. 별도 debug provider/token으로 로컬·CI 환경을 분리한다.
3. client key를 넣고 1~2주 monitor mode에서 valid/invalid/unknown 비율을 수집한다.
4. Firestore → Storage 순으로 enforcement하고 로그인·저장·이미지 업로드·구형 탭을 확인한다.
5. Worker에 App Check token header와 검증을 추가한다. ID token은 “누구인지”, App Check는
   “승인한 앱 흐름인지”를 보므로 둘 다 유지한다.
6. 고비용 AI POST에는 limited-use/replay protection feasibility를 별도로 검증한다.

App Check는 웹 브라우저를 신뢰 실행환경으로 바꾸지 않는다. 공격자가 정상 브라우저 자동화를 하면
통과할 수 있고 token 탈취도 가능하다. 그러나 단순 REST script와 대량 다계정 abuse 비용을 높이는
유용한 신호다. 그래서 전역 quota와 공급자 spend ceiling을 제거해서는 안 된다.

## 7. 사용자 데이터·개인정보에서 추가로 본 위험

### 7.1 Storage download URL

현재 이미지는 업로드 뒤 `getDownloadURL()` 결과를 문제 데이터에 저장한다. 저장소 주석도
`?token=...` URL은 Rules와 무관하게 열린다고 명시한다. 이 URL이 JSON 공유, 로그, 브라우저 기록,
화면 캡처 등으로 유출되면 Firebase 계정 권한과 별개로 파일을 볼 수 있다.

Firebase 공식 문서는 `getBlob()`/`getBytes()`를 쓰면 URL 직접 다운로드 대신 Security Rules를 통한
더 세밀한 접근통제가 가능하다고 안내한다.[^19] 장기적으로는 문제 JSON에 공개 download URL 대신
Storage object path를 저장하고, 로그인 SDK로 blob을 받아 object URL로 표시하는 쪽이 안전하다.
공유 기능이 필요하면 서버가 짧은 TTL의 명시적 공유 링크를 발급하고 취소·감사 가능하게 만든다.

### 7.2 localStorage와 공용 기기

문제집 저장 키는 UID에 따라 분리된 경로가 많지만 브라우저 저장소 자체는 암호화된 계정 금고가
아니다. OWASP는 localStorage의 민감 데이터가 한 번의 XSS 또는 로컬 기기 권한으로 읽힐 수 있고,
인증을 전제로 한 기밀 저장소로 쓰지 말라고 권고한다.[^4]

특히 `document-editor.html`의 `PEDAGOGY_DOCUMENT_BETA` 초안 키는 UID와 무관하고 페이지 초기화 때
로그인 전 바로 읽힌다. 따라서 같은 브라우저 profile을 쓰는 다음 사람이 주소를 직접 열면 이전
초안을 볼 수 있다. AI 문서 입구가 현재 화면에서 숨겨져 있어 일반 노출은 낮지만, 기능을 다시
노출하기 전에는 다음 중 하나가 필요하다.

- 비로그인 local-only 기능임을 명시하고 “초안 지우기/종료 시 삭제”를 제공한다.
- 로그인 기능이면 UID별 key로 분리하고 logout/account switch 때 메모리·화면을 즉시 비운다.
- 민감 자료를 허용해야 한다면 사용자 passphrase 기반 암호화처럼 key가 브라우저 저장소에 같이
  남지 않는 설계를 검토한다. 단순 WebCrypto 암호화 후 같은 origin에 key까지 저장하는 것은 XSS를
  막지 못한다.

### 7.3 AI로 보내는 교육자료

현재 UI는 이름·연락처·성적 등 개인정보를 넣지 말라는 확인을 받지만 탐지는 하지 않는다. 수학
시험지 이미지에는 학생 이름·학교·학번·성적이 이미지 픽셀로 포함될 수 있어 전화번호 정규식만으로
충분하지 않다.

권장 정책은 “조용히 임의 마스킹”이 아니라 다음 흐름이다.

1. 로컬에서 명확한 텍스트 패턴을 1차 탐지한다.
2. 이미지 OCR/민감정보 검사는 사용자가 AI 전송을 선택한 시점에만 한다.
3. 탐지 종류와 영역을 보여주고 전송 취소·사용자 확인·마스킹 중 선택하게 한다.
4. 원문, base64, AI 출력, DLP quote를 애플리케이션 로그에 남기지 않는다.
5. 오탐/미탐을 한국 학교 양식 fixture로 측정한다.

Google Sensitive Data Protection은 텍스트와 이미지 OCR의 infoType 탐지·좌표·redaction을 지원하지만
API 자체의 비용·지연·외부 전송이 생긴다.[^20] 초기 PEDAGOGY에는 client OCR + 사용자 확인을 먼저
시험하고, 학교/B2B 계약에서 중앙 정책이 필요할 때 managed DLP를 고려하는 편이 낫다.

Anthropic은 상용 API 입력/출력을 기본적으로 모델 훈련에 사용하지 않는다고 안내한다.[^21]
표준 API 입력/출력은 예외를 제외하고 30일 이내 삭제가 기본이며, 별도 승인을 받은 일부 enterprise
API 고객은 zero data retention 계약을 맺을 수 있다.[^22] 서비스 고지에는 “절대 저장하지 않는다”가
아니라 실제 계약과 이 예외를 반영해야 한다.

## 8. 웹·브라우저 보안

### 8.1 CSP와 HTTP headers

현재 `index.html`에는 meta CSP가 있으나 `script-src 'unsafe-inline'`, `style-src 'unsafe-inline'`과 여러
외부 origin을 허용한다. 459 KB 단일 HTML의 인라인 앱 구조 때문에 JavaScript `unsafe-inline`을
제거할 수 없는 상태다. 이는 CSP가 막아야 할 인라인 script injection의 상당 부분을 허용한다.

2026-09-11 실제 배포 응답을 확인한 결과 GitHub Pages는 HSTS는 보내지만 PEDAGOGY 전용
`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy` header는 보내지 않았다. meta CSP는 동작하지만 `frame-ancestors`는 meta에서
지원되지 않고,[^23] report-only 정책과 현대적인 Reporting API endpoint도 HTTP header가 필요하다.[^24]

권장 순서는 다음과 같다.

1. 인라인 JavaScript를 자체 호스팅 ES module로 분리하고 inline handler를 `addEventListener`로 옮긴다.
2. third-party CDN 의존을 가능하면 자체 호스팅하고 SRI는 계속 유지한다.
3. `script-src`에서 `unsafe-inline`을 제거하고 `object-src 'none'`, `base-uri 'none'`,
   `frame-ancestors 'none'`, 제한된 `connect-src`를 사용한다.
4. custom domain을 Cloudflare 앞에 두거나 header 설정 가능한 host로 옮겨 CSP를 HTTP header로 보낸다.
5. 먼저 `Content-Security-Policy-Report-Only`와 reporting endpoint로 정상 위반을 정리한 뒤 enforce한다.

OWASP도 strict CSP를 목표로 하고 inline code를 외부 파일로 이동하라고 권고한다.[^25] 이 refactor는
XSS 방어뿐 아니라 source/build 분리와 테스트 가능한 모듈 경계에도 도움이 된다.

### 8.2 XSS가 중요한 이유

PEDAGOGY는 문제 텍스트, 수식, JSON, AI 결과, HWPX/XML처럼 복잡한 비신뢰 입력을 다룬다. XSS 하나가
생기면 같은 origin의 localStorage 문제집과 Firebase session을 사용할 수 있고, 사용자 대신 Worker를
호출할 수도 있다. 따라서 다음은 계속 회귀로 고정해야 한다.

- 사용자 문자열을 `innerHTML`에 넣는 모든 지점의 sanitizer/escape 문맥
- URL scheme allowlist와 `javascript:`/`data:` 처리
- KaTeX/markdown/AI JSON 경계
- `postMessage` source와 정확한 origin
- 이미지 metadata와 SVG 업로드 정책
- CSP가 실제로 공격 fixture를 막는 red test

## 9. GitHub·빌드 공급망

### 9.1 현재 확인된 간격

- `.github/workflows/verify.yml`은 `actions/checkout@v4`, `setup-node@v4`, `setup-java@v4`,
  `upload-artifact@v4`, `setup-python@v5`처럼 움직일 수 있는 major tag를 사용한다.
- GitHub는 full-length commit SHA가 action을 immutable release로 사용하는 유일한 방법이라고
  안내한다.[^26]
- 저장소에는 `CODEOWNERS`와 `dependabot.yml`이 없다. GitHub 콘솔의 Dependabot alerts,
  secret scanning/push protection, CodeQL, ruleset 활성화 여부는 코드만으로 확인할 수 없다.
- `SECURITY.md`는 있지만 `service-config.js`의 `supportEmail`이 비어 있어 문서 자체가
  “상용 출시 준비 상태가 아니다”라고 표시한다.

### 9.2 권장 최소 기준

1. GitHub 계정과 Cloudflare/Google/Anthropic owner 계정에 phishing-resistant MFA/passkey를 적용한다.
2. `main` ruleset: PR 필수, CI 필수, force-push/delete 차단, 관리자 우회 최소화.
3. 보안 민감 파일(`worker/**`, `firestore.rules`, `storage.rules`, workflows)에 CODEOWNERS review를 둔다.
4. Actions를 검증한 full SHA로 pin하고 Dependabot이 SHA 업데이트 PR을 만들게 한다.
5. GitHub push protection/secret scanning, Dependabot alerts/updates, CodeQL default setup을 켠 뒤
   화면/설정 export를 운영 증거로 남긴다. CodeQL default setup은 public repo에서 사용할 수 있다.[^27]
6. release와 배포 산출물의 manifest/hash/provenance를 보관한다. GitHub artifact attestation은
   build provenance를 서명하지만, attestation 자체가 artifact의 안전성을 보증하는 것은 아니다.[^28]
7. prod/development Firebase project와 Cloudflare environment, Anthropic key를 분리한다.
8. 배포 권한은 CI environment approval과 최소권한 token으로 제한한다.

## 10. 보안 도구 비교와 PEDAGOGY 적합도

| 도구/통제 | 잡는 것 | 못 잡는 것 | 비용·운영 부담 | PEDAGOGY 판단 |
|---|---|---|---|---|
| GitHub CodeQL | JS/TS/Python 등 정적 취약 패턴 | 콘솔 설정, business logic, 운영 abuse | public repo 무료, 낮음 | 즉시 켜기 |
| Semgrep CE/Cloud | 빠른 SAST, custom rule | 실행·권한·콘솔 상태 | CE 무료, rule 튜닝 필요 | CodeQL 보완용 |
| Dependabot | 알려진 의존성 advisory/업데이트 | 자체 코드·CDN runtime 변조 | 낮음 | 즉시 켜기 |
| `npm audit` + OSV-Scanner | lockfile의 알려진 취약점 | 0-day, 잘못된 앱 로직 | 무료, 매우 낮음 | CI baseline 권장; OSV는 `package-lock.json` 지원[^29] |
| GitHub secret scanning/push protection | 알려진 key/token push 차단 | custom secret 전부, 이미 노출 후 악용 | public repo에서 높은 효율 | 즉시 켜기 |
| Gitleaks | 현재 파일과 Git history의 secret pattern | 유효성·권한·모든 custom secret | 무료, 오탐 관리 | history 1회 + pre-commit 선택 |
| OWASP ZAP baseline | 배포 header, passive web 취약점 | authenticated business logic 전부 | 무료, 수분 | staging/배포 후 CI 권장[^30] |
| OpenSSF Scorecard | branch, token, pinning, policy 등 공급망 습관 | 앱 취약점의 완전성 | 무료, public repo 친화 | 분기별 위생 점검[^31] |
| Firebase App Check | 승인 앱 흐름 신호, 단순 API abuse | 정상 브라우저 자동화, 계정 탈취 | quota/오탐 rollout 필요 | Firebase와 Worker 모두 우선 적용 |
| Cloudflare Rate Limiting | IP/path/method burst와 bot traffic | Firebase 직접 요청, 다중 IP | plan별 기능 차이 | custom API domain에 우선 적용 |
| Turnstile | 사람/자동화 risk 신호, 1회 token | 계정 탈취·사람 farm | 비교적 낮음, UX 고려 | 가입/고비용 호출의 step-up |
| Google Sensitive Data Protection | 텍스트·이미지 OCR PII 탐지/비식별화 | 완전한 정확도, 로컬-only 보장 | 호출 비용·지연·정책 튜닝 | B2B/민감자료 단계에서 선택 |
| Security Command Center | Google Cloud IAM/Storage/logging 등 misconfiguration | GitHub·Cloudflare·Anthropic 전반 | tier별 차이, 콘솔 운영 | Google 영역 보조 도구. 지원 resource가 한정되므로 단일 CSPM으로 오해 금지[^34] |
| Jscrambler | 난독화, tamper/debug 저항, domain lock/watermark | 최종적인 client 코드 비밀성 | 유료, 성능·디버깅·vendor lock-in | 핵심 IP에만 후순위 실험 |
| 외부 침투 테스트 | 도구가 놓친 조합·business logic | 지속 모니터링 | 인력 비용 | 유료 출시 직전과 큰 변경 후 |

도구를 많이 넣는 것보다 각 finding의 owner, 수정 SLA, 예외 만료일을 정하는 것이 중요하다.
OWASP Top 10 2025도 broken access control, security misconfiguration, software supply chain,
logging/alerting을 주요 범주로 두고 있으며,[^32] ASVS 5.0은 실제 검증 요구사항의 기준으로 쓸 수
있다.[^33] PEDAGOGY는 ASVS Level 1 전체와 비용·파일 업로드·계정 삭제·AI 전송에 해당하는 Level 2
항목을 선별한 release checklist가 적절하다.

개발 프로세스는 NIST SSDF 1.1의 네 갈래, 즉 조직 준비, 소프트웨어 보호, 안전한 소프트웨어 생산,
취약점 대응을 가벼운 운영 문서에 매핑하면 된다.[^35] 별도의 인증 배지를 먼저 목표로 하기보다
각 control에 코드·테스트·콘솔 캡처·담당자라는 증거를 연결하는 편이 이 규모에서 효과적이다.

## 11. 권장 실행 순서

### 0단계 — 1~2일, 의사결정과 금전 상한

- 저장소를 private으로 바꿀지, 공개 OSS로 갈지 명시적으로 결정한다.
- 무단 재사용 금지가 목표라면 proprietary notice와 권리자를 확정한다.
- Anthropic 전용 workspace/key, auto-reload, prepaid 잔액, usage/spend limit을 캡처해 증거화한다.
- AI 전역 일일 상한과 kill switch 값을 사업자가 감당 가능한 금액에서 역산한다.
- `supportEmail`을 실제 private security contact로 채운다.
- Firebase/Cloudflare/GitHub/Anthropic owner 계정의 MFA와 복구 수단을 점검한다.

### 1단계 — 3~7일, 가장 높은 기술 효율

- private source → minified artifact 배포 파이프라인을 만든다. production source map은 공개하지 않는다.
- Worker custom domain을 만들고 `workers.dev` 우회 경로를 닫는다.
- Worker 전역 quota, burst limit, kill switch, alert를 추가한다.
- App Check monitor mode를 켜고 Worker header/verification까지 구현한다.
- GitHub CodeQL, Dependabot, push protection, ruleset, CODEOWNERS, action SHA pinning을 적용한다.
- Storage path 저장 + authenticated blob 읽기 prototype을 만든다.

### 2단계 — 1~3주, 웹·데이터 강화

- 8,022줄 인라인 앱을 module로 분리하고 strict CSP report-only → enforce로 전환한다.
- custom domain에서 CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy,
  frame-ancestors를 HTTP header로 제공한다.
- AI 텍스트·이미지 개인정보 탐지와 사용자 확인 UX를 fixture로 검증한다.
- document editor 초안을 UID별 분리하거나 local-only 삭제 정책을 명확히 한다.
- Anthropic timeout/circuit breaker와 보수적 비용 계측을 추가한다.

### 3단계 — 유료/B2B 출시 전

- ASVS 기반 독립 보안 검토와 authenticated DAST를 수행한다.
- backup/restore drill, 계정 삭제와 Storage token 폐기, incident response tabletop을 한다.
- 로그 schema, 보존 기간, 접근 권한, alert owner와 대응 SLA를 문서화한다.
- 프로그램 저작권 등록과 상표/약관을 전문가와 검토한다.
- 실제 복제 위험이 사업 지표로 나타날 때만 상용 난독화/watermark를 A/B 성능 검증한다.

## 12. 출시 전 확인표

| 질문 | 현재 증거 | 상태 |
|---|---|---|
| Anthropic key가 client/repo에 없는가 | Worker secret 사용 | 확인 |
| ID token 검증과 UID quota가 원자적인가 | Worker 코드·회귀 존재 | 확인 |
| 조직 전체 금전 hard stop이 있는가 | 코드에 전역 quota 없음, 콘솔 미확인 | 미확인/필요 |
| App Check key와 enforcement가 실제 켜졌는가 | client key 빈 값, Worker 미지원 | 미완료 |
| Firebase Rules가 배포본과 같은가 | repo rules는 강함, 콘솔 parity 증거 없음 | 미확인 |
| Storage URL 유출 뒤 취소 가능한가 | 장기 download token URL 저장 | 개선 필요 |
| strict CSP와 clickjacking 방어가 header로 있는가 | 실제 배포 header 없음, meta는 unsafe-inline | 개선 필요 |
| source 원본이 비공개인가 | GitHub public, 읽기 쉬운 배포물 | 미완료 |
| 권리/재사용 조건이 명확한가 | root license 없음 | 명확화 필요 |
| 보안 신고 채널이 작동하는가 | SECURITY.md 있음, supportEmail 빈 값 | 미완료 |
| dependency advisory가 있는가 | 2026-09-11 npm audit 0 | 현재 확인 |
| GitHub 공급망 controls가 켜졌는가 | workflow 일부 확인, 콘솔 상태 미확인 | 미확인 |
| 보안 이벤트가 담당자에게 알림되는가 | Worker 10% log sampling, alert 증거 없음 | 미확인 |
| 공용 기기에서 이전 사용자 초안이 분리되는가 | document draft key가 전역 | 개선 필요 |

## 13. 최종 권고

PEDAGOGY에서 지금 돈을 써야 할 순서는 “고가 보안 제품 구매”가 아니다.

1. **private source/build 분리 + 핵심 IP 서버 경계**
2. **전역 과금 hard stop + App Check + Worker custom domain/rate limit**
3. **Storage token, strict CSP/headers, 브라우저 초안 분리**
4. **GitHub native 보안 기능과 운영 알림**
5. **저작권 등록·명확한 proprietary 조건·복제 대응 절차**
6. 필요가 입증된 뒤 **DLP, SCC 상위 tier, 상용 난독화**

가장 중요한 현실은 분명하다. 사용자의 브라우저에서 실행되는 코드의 절대 비밀성은 달성할 수
없다. 하지만 현재처럼 원본 저장소·주석·테스트·서버 코드까지 한 번에 공개하는 상태에서,
private source와 최소 공개 산출물, 서버측 차별화 로직, 법적 증거를 조합하면 무단 복제의 비용과
사업상 대응력은 크게 개선할 수 있다.

## Sources

[^1]: [GitHub REST API — `071205/pedagogy` repository metadata](https://api.github.com/repos/071205/pedagogy)
[^2]: [GitHub Docs — What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
[^3]: [MDN — What are browser developer tools?](https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Tools_and_setup/What_are_browser_developer_tools)
[^4]: [OWASP — HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
[^5]: [Anthropic Help Center — API billing and prepaid usage credits](https://support.anthropic.com/en/articles/8977456-how-do-i-pay-for-my-api-usage)
[^6]: [Firebase — Learn about and manage API keys](https://firebase.google.com/docs/projects/api-keys)
[^7]: [GitHub Docs — Licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
[^8]: [Terser — JavaScript compressor and mangler documentation](https://github.com/terser/terser)
[^9]: [Jscrambler — Code Integrity documentation](https://docs.jscrambler.com/code-integrity/faq)
[^10]: [한국저작권위원회 — 저작권 등록](https://www.copyright.or.kr/business/registration/index.do)
[^11]: [GitHub Docs — DMCA Takedown Policy](https://docs.github.com/en/site-policy/content-removal-policies/dmca-takedown-policy)
[^12]: [Anthropic Help Center — API rate limits](https://support.anthropic.com/en/articles/8243635-our-approach-to-api-rate-limits)
[^13]: [Firebase — App Check with reCAPTCHA Enterprise for web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
[^14]: [Firebase — Verify App Check tokens from a custom backend](https://firebase.google.com/docs/app-check/custom-resource-backend)
[^15]: [Cloudflare — Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
[^16]: [Cloudflare — Workers routes and domains](https://developers.cloudflare.com/workers/configuration/routing/)
[^17]: [Cloudflare — WAF rate limiting rules and plan availability](https://developers.cloudflare.com/waf/rate-limiting-rules/)
[^18]: [Google Cloud — Budgets and budget alerts](https://cloud.google.com/billing/docs/how-to/budgets)
[^19]: [Firebase — Download files from Cloud Storage on web](https://firebase.google.com/docs/storage/web/download-files)
[^20]: [Google Cloud — Inspect and redact sensitive data in images](https://cloud.google.com/sensitive-data-protection/docs/redacting-sensitive-data-images)
[^21]: [Anthropic Privacy Center — Commercial data and model training](https://privacy.anthropic.com/ko/articles/7996868-%EB%82%B4-%EB%8D%B0%EC%9D%B4%ED%84%B0%EA%B0%80-%EB%AA%A8%EB%8D%B8-%ED%9B%88%EB%A0%A8%EC%97%90-%EC%82%AC%EC%9A%A9%EB%90%98%EB%82%98%EC%9A%94)
[^22]: [Anthropic Privacy Center — Commercial data retention](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)
[^23]: [MDN — CSP `frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
[^24]: [MDN — Content Security Policy guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
[^25]: [OWASP — Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
[^26]: [GitHub Docs — Secure use of GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use)
[^27]: [GitHub Docs — Configure CodeQL default setup](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configure-code-scanning)
[^28]: [GitHub Docs — Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
[^29]: [Google — OSV-Scanner supported artifacts and manifests](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)
[^30]: [OWASP ZAP — Baseline Scan](https://www.zaproxy.org/docs/docker/baseline-scan/)
[^31]: [OpenSSF — Scorecard](https://scorecard.dev/)
[^32]: [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
[^33]: [OWASP — Application Security Verification Standard 5.0](https://owasp.org/www-project-application-security-verification-standard/)
[^34]: [Google Cloud — Security Health Analytics overview](https://cloud.google.com/security-command-center/docs/concepts-security-health-analytics)
[^35]: [NIST SP 800-218 — Secure Software Development Framework 1.1](https://csrc.nist.gov/pubs/sp/800/218/final)
