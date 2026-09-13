# 새 채팅 인계 — OPS-6 staging 측정 준비

- ID: `HANDOFF-2026-134`
- 날짜: `2026-09-13`
- 작성자: `Codex`
- 상태: `waiting-for-environment`
- 영향 영역: `docs`
- 관련 이슈: `없음` (열린 `REV-2026-074`, `REV-2026-075` 유지)

## 새 채팅 시작 위치

먼저 `AGENTS.md`, `reviews/README.md`, `reviews/INDEX.md`,
`docs/DEV-TOKEN-ROADMAP.md`, `docs/AI-MEASUREMENT-DEPLOYMENT-PREP.md`와 이 인계를 읽는다.
비용 개선의 유일한 레일은 `DEV-TOKEN-ROADMAP.md`이며 현재 위치는 **OPS-6 대기**다.
DEV-0~5와 Worker 측정 구현·원문 비노출 회귀·AI 이미지 경계 추출/검토는 완료했으므로 반복하지 않는다.

## 이미 받은 사용자 승인

사용자는 다음만 승인했다.

- 격리 **staging** 환경에서만 AI 측정 검증
- 개인정보 없는 합성 이미지 1회, 합성 문서 1회, 합계 최대 2회
- 자동 재시도 금지
- 총 비용 최대 $1
- production 배포·설정 변경·실사용자 데이터 접근은 불허

이 승인은 staging 환경이 production과 분리됐음이 확인된 경우에만 쓴다. production을 대체 대상이라고
추정하거나 그쪽 설정을 읽고 바꾸지 않는다.

## 확인된 사실과 현재 차단 조건

- 공개 Worker `dawn-shape-2664.dbruddl79.workers.dev`의 `GET /health`는 `{"ok":true}`다.
  health는 AI key·quota·측정·App Check를 우회하므로 배포 version이나 AI 준비 완료 증거가 아니다.
- 로컬 `worker/wrangler.toml`에는 staging environment·route·custom domain이 없다. 로컬 기본은
  Haiku 4.5, 두 경로 `max_tokens:4096`, Logs 10% 표본, 일일 50/5000 호출 상한이다.
- 이 작업 환경에는 `wrangler` CLI, `CLOUDFLARE_API_TOKEN`, `ANTHROPIC_API_KEY`가 없고 staging Firebase
  project/App Check 정보도 없다. 값은 요청하거나 출력하지 않는다.
- 따라서 아직 배포·설정 변경·실제 AI 호출은 **0회**다.

## 환경이 준비된 뒤의 정확한 다음 행동

1. staging Worker URL/version, staging Firebase project/App Check app ID, staging Anthropic key가 production과
   분리됐는지 읽기 전용으로 확인한다.
2. 실제 Durable Object binding/migration, `AI_MODEL`, quota, kill switch, Logs 표본률, 직전 rollback version,
   Anthropic 지출 제한·알림과 Logs 보존/접근 경계를 기록한다. secret 값·원문은 기록하지 않는다.
3. 위 사실이 승인 범위와 맞으면 OPS-7/Sol medium으로 이동한다. staging만 100% 표본률로 설정하고
   합성 요청 두 개를 각 1회 실행한다.
4. 안전한 `ai_usage` 필드와 Anthropic 사용량만 대조한 뒤 staging 표본률을 10%로 복원한다. 이상이 있으면
   직전 Worker version으로 rollback한다.

Haiku 4.5의 2회 출력 성분 최대는 $0.04096이며 입력/이미지 토큰은 호출 전 확정할 수 없다. $1 승인은
이를 포함하는 전체 실행 한도다. 자세한 계산·복귀 조건은 `AI-MEASUREMENT-DEPLOYMENT-PREP.md`를 따른다.

## 작업 트리와 최근 커밋

미추적 `transcript.txt`는 사용자 파일이므로 커밋·삭제하지 않는다. 마지막 관련 커밋은
`a3e9f2a docs: prepare AI measurement deployment`이며, 이 인계 기록 커밋 뒤 새 HEAD를 사용한다.
