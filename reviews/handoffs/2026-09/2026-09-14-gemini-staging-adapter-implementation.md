# 변경 인계 — OPS-6A Gemini staging 어댑터 구현

- ID: `HANDOFF-2026-138`
- 날짜: `2026-09-14`
- 작성자: `Codex / Terra medium`
- 상태: `changes-requested`
- 영향 영역: `worker | tests | docs`
- 관련 이슈: `REV-2026-091`, `REV-2026-092` (REV-074·075 상태 변경 없음)

## 변경 내용

`worker/gemini.js`에 Gemini 2.5 Flash의 순수 요청/응답 경계를 추가하고, `worker/index.js`에
`AI_PROVIDER=gemini` 분기를 구현했다. 기본은 Anthropic 유지다. Gemini는 전용 secret·정확한 model,
단발 REST·생각0/4096·candidate1, Gemini 비지원 GIF quota 전 거절, timeout/redirect 실패, 단일 안전
telemetry(`thinking_tokens` 포함)를 강제한다. 자동 재시도/fallback·배포 설정 변경은 없다.

`worker/gemini.test.mjs`를 `test:worker`에 연결했다. 기존 telemetry audit의 provider response 누출
anchor는 응답 JSON 직후으로 옮겨 mutation 검출을 유지했다.

## 위험과 검토 요청

Gemini staging secret/모델 접근은 아직 확인하지 않았고 실제 API 호출도 0회다. `GEMINI_MODEL`은 설계대로
정확히 `gemini-2.5-flash`만 받는다. 기존 Anthropic production 경로·wrangler 설정은 무수정이다.
Gemini free/paid 데이터 적격성과 App Check 실토큰, staging 배포/rollback은 OPS-6B의 별도 확인이다.

## 검증

- `node worker/gemini.test.mjs`: 통과. config/GIF preflight, 1회 요청, 두 작업, 안전/잘림/형식/HTTP 실패,
  quota/로그 경계 확인. in-memory red probe 3종(4096, 생각0, 누락 thinking token) assertion 실패 확인.
- `npm run test:worker`: 통과. 기존 Worker/App Check/quota/privacy audit 포함; prompt/image/provider response/UID
  누출 변이 각각 exit 1.
- `npm run test:ai-image`: 통과, 기존 red probe도 AssertionError.
- `npm run check:static`, `npm run test:public`, `npm run check:public`, `npm run test:cross:fast`: 통과.
- `python3 serve.py --port 8799` + Chromium `regression-test.html`: 158/158 통과. 종료 후 임시 서버(PID 83255) 종료.
- `git diff --check`: 통과.

## 다음 검토자에게

**Sol medium**은 [설계 §2·4·5·7](../../../docs/GEMINI-STAGING-ADAPTER-DESIGN.md)와 실제 diff를 독립 대조한다.
특히 provider preflight가 quota 전인지, Anthropic 기본 경로가 보존됐는지, Gemini telemetry가 원문/키를
담지 않는지, invalid/blocked/MAX_TOKENS가 성공으로 바뀌지 않는지 확인한다. 문제면 재현 가능한 이슈를
등록하고 Terra 구현으로 반환한다. 문제 없으면 이 파일의 검토 기록에 남기고 OPS-6A 완료/OPS-6B Terra로 넘긴다.

## 검토 기록

- `2026-09-14` — `Codex / Sol medium`: 승인 보류. 가짜 timer/fetch에서 응답 body 읽기 전에
  60초 타이머가 해제됨을 재현했다(`REV-2026-091`). 누락 thinking token red probe는 기준 decoder도
  `undefined !== null`로 실패해 변이 전용 검출이 아님을 재현했다(`REV-2026-092`). 구현 코드는
  수정하지 않았고, Terra medium이 두 이슈를 같은 파일에 해결 근거와 검증 결과로 닫은 뒤 Sol 재검토가 필요하다.
