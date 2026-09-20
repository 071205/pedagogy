# 변경 인계 — Claude→Codex 읽기 전용 호출 고정

- ID: `HANDOFF-2026-155`
- 날짜: `2026-09-21`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `tests`, `docs`
- 관련 이슈: `없음`

## 변경 내용

설치 상태를 다시 확인해 실제 플러그인이 Tandem이 아니라 공식 `codex@openai-codex` 1.0.6이고,
자체 작업·상태·결과·취소 경로를 제공함을 확인했다. 상태 확인 결과는 `direct startup`, review
gate 비활성, 당시 기록된 작업 없음이었다.
따라서 이전의 직접 CLI 호출은 플러그인에 추적되지 않았던 호출이다.

사용자 정의 프롬프트 파일 때문에 플러그인을 우회해야 할 때 `codex exec "$(cat ...)"`와
stdout/stderr 합치기를 다시 사용하지 않도록 `scripts/ask-codex-readonly.mjs`도 추가했다.
프롬프트는 stdin으로 보낸 뒤 즉시 닫고, `read-only`·`--ephemeral`을 강제하며 최종 답변과
진행 로그를 분리한다. 기본 15분 제한을 넘기면 프로세스 그룹을 종료하고 로그 끝만 보고한다.

`CLAUDE.md`와 `AGENTS.md`에 이 래퍼를 유일한 사용자 정의 검토 경로로 기록했고,
`scripts/check-codex-readonly.mjs`를 `check:hooks`에 연결했다. 검사는 가짜 Codex 실행 파일만
사용하므로 모델 호출이나 구독 사용량이 발생하지 않는다.

후속 실측에서 기존 Claude 세션이 다시 raw `codex exec`를 사용해 4분 동안 282KB 혼합 로그를
만든 것이 확인됐다. 지침만으로는 부족하므로 `.claude/hooks/codex-call-guard.mjs`를 추가해
raw 호출을 PreToolUse에서 차단했다. 공식 `codex-companion`과 저장소 fallback 래퍼는 허용된다.
보통 설계 왕복은 foreground로 보내며 매 왕복에는 새 미결 사항만 전달하도록 `CLAUDE.md`에
비용·속도 계약도 고정했다.

실제 첫 background 검토는 Codex 턴이 `interrupted`된 뒤 Claude의 서브에이전트와 Bash 대기만
5분 넘게 남아 완료로 오인됐다. 잔여 작업 둘을 중지했고, 원인 해결 전에는 background를 쓰지
않고 질문 1~2개씩 foreground로 순차 전달하도록 계약을 정정했다.

그 뒤 실제 foreground 왕복을 두 경로로 확인했다. 공식 `codex:codex-rescue`는 Codex 턴 자체는
약 2.9초에 `BRIDGE_OK`로 완료되고 전체 왕복도 10.5초였지만, 한 단어 요청에 Claude 서브에이전트
문맥이 약 74,145토큰까지 커졌다. 같은 조건의 저장소 래퍼는 7초에 `LEAN_BRIDGE_OK`로 완료됐고
Claude가 회수한 데이터는 최종 답변 14B와 진행 로그 458B로 분리됐다(Codex 표시 사용량 7,497
토큰). 따라서 일반 설계·진단은 래퍼, 관리형 상태 추적이 필요한 고위험 최종 검토만 공식
서브에이전트 foreground를 쓰도록 기본 경로를 바꿨다.

## 위험과 검토 요청

프로세스 그룹 종료와 PATH의 가짜 실행 파일을 사용하는 검사가 macOS/Linux에서 의도대로
동작하는지 확인해 달라. Windows에서는 래퍼가 자식 프로세스만 종료하며 이 저장소의 현재
개발 환경은 macOS다. 실제 모델 호출은 아래 두 최소 연동 검사만 실행했으며 반복하지 않았다.

## 검증

- 실행한 명령 또는 수동 절차:
  - `node --check scripts/ask-codex-readonly.mjs`
  - `node --check scripts/check-codex-readonly.mjs`
  - `npm run check:codex-bridge`
  - `CODEX_BRIDGE_RED=1 node scripts/check-codex-readonly.mjs`
  - `npm run check:hooks`
  - `codex --version`; `codex exec --help`
  - `node /Users/huryul/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs status`
- 결과: 정상 검사는 통과. 의도적 오답 주입은 기대대로 exit 1. 설치된 `codex-cli 0.155.1`이
  `-`, `--sandbox read-only`, `--ephemeral`, `--color`, `--output-last-message`를 지원함을 확인.
  공식 플러그인 상태 명령도 정상 실행됐고 아직 추적 작업은 없음.
  Codex 호출 가드 자기검사 11건(직접 호출·heredoc·허용 경로·혼합 우회) 통과.
- 실제 모델 검증: 공식 foreground `BRIDGE_OK`, 저장소 래퍼 foreground `LEAN_BRIDGE_OK` 모두
  재시도 없이 정상 종료. background 경로는 위 중단 사례 때문에 비활성 유지.

## 다음 검토자에게

`scripts/ask-codex-readonly.mjs`, `scripts/check-codex-readonly.mjs`, `CLAUDE.md`의 호출 예시를
검토한다. 제품 런타임은 건드리지 않았으므로 브라우저 회귀 검사는 대상이 아니다.

## 검토 기록
