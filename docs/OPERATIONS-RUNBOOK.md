# 운영·보안 런북

## 매일 확인

- Cloudflare Worker 4xx/5xx, AI 공급자 오류, Durable Object 오류, AI 요청량
- Firebase Firestore read/write/delete, Storage 용량·전송량, Authentication 신규 가입량
- Anthropic 사용량·한도·결제 상태
- 고객지원 메일과 권리자/개인정보 요청

## AI 비용 급증 또는 악용 의심

1. Cloudflare Worker의 `DAILY_LIMIT` 또는 `PLAN_DAILY_LIMITS_JSON`을 임시로 낮추고 배포한다.
   Worker는 코드상 하루 10,000회를 절대 상한으로 두므로, 그보다 큰 값은 설정 오류로 기본값이
   적용된다. 더 큰 계약 한도가 필요하면 코드·비용 알림·승인을 함께 갱신한다.
2. Firebase App Check enforcement와 Firebase Auth 승인 도메인을 확인한다.
3. 특정 UID/계정의 요청을 차단해야 하면 Billing backend에서 entitlement를 정지한다. Worker에 UID
   블랙리스트를 하드코딩하지 않는다.
4. Anthropic key 노출이 의심되면 즉시 폐기·재발급하고 배포한다.
5. 원인, 시각, 영향 계정, 조치, 재발 방지를 인시던트 기록에 남긴다.

## 개인정보·계정 삭제 요청

1. 서비스의 계정 삭제 기능을 먼저 안내한다. 이 기능은 AI hash 기록을 포함해 현재·직전 이틀
   Worker 상태를 삭제한 뒤 Firebase 계정을 지운다.
2. 실패하면 운영 계정에서 임의로 사용자 문서를 열지 않는다. 별도 테스트 계정으로 재현하고,
   필요한 경우 수탁자 콘솔의 권한 있는 절차를 사용한다.
3. Anthropic API의 기본 30일 보존 및 안전·법적 예외, 백업·법정 보존 예외를 안내한다.
4. 요청·본인 확인·처리 범위·완료 시각을 접근 제한된 티켓에 기록한다.

## 데이터 손실/복구

1. 먼저 사용자의 전체 JSON 내보내기와 브라우저 백업 존재 여부를 확인한다.
2. Firestore 복구는 사전에 정의한 백업/PITR 절차와 승인자 두 명의 검토 후 수행한다.
3. 복구는 원본을 덮어쓰지 말고 격리 프로젝트/경로에서 검증한 뒤 진행한다.
4. 복구 완료 후 사용자의 권한·이미지 참조·문제집 수·인쇄 결과를 확인한다.

## 배포

1. PR CI, `npm run test:worker`, `npm run check:static`, `npm run check:rules`(JDK 21 필요),
   브라우저 회귀 테스트를 통과한다.
2. staging에 먼저 배포하고 로그인·저장·AI·계정 삭제를 테스트 계정으로 확인한다.
3. Worker 배포 후 `/health`가 `{"ok":true}`인지 확인하고 Cloudflare binding·migration을 검토한다.
4. production Firebase Rules 배포 전 Emulator 테스트와 diff 검토를 한다.
5. 배포 커밋, Worker version ID, 규칙 버전, 롤백 방법을 인계 기록에 남긴다.
