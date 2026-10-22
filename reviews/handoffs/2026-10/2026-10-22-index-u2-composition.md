# 변경 인계 — U2 구성 초안 저장 엔진과 화면 진행 상태

- ID: `HANDOFF-2026-197`
- 날짜: `2026-10-22`
- 작성자: `Codex`
- 상태: `needs-follow-up`
- 영향 영역: `index`, `tests`, `docs`
- 관련 이슈: 없음(기존 REV-137/138/139 운영 확인은 HANDOFF-196)

## 변경 내용

사용자 승인으로 U2도 Codex가 구현한다. 먼저 B6 저장소 안에 기존 권 스냅샷·버전 검사·실제 Undo·묶음 유지·기존 원문 grant만 계승하는 구성 API를 추가했고 독립 Codex 검토를 마쳤다. 세부 계약은 [U2-COMPOSITION](../../../docs/U2-COMPOSITION.md). UI는 아직 구현 전이다. 유료 AI 운영 활성화와 Rules 변경은 없다.

## 위험과 검토 요청

부분 채택 후 고정 매핑/다음 provider 시작 차단/이미 시작한 응답 보존/미채택 묶음 fork, owner 전환·실패 재진입을 확인했다. 화면의 명시 적용·오래된 제안·권수 차이 확인과 모바일은 다음 구현/검토 범위다.

## 검증

- `node scripts/check-composition.mjs`: 정상 19/19(`/private/tmp/u2-composition-normal-19.log`).
- `COMPOSITION_RED=stale|groups|frozen|undo|paid|views|fork node scripts/check-composition.mjs`: 각 표적 방어 제거 검출. 앞 네 가지는 이전 14건 이하에서, paid/views/fork는 최종 19건에서 확인했다. 최종 19건 전체 RED 재실행과 변이 생략 제어는 다음 검사다.
- `npm run test:intake`: 이전 엔진에서 통과(`/private/tmp/u2-b6-regression.log`). 마지막 provider/fork 보완 후 재실행 필요.
- 독립 재현: `/private/tmp/u2-independent-review/{final-probes,concurrent-after,inflight}.log`. 임시 로그 소실 시 위 코드 검사로 재현한다.

## 다음 검토자에게

실제 worktree `/Users/huryul/개발/pedagogy-작업사본/pedagogy-u15b`, 브랜치 `codex/u2-composition`. PR #24 head `cb1d26a` CI 모두 통과, CodeRabbit 자동 리뷰는 skipped(승인 아님). main 병합 시도는 자동 승인 심사가 기존 사용자 승인에 main/Pages가 명확하지 않다는 이유로 차단했다. 사용자에게 PR #24 main/Pages 승인을 요청했고 답변 전 재시도하지 않는다. 미병합/미배포 상태다. transcript.txt는 접근 금지.

다음은 저장 정상/RED/생략 제어·B6 회귀 → U2 화면 구현/독립 검토 → U2 PR이다. PR #24 운영 승인 시 HANDOFF-196의 테스트 권·보류 3권·모든 사본/백업 보존 조건으로 운영 확인한다. PR24 배포 파일 해시는 현재 U2 작업 파일이 아닌 `git show cb1d26a:index.html`과 비교한다.

## 검토 기록

- 2026-10-22 · 구현하지 않은 독립 Codex(`/root/independent_review`) · 새 draft ID의 groupOf·source grant·고정 결과 매핑·부분 채택 뒤 provider 직전 차단·진행 중 응답 보존·미채택 원자 묶음 fork를 실제 브라우저에서 재현. 보완 후 추가 결함 없음. UI/모바일/운영 AI 제외. 검토 SHA-256: composition `c271da74e538854feb9463b172f612a8878d33719745ee79200aee83b9c4d6dd`, intake `c5fbdba855556eb5e441592b593e0b2ec6ae537cc5907f6c1a0f9fdea6fd2c81`.
