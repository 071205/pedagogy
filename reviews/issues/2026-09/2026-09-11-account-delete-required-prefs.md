# 하위 설정·동의 삭제 실패에도 Auth 계정을 삭제함

- ID: `REV-2026-083`
- 날짜: `2026-09-11`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 관련 인계: `HANDOFF-2026-122`

## 재현과 영향

`deleteAccountEverything()`에서 library 또는 consent 문서 delete가 거부되도록 했다. 예외를 경고만 남기고 삼켜 Auth delete까지 실행했다.

## 처리 기록

두 문서 모두 삭제 성공을 계정 삭제의 필수 조건으로 바꿨다. 실패하면 계정을 유지하여 재시도할 수 있다.

`node scripts/check-review-followup.mjs`: 두 거부 시나리오 모두 수정 전 Missing expected rejection, 수정 후 통과.
