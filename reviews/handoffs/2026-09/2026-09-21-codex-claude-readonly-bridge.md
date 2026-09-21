# 변경 인계 — Codex→Claude 읽기 전용 호출 경로 추가

- ID: `HANDOFF-2026-157`
- 날짜: `2026-09-21`
- 작성자: `Codex`
- 상태: `reviewed`
- 영향 영역: `tests`, `docs`
- 관련 이슈: `REV-2026-100`(해결)

## 변경 내용

Codex가 Claude에게 독립 의견을 받을 수 있는 설치형 플러그인을 로컬·권장 플러그인 목록에서
찾았지만 해당 기능은 없었다. 사용자 승인 아래 공식 Claude Code CLI의 비대화식 `-p` 경로를
선택하고 `scripts/ask-claude-readonly.mjs`로 고정했다.

래퍼는 stdin을 닫아 프롬프트를 전달하고 `restricted`·`plan`·permission prompt 없음·세션 비저장,
읽기 도구 `Read,Grep,Glob`만 허용한다. 기본 모델은 Opus/high이며 결과 JSON의 최종 답만 별도 파일에
원자적으로 쓰고 진행 로그는 분리한다. 15분 제한을 넘기거나 인증·JSON·Claude 오류가 나면 실패로
종료하고 낡은 최종 결과를 남기지 않는다. 직접 `claude -p` 조합과 background 호출은 `AGENTS.md`에서
금지했고, 질문 1~2개·동일 주제 최대 3회·답의 독립 검증을 요구했다.

## 검증

- `node --check scripts/ask-claude-readonly.mjs`
- `node --check scripts/check-claude-readonly.mjs`
- `npm run check:claude-bridge` — 정상, 잘못된 JSON, 인증 실패, 빈 프롬프트 + stale 결과,
  timeout과 안전 플래그를 가짜 실행 파일로 검증
- `CLAUDE_BRIDGE_RED=1 npm run check:claude-bridge` — 의도적 오답에서 exit 1
- `npm run check:hooks`에 `check-claude-readonly.mjs` 연결

실제 OAuth 로그인과 Claude 프로세스 기동을 확인했다. 첫 호출은 Claude 구독 세션 한도 메시지로
종료됐지만, 한도 회복 뒤 동일 래퍼로 AGENTS와 래퍼 자체만 읽는 1회 종단 검사를 실행해 exit 0과
정확한 `CLAUDE_BRIDGE_E2E_OK` 최종 답을 받았다. 최종 답은 21바이트 별도 파일, 진행 로그는 별도
0바이트 파일이었고 저장소 수정은 없었다. 이는 **통신 경로 종단 검증**이며 제품 변경에 대한
Claude의 실질 검토로 세지는 않는다.

## 위험과 다음 검토

앞으로도 작은 읽기 전용 질문만 foreground로 보내고, 답변은 곧바로 코드나 계약의 근거로 채택하지
않고 기존 리뷰 규약대로 독립 검증한다. background 호출은 검증하지 않았고 계속 금지한다.

## 검토 기록

- `2026-09-21` · `Codex / GPT-6 Astra high` · stale 출력 + 빈 프롬프트 자기검사와 실제 정리
  순서를 표적 재검토했다. 기능상 남은 재현 결함은 없다.
- `2026-09-21` · `Claude / Opus high` · AGENTS와 래퍼를 읽는 1회 foreground 종단 검사에서
  `CLAUDE_BRIDGE_E2E_OK`, exit 0을 반환했다. 파일 수정은 없었다.
