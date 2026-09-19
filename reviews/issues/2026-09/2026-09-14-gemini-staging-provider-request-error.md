# staging Gemini 요청이 provider HTTP 응답 전에 실패한다

- ID: `REV-2026-093`
- 날짜: `2026-09-14`
- 보고자: `Codex / Sol medium`
- 상태: `in-progress`
- 심각도: `P2`
- 영향 영역: `worker`, `staging config`
- 관련 인계: `HANDOFF-2026-141`

## 요약과 영향

승인된 격리 staging에서 합성 문제 이미지와 문서 요청을 각 1회 실행했지만 두 요청 모두 Gemini의
HTTP 응답을 받기 전에 `request_error`로 끝나 Worker가 502를 반환했다. production은 건드리지 않아
실사용 영향은 확인되지 않았지만, OPS-7의 모델 접근·출력·token 측정과 이후 OPS-8을 진행할 수 없다.

## 재현 절차

1. staging Worker version `32c03142-05f8-4647-89bb-8307d0009f89`에서 logs sampling을 100%로 둔다.
2. staging Firebase 유효 토큰으로 합성 PNG를 한 번 요청한다.
3. 같은 계정으로 개인정보 없는 짧은 문서 prompt를 한 번 요청한다.
4. Worker 응답과 `ai_usage`의 안전 필드만 확인한다.

기존 2회/$1 승인은 위 두 시도로 소진됐다. 이 절차를 새 승인 없이 반복하지 않는다.

## 기대 결과 / 실제 결과

- 기대: 각 요청이 Gemini HTTP 응답을 받아 성공 구조 또는 안전한 provider HTTP 오류와 상태를 남긴다.
- 실제: 이미지·문서 모두 502였다. `ai_usage`는 각 task에 `outcome=request_error`, token 필드와
  `http_status`는 null이었다. quota는 provider 호출 전에 두 번 모두 확정됐다.

## 근거

무효 Firebase 토큰은 401로 차단됐고 유효 토큰은 App Check `monitor` 로그 뒤 사용자·전역 Durable
Object의 reserve·consume을 통과했다. 그러므로 실패는 origin·Firebase 인증·본문 검사·quota 이전이
아니라 `geminiResponse`의 fetch 경계다. 오류 원문, 요청/응답, UID, token, secret은 수집하지 않았다.
성공 응답이나 provider HTTP 상태가 없어 credential 값·header 형식·redirect·Cloudflare egress 중 어느
원인인지는 아직 단정하지 않는다.

## 제안 (선택)

Terra medium이 외부 provider 호출 없이 secret 전달 형식, header 구성, fetch 예외 분류를 먼저 점검하고
재현 가능한 원인이 있으면 회귀를 추가한다. 수정은 Sol medium이 독립 검토한다. 실환경 재검증은 별도
대상·호출 수·금액 승인을 받은 뒤에만 한다.

## 처리 기록

- `2026-09-14` — `Codex / Sol medium`: staging 두 시도와 100% live tail로 등록. 자동·수동 재시도 0회.
  logs 10% 복원, 임시 익명 계정 삭제, 익명 제공업체 비활성화, production 변경 0건.
- `2026-09-14` — `Codex / Terra medium`: 원인을 credential/egress 중 하나로 단정하지 않고
  `worker/index.js`에서 API key의 끝 공백·줄바꿈을 header 전에 제거했다. provider redirect는 `follow`나
  `error` 대신 `manual`로 받아 키를 다른 origin에 전달하지 않고 3xx `http_error`로 남긴다. whitespace-only
  key는 quota 전에 거절한다. `worker/gemini.test.mjs`에 padded key·302 redirect와 manual redirect red mutation을 추가했고
  `node worker/gemini.test.mjs`를 통과했다. 실제 Gemini 호출·staging 배포·production 변경은 0건이다.
