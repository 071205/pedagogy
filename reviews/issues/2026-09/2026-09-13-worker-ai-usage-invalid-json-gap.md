# 비정상 문항 JSON의 비용 측정 이벤트가 누락된다

- ID: `REV-2026-089`
- 날짜: `2026-09-13`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `worker`, `tests`
- 관련 인계: `HANDOFF-2026-124`, `HANDOFF-2026-125`

## 요약과 영향

Anthropic이 유효한 Messages 응답과 사용량을 반환했지만 문항 본문이 JSON `null` 또는 문자열이
아니면 Worker는 502를 반환하면서 `ai_usage` 이벤트를 남기지 않았다. quota는 공급자 호출 전에
이미 확정되므로 비용이 든 실패가 실패율과 토큰 표본에서 빠졌다. 사용자 UID나 AI 원문 노출은
재현되지 않았다.

## 재현 절차

1. 실제 네트워크 대신 Anthropic 200 응답에 `input_tokens`, `output_tokens`, `stop_reason`과
   `content[0].text = "null"`을 반환한다.
2. 인증과 quota 가짜 구현을 통해 이미지 문항 변환을 요청한다.
3. HTTP 상태, quota 순서와 기록된 `ai_usage` 이벤트 수를 확인한다.

## 기대 결과 / 실제 결과

- 기대: 502로 거절하되 `json_parse_error` 이벤트를 정확히 한 번 기록하고 공급자 토큰을 보존한다.
- 실제(수정 전): HTTP 502, quota `reserve → consume`, 이벤트 0건.

## 근거

수정 전 `callAI`는 `JSON.parse("null")` 다음에 보호 범위 밖에서 `parsed.problems`를 읽었다.
이때 발생한 `TypeError`에는 이미 만든 telemetry가 붙지 않아 Worker catch가 기록할 수 없었다.
`content[0].text`가 숫자일 때 `.replace()`가 던지는 예외도 같은 경로였다.

## 처리 기록

- `2026-09-13` — `Codex`: 독립 검토에서 가짜 공급자 응답으로 등록. 검증: 502, quota 확정,
  이벤트 0건을 재현했다.
- `2026-09-13` — `Codex`: 문자열 확인·JSON 파싱·최상위 구조 검사를 하나의 try/catch 경계로
  묶고 모든 실패를 기존 telemetry가 포함된 `AiGenerationError`로 변환했다. `null` 응답에서
  토큰 144/7과 `end_turn`을 보존한 `json_parse_error` 이벤트 1건을 확인했다. 모든 console
  메서드를 포착해 이미지·UID·인증 토큰·공급자 응답 표식이 없음을 확인했다.

- `2026-09-13` — `Codex` (HANDOFF-126): 문항·문서 20종 응답에서 토큰 보존·이벤트 1회 기록을
  독립 재확인해 resolved를 유지한다. 문서 프롬프트 누출을 놓치는 검사 결함은 별도 REV-2026-090이다.
