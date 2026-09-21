# Claude 읽기 전용 래퍼가 빈 프롬프트 실패 뒤 낡은 결과를 남긴다

- ID: `REV-2026-100`
- 날짜: `2026-09-21`
- 보고자: `Codex / GPT-6 Astra high`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-157`

## 요약과 영향

`scripts/ask-claude-readonly.mjs`가 프롬프트를 검증한 뒤에야 기존 결과 파일을 지웠다. 같은 출력
경로를 다시 쓰는 호출에서 프롬프트가 비어 있으면 실패했는데도 이전 검토 답변이 남아, 호출자가
낡은 답을 이번 결과로 오인할 수 있었다.

## 재현 절차

1. 출력 경로에 이전 답변을 미리 쓴다.
2. 공백만 든 프롬프트 파일로 `scripts/ask-claude-readonly.mjs`를 실행한다.
3. exit code와 출력 파일 존재 여부를 확인한다.

## 기대 결과 / 실제 결과

- 기대: 호출은 실패하고 이전 출력 파일도 제거된다.
- 실제: `Prompt file is empty`로 실패하지만 이전 출력 파일이 그대로 남았다.

## 근거

초기 구현은 `runClaude()`에서 프롬프트 읽기·빈 값 검증을 마친 뒤 `rmSync(output)`을 실행했다.
GPT-6 Astra high가 가짜 Claude 실행 파일을 쓰는 자기검사 경로를 독립 검토해 이 순서를 지적했고,
동일 조건을 회귀 검사로 재현했다.

## 처리 기록

- `2026-09-21` — `Codex`: 기존 출력 제거와 진행 로그 초기화를 프롬프트 검증보다 앞으로
  옮겼다. `scripts/check-claude-readonly.mjs`에 stale 출력 + 빈 프롬프트 조합을 추가했다.
  `npm run check:claude-bridge`는 통과했고 `CLAUDE_BRIDGE_RED=1` 오답 주입은 exit 1이었다.
