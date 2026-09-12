# App Check 초기화 실패가 정상 Auth와 라이브러리 초기화도 막음

- ID: `REV-2026-087`
- 날짜: `2026-09-11`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 관련 인계: `HANDOFF-2026-122`

## 재현과 영향

App Check activate만 실패시키고 나머지 Firebase SDK를 정상으로 제공했다. index의 fbReady가 false가 되고 document의 로그인 버튼도 비활성화됐다.

## 처리 기록

Auth와 App Check 초기화를 분리했다. 로그인·계정별 자료는 유지하고, site key가 설정됐으나 초기화 실패 시 AI 토큰 helper가 명시적으로 거부한다. 문서 화면도 redirect 결과 오류를 소비한다.

`node scripts/check-auth-navigation.mjs`: 수정 전 fbReady false 실패, 수정 후 초기화 성공·실패 × 문서/본체 왕복·A/B/A 자료 격리 통과. 원격 SDK 경계는 fixture이다.
