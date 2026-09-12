# 알 수 없는 App Check kid가 요청마다 Google 공개키 조회를 유발함

- ID: `REV-2026-085`
- 날짜: `2026-09-11`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 관련 인계: `HANDOFF-2026-122`

## 재현과 영향

형식상 유효한 claim과 서로 다른 unknown kid를 반복 검증하면 첫 요청에서 2회, 이후 요청마다 강제 JWKS fetch가 발생했다.

## 처리 기록

unknown kid 갱신은 verifier당 60초 간격으로 제한한다. 방금 받은 키는 중복 조회하지 않고, 조회 장애는 5초간 backoff한다. 실제 키 교체는 간격 뒤 갱신하며 만료 캐시·장애는 차단한다. JSON 객체·유한 시각도 검사한다.

`node worker/app-check.test.mjs`: 수정 전 2 != 1 실패, 수정 후 반복 kid·키 교체·장애 재시도·malformed claim 통과.
