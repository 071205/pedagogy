# 전역 AI quota 예약이 확정되지 않는다

- ID: `REV-2026-080`
- 날짜: `2026-09-11`
- 심각도: `P1`
- 상태: `resolved`
- 영역: `worker | security | billing`
- 관련 인계: `HANDOFF-2026-117`

## 재현

전역 quota용 가짜 Durable Object로 정상 요청의 `reserve`와 `consume` 본문을 기록했다.
수정 전 두 요청의 `reservationId`가 달라 `consume`이 `reservation expired`를 반환했고,
전역 사용량은 0에 머물렀다. 또한 개인 quota가 이미 찬 요청도 전역 예약을 먼저 만들었다.

## 원인

전역 예약 ID를 변수에 보관하지 않고 `reserve`와 `consume`에서 각각 새 UUID를 만들었다.
반환값도 확인하지 않았으며 전역 quota 오류를 fail-open으로 처리했다.

## 해결·검증

- 개인 quota 통과 뒤에만 전역 quota를 예약한다.
- 두 quota가 같은 예약 ID를 쓰고, 외부 AI 호출 전에 전역→개인 순서로 확정한다.
- 전역 상한/저장소 오류 때 개인 예약을 반납하고 AI 호출을 막는다.
- 잘못된 전역 상한 값은 5,000으로 되돌리고, 명시적 `0`만 비활성화로 인정한다.
- `worker/worker-contract.test.mjs`에서 수정 전 실패와 수정 후 통과를 확인했다.
- `worker/quota.test.mjs`에서 설정 오타가 차단기를 끄지 않는 계약을 확인했다.