- `2026-09-14` — `Codex / Sol medium`: 실제 diff를 독립 검토했다. 별도 임시 복제에서 trim 제거 변이를
  주입하자 whitespace-only key가 quota 전 503 대신 provider 경로 502로 진행되어 회귀가 종료 1로 실패했다.
  현 구현의 padded key, manual redirect, 302 `http_error`, 단일 fetch, 안전 telemetry를 확인했고
  `npm run test:worker`, `npm run check:review-hygiene`, `git diff --check`를 통과했다. 구현 결함은 없으나
  실환경 성공 증거가 없으므로 상태는 `in-progress`를 유지한다. 실제 호출·배포·production 변경 0건.
- `2026-09-14` — `Codex` 세션 보고(**사용자가 대화로 전달 · 이 저장소에 로그 증적 없음**):
  Gemini 2.5 계열이 두 요청 모두 **HTTP 404** 를 냈고, Google 지원 문서가 **신규 프로젝트의 2.5 모델
  접근 제한**을 안내한다. staging 이 새 프로젝트라 조건이 맞았다. 모델을 `gemini-3.1-flash-lite` 로
  바꾸자 **합성 이미지 요청이 성공**해 문제 1개를 만들었고, **같은 키로 성공했으므로 원인은 키·egress
  가 아니라 모델 접근 제한**이었다는 근거가 섰다. 이어진 문서 요청은 Gemini 의 **HTTP 503** 으로 실패했다.
  ⚠️ 그 세션은 정리 도중 사용량으로 끊겨 **이 결과가 기록되지 않았다.**
- `2026-09-15` — `Claude / Opus 5`: 위 보고를 **기록으로 옮기고** 확인 가능한 것만 독립 검증했다.
  · 배포된 staging version `047a96b7-ac39-44e8-8306-291ae6f0987a` 가 `GEMINI_MODEL=gemini-3.1-flash-lite`,
    `DAILY_LIMIT=2`, `GLOBAL_DAILY_LIMIT=2`, `ALLOWED_ORIGINS` 는 localhost 뿐, `APP_CHECK_MODE=monitor`
    — **임시로 올렸던 한도가 복원돼 있다.**
  · **production `dawn-shape-2664` 의 마지막 배포는 `2026-09-01`** (`6e472e0b`) — Gemini 작업 전체가
    production 에 닿지 않았다.
  · `node worker/gemini.test.mjs` · `npm run test:worker` 통과.
  ⚠️ **직접 확인하지 못한 것**: 이미지 성공 응답과 503 의 실제 로그(로그 접근 없음 · 보고를 받은 것이다),
  최신 회차의 임시 계정 삭제·익명 로그인 비활성화·로그 표본 10% 복원 여부(콘솔이 필요하다).

## 503 의 성격 — 우리 결함이 아니다

⚠️ **`503 UNAVAILABLE` 은 `429 RESOURCE_EXHAUSTED` 와 다르다.** 429 는 우리 할당량이고, 503 은
**Google 의 공유 처리 용량**이 포화된 것이다(무료·유료가 같이 겪는다). Google 의 안내는 **지수 백오프
재시도**이고 503 을 재시도 가능한 오류로 명시한다. 그러므로 문서 경로의 503 은 우리 요청 형식 결함이
아니며, **바로 앞서 같은 코드·같은 키·더 큰 본문(이미지)이 성공한 것**이 그 방증이다.

⚠️ **그런데 우리 코드에는 재시도가 없다**(승인 범위가 '재시도 0회' 였다). 그대로 두면 공급자 용량이
잠깐 흔들릴 때마다 **사용자에게 그대로 실패로 보인다.** 재시도 정책은 OPS-8·9 에서 정할 일이지
이 이슈에서 조용히 넣을 것이 아니다.

## 재시도가 지금 안 되는 이유 (실측)

일일 한도는 **UTC 날짜**로 센다(`globalQuotaKey()` 가 `global:YYYY-MM-DD`). 코덱스의 호출이
`2026-09-14T15:36~15:41Z` 였고 지금이 같은 UTC 날짜라 **오늘 몫은 이미 소진**됐다. 지금 부르면
Gemini 에 닿기 전에 **우리 Worker 의 429** 에 막힌다 — 코덱스가 마지막에 본 429 가 그것이다.

