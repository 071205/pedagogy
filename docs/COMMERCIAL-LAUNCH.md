# PEDAGOGY 상용 출시 게이트

이 문서는 마케팅 체크리스트가 아니라 **결제를 열기 전 반드시 통과해야 하는 운영 게이트**다.
`npm run check:launch`는 저장소에서 확인할 수 있는 미완성 항목을 실패로 표시한다. 콘솔·계약
항목은 사람이 증빙을 연결해 확인한다.

## 코드에서 이미 강제하는 항목

- 문제집은 사용자별 Firestore 경로로 격리하고, 구형 전체 배열 문서의 신규 쓰기를 막는다.
- Firestore 문제 수·제목·헤더·순서와 Storage MIME·파일 크기를 Rules에서 제한한다.
- AI quota는 UID 원문이 아닌 SHA-256 식별자에 저장하며, 호출 전에 원자적으로 사용량을 확정한다.
- AI quota는 Durable Object alarm으로 최대 48시간 후 파기하며 계정 삭제에도 현재·직전 이틀
  기록을 삭제한다.
- Worker 오류는 사용자 콘텐츠·공급자 원문 대신 일반 오류만 반환한다.
- CI는 Worker 상태 머신, 상용 보안 정적 검사, Python 문법을 매 push/PR마다 검사한다.
- CI는 Java 21 Firebase Emulator로 Firestore·Storage Rules도 실제로 파싱한다.

## 사람이 완료해야 하는 출시 차단 항목

1. **사업·결제**: 사업자 등록, 통신판매 관련 의무 적용 여부 확인, PG 계약, 세금·영수증·환불
   절차와 고객지원 SLA를 확정한다.
2. **법무**: `legal.html`의 운영자명, 주소, 사업자 정보, 개인정보보호책임자, 문의 이메일,
   수탁자 연락처·국가·이전 방법·보유 기간을 실제 계약과 콘솔 기준으로 채운 뒤 전문 검토를 받는다.
3. **App Check**: `service-config.js`에 reCAPTCHA Enterprise site key를 넣고 Firebase Console에서
   Firestore·Storage·Authentication의 검증 비율을 관찰한 뒤 enforcement를 켠다. 개발용 debug
   token은 배포물과 저장소에 절대 넣지 않는다.
4. **분리**: production과 staging의 Firebase 프로젝트, Cloudflare Worker, Anthropic key, 결제 키를
   분리한다. production Worker에서는 localhost origin을 제거한다.
5. **비용**: Google Cloud/Firebase, Cloudflare, Anthropic 각각에 예산·이상 사용량·오류율 알림을
   설정한다. 예산 알림은 상한이 아니므로 자동 차단 절차도 문서화한다.
6. **저장량 과금**: 저장량·파일 수·문제집 수를 유료 혜택으로 내세우려면
   [결제 권한 구조](BILLING-ARCHITECTURE.md#저장량문제집-수-한도의-별도-경계)의 서버측 집계를
   구현한다. 현재 Firebase 직접 쓰기만으로는 이런 총량을 강제할 수 없다.
7. **복구**: Firestore 백업/PITR 또는 export 정책, 복구 책임자, RPO/RTO, 분기별 복구 리허설을
   기록한다.
8. **검증**: 별도 테스트 계정에서 가입, 저장, 이미지 업로드, AI 성공/실패/한도 초과, 전체 삭제,
   계정 삭제, 결제 성공/실패/환불/해지를 끝까지 확인한다.

## 금지

- 브라우저 코드나 `service-config.js`에 PG secret, Anthropic key, Firebase service-account key를 넣지 않는다.
- 결제 성공 redirect만 보고 권한을 주지 않는다. 반드시 서버가 서명 검증한 webhook으로 권한을 바꾼다.
- Firebase custom claim을 클라이언트에서 신뢰하거나 직접 쓰게 하지 않는다.
- 운영 사용자 데이터로 삭제·복구·결제 webhook 테스트를 하지 않는다.
