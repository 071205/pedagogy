# AI 문서 CSP가 Firebase 로그인 보조 스크립트와 iframe을 차단함

- ID: `REV-2026-086`
- 날짜: `2026-09-11`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 관련 인계: `HANDOFF-2026-122`

## 재현과 영향

실제 document-editor.html에서 https://apis.google.com/js/api.js 및 authDomain의 /__/auth/iframe을 로드했다. 외부 응답은 로컬 fixture로 대체했지만 페이지 CSP는 그대로였다. script.onerror가 발생하여 false != true로 실패했다. 본체는 같은 탐침을 통과했다.

## 처리 기록

문서 CSP에 Firebase popup helper와 authDomain 프레임 출처를 본체와 같은 범위로 추가했다.

`npm run test:csp`: 수정 전 문서 화면 실패, 수정 후 통과. REV-2026-075의 본체 복귀 뒤 실계정 신고와 같은 원인이라고 단정하지 않는다.