**`2026-09-15T00:00Z`(한국 09:00) 이후에는 한도가 새로 시작되므로, 설정을 하나도 건드리지 않고
문서 경로 1회만 다시 부르면 된다.** 한도를 임시로 올려 지금 부르는 것은 같은 값을 두 번 바꾸는
일이고, 코덱스가 이미 한 번 그렇게 했다가 복원했다.

## 2026-09-19 — 원인 확정: **`thinkingLevel: "minimal"` 을 Gemini 3 모델에 보냈다**

승인 범위에서 staging 문서 경로를 **2회** 불렀다(재시도 0회 · production 0건). 둘 다 502.

| 회차 | 결과 | 얻은 것 |
|---|---|---|
| 1회 | HTTP 502 · 2,533ms | **아무것도** — 로그 표본이 10% 라 `ai_usage` 가 기록되지 않았다 |
| 2회 | HTTP 502 · 1,892ms | `wrangler tail` 로 실시간 수집 → **원인 확정** |

2회차 telemetry:

```
outcome: 'http_error' · http_status: 400 · duration_ms: 344
input_tokens: null · output_tokens: null · thinking_tokens: null
```

**Gemini 가 요청을 400 으로 거절했다.** 토큰이 전부 null 인 것이 '모델이 아무것도 처리하지
않았다' 는 뜻이고, 344ms 라는 시간도 그와 맞는다. 키·egress·공유 용량(503)이 아니다.

⚠️ 우리가 보내던 `generationConfig.thinkingConfig.thinkingLevel` 이 **`"minimal"`** 이었다.
공식 문서상 **Gemini 3 계열은 `low`·`medium`·`high`** 를 받고 `minimal` 은 Gemini 2.5 계열
(과 예외적으로 `gemini-3.6-flash`)의 값이다. 우리 모델은 `gemini-3.1-flash-lite` 다.

### 왜 09-14 에는 이미지가 성공했는가 — 확인하지 못했다

그 회차의 로그 증적이 이 저장소에 없다(세션이 끊겨 기록되지 않았고, 그 뒤 표본도 10% 였다).
**그때와 지금의 요청 본문이 같았는지 확인할 방법이 없다.** 성공 보고를 부정하지도, 근거로
삼지도 않는다 — 다음 검증이 그 자리를 대신한다.

## 처리 기록 (이어서)

- `2026-09-19` — `Claude / Opus 5`:
  - **수정 ①(결함)**: `worker/gemini.js` 의 `thinkingLevel` 을 `"minimal"` → **`"low"`**.
    되돌리기 쉬운 값이라 붉은 탐침(`thinking-level`)을 그 자리에 두었다.
  - **수정 ②(진단 가능성)**: 공급자의 **표준 오류 코드만** telemetry 에 남긴다
    (`provider_error_status`, 예: `INVALID_ARGUMENT`). ⚠️ **메시지·본문은 남기지 않는다** —
    `/^[A-Z][A-Z_]{2,39}$/` 를 통과하는 열거값만 받고 나머지는 버린다. 이 칸이 없어서
    공급자 400·503·404 가 화면에서도 로그에서도 **똑같은 502 한 줄**이었고, 원인을 보려고
    승인된 실호출을 한 번 더 써야 했다. 검사 셋을 더했다(코드 기록 · 자유 문자열 거부 ·
    JSON 이 아닌 본문). **재시도 금지 계약은 그대로다** — 오류 본문은 `clone()` 으로 읽어
    fetch 가 한 번인 것을 검사가 계속 지킨다.
  - **배포**: staging version `8a4f3aa4-b70d-452e-bf76-ca5d8b29bd3d`. production 0건.
  - **검증**: `node worker/gemini.test.mjs` · `npm run test:worker` 통과. 새 검사를 깨 보아
    (`provider_error_status` 를 항상 null 로) 빨간불이 나는 것까지 확인했다.
  - **남은 것**: **실제 성공을 아직 보지 못했다.** 오늘 한도 2/2 를 썼다. UTC 날짜가 바뀌면
    (한국 09:00) **문서 1회**만 더 부르면 된다 — 새 승인이 필요하고, 그때는
    `wrangler tail` 을 붙여 표본율과 무관하게 telemetry 를 받는다.
  - 상태는 `in-progress` 를 유지한다(원인·수정은 섰지만 실환경 성공 증거가 없다).

