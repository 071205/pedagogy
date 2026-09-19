# 변경 인계 — OPS-7 의 502 는 `thinkingLevel: "minimal"` 이었다

- ID: `HANDOFF-2026-145`
- 날짜: `2026-09-19`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `worker`, `staging config`, `docs`
- 관련 이슈: `REV-2026-093`(여전히 `in-progress`)

## 한 일

코덱스가 놓고 간 레일을 이어받았다. 먼저 **5일째 미커밋이던 갈래 B 를 커밋**하고(`e68b73f`),
OPS-7 의 남은 한 걸음(문서 경로 실호출)을 승인 범위에서 실행했다.

**호출 2회 · 재시도 0회 · production 0건.** 둘 다 502 였지만 둘째에서 원인이 나왔다.

| 회차 | 결과 | 얻은 것 |
|---|---|---|
| 1 | 502 · 2,533ms | **없음** — 로그 표본 10% 에 걸려 `ai_usage` 가 안 남았다 |
| 2 | 502 · 1,892ms | `wrangler tail` → `http_error · http_status 400 · 토큰 전부 null` |

**Gemini 가 요청 자체를 400 으로 거절했다.** 우리가 `generationConfig.thinkingConfig.thinkingLevel`
에 `"minimal"` 을 보내고 있었는데, 공식 문서상 **Gemini 3 계열은 `low`·`medium`·`high`** 를 받고
`minimal` 은 Gemini 2.5 계열(예외적으로 `gemini-3.6-flash`)의 값이다. 우리 모델은
`gemini-3.1-flash-lite` 다. 키·egress·공유 용량(503) 어느 것도 아니었다.

## 고친 것

1. **`worker/gemini.js`** — `thinkingLevel` 을 `"low"` 로. 되돌리기 쉬운 값이라 붉은 탐침
   (`thinking-level`)을 그 자리에 두었다.
2. **`worker/index.js`** — 공급자의 **표준 오류 코드만** telemetry 에 남긴다
   (`provider_error_status`). ⚠️ **메시지·본문은 안 남긴다** — `/^[A-Z][A-Z_]{2,39}$/` 를
   통과하는 열거값만 받고 나머지는 버린다. 오류 본문은 `clone()` 으로 읽어 **fetch 는 여전히
   한 번**이고, 재시도 금지 붉은 탐침이 그것을 계속 지킨다.
3. 검사 셋 추가 — 코드 기록 · 자유 문자열 거부 · JSON 이 아닌 본문.
4. staging 배포 `8a4f3aa4-b70d-452e-bf76-ca5d8b29bd3d`(설정값 변경 0).

## 위험과 검토 요청

⚠️ **②가 원문 비노출 계약을 건드린다.** 지금까지 telemetry 는 공급자 응답에서 **아무것도**
읽지 않았다. 여기가 제일 봐 주었으면 하는 곳이다. 근거는 이렇다 — 이 칸이 없어서 공급자
400·404·503 이 전부 **같은 502 한 줄**이 되고, 원인을 보려고 **승인된 실호출을 한 번 더**
써야 했다. 열거값만 통과시키는 것이 그 대가로 충분한지 판단해 달라.

⚠️ **실제 성공을 아직 못 봤다.** 오늘 한도 2/2 를 썼다. UTC 날짜가 바뀌면(한국 09:00)
**문서 1회**로 확인할 수 있고, 새 승인이 필요하다.

⚠️ **09-14 의 '이미지 성공' 은 근거로 쓰지 않았다.** 그 회차의 로그 증적이 저장소에 없어
그때 본문이 지금과 같았는지 확인할 방법이 없다. 부정하지도 않는다.

## 기록이 실제와 달랐던 것 둘

- **익명 로그인은 꺼져 있지 않았다.** 준비 문서와 `HANDOFF-2026-141` 은 09-14 에 껐다고
  적었는데 콘솔에는 '사용 설정됨' 이었다. 남은 검증 1회를 위해 **켠 채로 두고**, OPS-7 마무리
  항목으로 적어 두었다.
- **staging Firebase 프로젝트는 두 번째 구글 계정(`/u/1`)에 있다.** 이 컴퓨터의 Firebase CLI
  는 첫 계정이라 `403` 이 나고 `projects:list` 에도 안 보인다 — 없어진 것이 아니다.

## 다음 사람에게 — 검증 호출 절차

⚠️ **표본율을 올리려고 재배포하지 말 것.** `recordMetric` 기본값이 `console.log` 라
`wrangler tail` 이 표본율과 무관하게 전부 보여 준다. 복원할 것도 없다.

```bash
npx wrangler tail --config worker/wrangler.staging.toml &   # 붙여 두고
# 익명 토큰 발급 → 문서 1회 → outcome·http_status·토큰 수 확인
```

임시 익명 계정은 쓰고 나서 지운다(이번 회차 것은 지웠다).

## 검증

- `node worker/gemini.test.mjs` · `npm run test:worker` 통과.
- **깨보기**: `provider_error_status` 를 늘 null 로 만들자 새 검사가 빨간불
  (`expected 'INVALID_ARGUMENT', actual null`). 되돌리니 통과.
- `npm run check:review-hygiene` 통과.
- `npm run check:launch` 는 **빨간불이 정상**이다 — 출시 전 게이트이고 CI·`check:fast` 에
  걸려 있지 않다. 이번 변경과 무관한 항목 여덟이다.

## ⚠️ 2026-09-19 (둘째) — 이 인계의 진단은 틀렸다

승인받은 호출 1회를 더 부르자 `provider_error_status: FAILED_PRECONDITION` 이 나왔고,
콘솔이 **staging 프로젝트에 결제 계정이 없음**을 확인해 주었다. `thinkingLevel` 은 원인이
아니었다(고친 것 자체는 규격상 맞다). 자세한 것은 `REV-2026-093` 의 마지막 절.

여기서 배운 것은 그대로 남긴다 — **공급자 오류를 코드 없이 추론하면 틀린다.** 이 인계에서
넣은 `provider_error_status` 가 바로 다음 호출에서 답을 내놓았다.

## 검토 기록
