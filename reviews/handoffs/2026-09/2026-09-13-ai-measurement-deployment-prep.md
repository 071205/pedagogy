# 변경 인계 — OPS-6 AI 측정 배포 준비

- ID: `HANDOFF-2026-133`
- 날짜: `2026-09-13`
- 작성자: `Codex`
- 상태: `waiting-for-approval`
- 영향 영역: `docs`
- 관련 이슈: `없음` (열린 `REV-2026-074`, `REV-2026-075` 유지)

## 준비 결과

[배포 준비 묶음](../../../docs/AI-MEASUREMENT-DEPLOYMENT-PREP.md)을 만들었다. 로컬 Worker는
`dawn-shape-2664`, `QUOTA` migration v1, 기본 Haiku 4.5, 두 경로 `max_tokens: 4096`, 10% Logs
표본, 50/5000 호출 상한을 선언한다. 공개 `/health`는 `{"ok":true}`를 반환했지만 이는 endpoint 도달만
확인하며 배포 version·binding·secret·측정 동작을 증명하지 않는다.

staging 대상과 Cloudflare/Anthropic 운영 콘솔 증적은 이 저장소에서 확인할 수 없었다. 별도 staging
환경 선언도 없다. 따라서 production이나 공개 Worker에 배포·설정 변경·실제 AI 호출을 하지 않았다.

## 승인 범위 제안

격리 staging에서 개인정보 없는 합성 이미지 1회와 문서 1회, 총 2회만 실행한다. 자동 재시도는 하지
않고, staging 표본률만 100%로 올린 뒤 검증 직후 10%로 복원한다. Haiku 4.5의 현재 출력 가격
$5/MTok과 4096 출력 상한으로 2회 출력 성분은 최대 $0.04096이다. 입력/시각 토큰은 호출 전 확정할 수
없으므로 총액 상한이 아니며, 사용자 금액 한도를 별도로 받아야 한다.

실행 전에는 staging Worker/Firebase/Anthropic key 분리, 실제 binding·변수·observability·version,
직전 rollback version, Anthropic 지출 한도·알림, Cloudflare Logs 보존/접근 경계를 읽기 전용으로 확인한다.
실행 뒤에는 version 기록, 두 task의 안전한 `ai_usage` 필드와 Anthropic 사용량 대조, 표본률 복원,
필요 시 직전 Worker version rollback을 한다.

## 검증

- 공개 `GET /health`를 읽기 전용으로 호출해 `{"ok":true}`를 확인했다. 인증·quota·AI 호출은 하지 않았다.
- 로컬 `worker/wrangler.toml`, Worker 요청 경계, 운영 런북·체크리스트와 기존 124~127 인계를 대조했다.
- `npm run test:review-contracts` 통과했다. 문서·모듈 분리·file 경계의 기존 계약이 유지됨을 확인했다.
- `git diff --check` 통과. 운영 콘솔·배포 version·secret 값·실제 로그는 읽지 못했으므로 미확인으로 남겼다.

## 다음 작업자에게

OPS-7은 사용자가 staging 대상과 예산을 승인한 뒤에만 시작한다. production은 별도 승인 없이는
대상에 포함하지 않는다. 이미지·프롬프트·AI 응답 원문·UID·인증 토큰은 문서·로그 증적에 넣지 않는다.
`transcript.txt`는 사용자 미추적 파일로 유지한다.