⚠️ **기록이 실제와 달랐다**: `docs/AI-MEASUREMENT-DEPLOYMENT-PREP.md` 와 `HANDOFF-2026-141`
은 09-14 정리 때 **익명 로그인을 비활성화했다**고 적었는데, 2026-09-19 에 콘솔을 열어 보니
**'사용 설정됨'** 이었다. 마지막 회차가 다시 켜고 기록하지 못한 것으로 보인다. 지금은 남은
검증 1회를 위해 **켠 채로 둔다** — OPS-7 이 끝나면 끄는 것이 마무리 항목이다.

⚠️ **staging Firebase 프로젝트는 두 번째 구글 계정(`/u/1`)에 있다.** 이 컴퓨터의 Firebase
CLI 는 첫 계정으로 로그인돼 있어 `403 PERMISSION_DENIED` 가 나고 `projects:list` 에도
안 보인다. 프로젝트가 없어진 것이 아니다 — 다음 사람이 같은 곳에서 헤매지 않도록 적어 둔다.

## 2026-09-19 (둘째) — **진짜 원인: staging 프로젝트에 결제 계정이 없다**

⚠️ **앞 절의 진단은 틀렸다.** `thinkingLevel: "minimal"` 이 원인이라고 적었는데, 그것은 실제
오류 코드를 보지 못한 채 **공식 문서에서 추론한 것**이었다. 오늘 승인받은 1회를 부르자
새로 넣은 `provider_error_status` 가 답을 그대로 내놓았다.

```
outcome: 'http_error' · http_status: 400
provider_error_status: 'FAILED_PRECONDITION'
duration_ms: 361 · 토큰 전부 null
```

- 공식 문서: `400 FAILED_PRECONDITION` = **"전제 조건이 충족되지 않음(예: 결제 비활성화)"**,
  권고는 "프로젝트 결제 상태나 계정 전제 조건을 확인하라".
- Google Cloud 콘솔(`pedagogy-ai-staging`, 둘째 계정 `/u/1`): **"결제 계정이 없는 프로젝트 —
  이 프로젝트에 결제 계정이 연결되어 있지 않습니다."**

즉 키·egress·요청 형식·모델 접근 모두 아니고 **프로젝트에 결제가 안 붙어 있는 것**이다.
`thinkingLevel` 을 `"low"` 로 고친 것은 규격상 맞지만(Gemini 3 은 low·medium·high),
**502 의 원인은 아니었다.** 되돌릴 이유는 없고, 원인으로 적어 둔 기록만 바로잡는다.

⚠️ **여기서 배운 것**: 공급자 오류를 **코드 없이 추론하면 틀린다.** 어제 그 추론 때문에
승인된 호출 하나를 엉뚱한 가설 검증에 쓸 뻔했다. `provider_error_status` 를 넣은 것이
바로 그다음 호출에서 값을 했다 — 이 칸을 빼지 말 것.

### 남은 것 — 사람이 정할 일

**staging Google Cloud 프로젝트에 결제 계정을 연결할지**가 결정 사항이다. 결제 수단을 다는
일이라 에이전트가 하지 않는다. 연결하지 않으면 OPS-7 은 여기서 더 갈 수 없고, OPS-8 이하도
데이터가 없어 대기다.

- 오늘 호출: **문서 1회**(승인 범위), 재시도 0회, production 0건. 오늘 남은 한도 1회.
- 임시 익명 계정은 만들고 지웠다. 익명 로그인은 검증이 끝날 때까지 켠 채로 둔다.
