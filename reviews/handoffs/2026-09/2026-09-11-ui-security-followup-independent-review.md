# 변경 인계 — 라이브러리 UI와 보안 후속 변경 독립 검토

- ID: `HANDOFF-2026-117`
- 날짜: `2026-09-11`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `library UI | settings | worker | CI | security docs`
- 관련 이슈: `REV-2026-080`

## 독립 확인 결과

`HANDOFF-2026-116`의 큰 문제집/모의고사 선택 메뉴, A형 문제집 아이콘, native 설정
dialog와 테마·언어 필드 분리는 코드와 실제 브라우저 동작이 일치했다. 라이브러리·문제집
편집기·모의고사 편집기에서 설정을 열고 닫아도 출처와 포커스가 복원됐고, Chromium·WebKit·
Firefox의 데스크톱·태블릿·휴대폰 뷰포트에서 가로 넘침이나 스크립트 오류를 재현하지 못했다.

보안 후속 변경의 GitHub Actions SHA 네 개는 각 공식 `actions/*` 저장소의 실제 commit임을
확인했다. CODEOWNERS, Dependabot 설정, proprietary notice도 의도와 맞지만 실제 보호 효과는
병합 뒤 저장소 branch protection·Dependabot 활성화와 운영 설정에 달려 있다.

## 발견·수정

전역 AI 비용 상한 구현에서 `reserve`와 `consume`이 서로 다른 UUID를 사용해 사용량이 전혀
확정되지 않는 `REV-2026-080`을 재현했다. 개인 한도 초과 요청의 전역 선점과 quota 오류
fail-open도 함께 고쳐, 개인 예약 → 전역 예약 → 전역 확정 → 개인 확정 → AI 호출 순서로
정리했다. 전역 단계가 실패하면 남은 예약을 반납하고 429/503으로 종료한다.

## 검증

- `node worker/worker-contract.test.mjs`: 고장 상태에서 빨간불 확인, 수정 후 통과
- `node worker/quota.test.mjs`: 통과
- `npm run test:library-ui`: 17개 통과
- `npm run test:mock-library-ui`: 정상 통과, 9개 고장 주입에서 8개 계약 빨간불 확인
- `npm run test:cross`: Chromium·WebKit·Firefox 통과, 기존 CDN 차단 경고 6건
- `npm run check:fast`: 통과

## 운영 주의

`GLOBAL_DAILY_LIMIT=5000`과 `AI_KILL_SWITCH=0`은 저장소 기본값일 뿐 현재 Cloudflare 배포
상태를 증명하지 않는다. 배포 전 staging에서 전역 429, kill switch 503, 개인 예약 반납을
실제 Durable Object로 확인한다. LICENSE 문구는 기술적 복제를 막지 않으며 정식 출시 전
법률 검토가 필요하다.
