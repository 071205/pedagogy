# 모의고사 로컬 저장 실패가 종료 경고·계정별 복구에 반영되지 않음

- ID: `REV-2026-084`
- 날짜: `2026-09-11`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 관련 인계: `HANDOFF-2026-122`

## 재현과 영향

비로그인 모의고사 저장을 용량 오류로 실패시켰다. persistMocks는 false를 반환하지만 hasUnsavedCloudWork는 false였고 계정 전환 시 복구본도 없었다.

## 처리 기록

실패한 원본을 계정별 pendingLocalByOwner에 보존하고 재진입 시 우선 읽는다. 성공 시 제거한다. 종료·계정 전환 전에 iframe 대기 저장을 확정하고, 종료 경고와 숨김 시 클라우드 저장에 모의고사를 포함한다.

`node scripts/check-review-followup.mjs`: 수정 전 false != true 실패, 수정 후 원본 보존·재시도 성공·경고 해제 통과.
