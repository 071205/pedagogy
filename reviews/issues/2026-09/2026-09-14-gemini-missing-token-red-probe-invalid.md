# 누락 thinking token 변이 검사가 기준 코드도 실패시킨다

- ID: `REV-2026-092`
- 날짜: `2026-09-14`
- 보고자: `Codex / Sol medium`
- 상태: `resolved`
- 심각도: `P3`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-138`

## 요약과 영향

`worker/gemini.test.mjs`의 `missing-thinking` red probe는 누락된 thinking token이 `null`이라고
단언하지만 현재 기준 decoder는 `undefined`를 반환한다. 따라서 기준 코드와 `?? 0` 변이 코드가 모두
같은 AssertionError를 내며, 해당 변이만 검출했다는 검증 증거가 성립하지 않는다. 현재 제품 telemetry는
`safeTokenCount(undefined)`를 통해 `null`을 기록하므로 이 재현만으로 제품 로그 값 결함을 뜻하지 않는다.

## 재현 절차

1. 기준 `decodeGeminiEnvelope`에 `usageMetadata` 없는 정상 단일 candidate 응답을 전달한다.
2. 반환값의 `thinkingTokens`를 확인한다.
3. red probe와 같은 `thinkingTokens === null` 단언을 실행한다.

## 기대 결과 / 실제 결과

- 기대: 변이 검사는 먼저 기준 코드에서 통과하고, 누락 토큰을 0으로 바꾼 변이에서만 종료 1이어야 한다.
- 실제: 기준값은 `undefined`이고 `undefined !== null` AssertionError로 기준 코드부터 종료 1이다.
  그럼에도 현재 검사는 변이 실행에서 어떤 AssertionError든 받으면 통과한다.

## 근거

`worker/gemini.test.mjs`의 `missing-thinking` check는 변이 모듈에만 실행되며 기준 모듈에는 같은 단언을
실행하지 않는다. `node worker/gemini.test.mjs` 전체는 통과하지만 기준 decoder에 같은 단언을 실행한
독립 명령은 종료 1이었다. 설계 §7은 구문/import/anchor 실패가 아닌 관련 assertion의 변이 전용 실패를
요구하고, 여섯 red 경계를 열거하지만 현재 신규 검사는 세 경계만 포함한다.

## 제안 (선택)

각 변이 check를 기준 모듈에서 먼저 통과시킨 뒤 변이 모듈에서 실패시키고, 설계에 적힌 나머지 body/key
누출·두 번째 fetch·MAX_TOKENS 성공 처리·quota 뒤 config 검사 변이도 관련 동작 단언으로 연결한다.

## 처리 기록

- `2026-09-14` — `Codex / Sol medium`: 기준 decoder 단언 종료 1과 전체 Gemini 검사 통과를 함께
  재현해 등록. 제품 코드·실제 공급자·원격 환경은 변경하지 않았다.
- `2026-09-14` — `Codex / Terra medium`: decoder가 누락 thinking token을 명시적으로 `null`로
  정규화하고, 모든 순수 red probe가 기준 모듈에서 먼저 통과한 뒤 변이에서만 AssertionError가
  나도록 고쳤다. body/key 누출·HTTP 두 번째 fetch·MAX_TOKENS 성공 처리·quota 뒤 config 검사의
  in-memory Worker 변이도 추가했다. `node worker/gemini.test.mjs`와 `npm run test:worker` 통과.
  모든 변이는 기준 exit 0/변이 exit 1 AssertionError를 확인했다.
- `2026-09-14` — `Codex / Sol medium`: 별도 baseline probe에서 누락 thinking token이 null임을
  재확인하고, `npm run test:worker`에서 기준 통과와 변이 AssertionError를 재실행했다. resolved 승인 유지.
