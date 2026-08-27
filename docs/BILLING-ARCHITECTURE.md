# 결제·구독 권한 구조

이 저장소에는 아직 PG 계약·비밀키가 없으므로 결제 버튼이나 임시 결제 API를 만들지 않는다.
클라이언트가 결제 상태를 직접 저장하는 구조는 위조 가능하므로 출시 전 아래 서버 경계를 갖춰야 한다.

```text
결제 화면 → PG 결제창
              ↓ (서명된 webhook, idempotency key)
      Billing backend / entitlement DB
              ├─ 결제 이벤트 원장 (append-only)
              ├─ 구독·환불·유예·해지 상태
              └─ Firebase Admin custom claim: pedagogy_plan
                                      ↓
                 AI Worker가 검증한 Firebase ID token의 claim
                                      ↓
                         PLAN_DAILY_LIMITS_JSON 별 AI 한도
```

## 필수 데이터 모델

| 테이블/원장 | 반드시 포함할 값 |
| --- | --- |
| `payment_events` | PG event ID(unique), 수신 원문 해시, 검증 결과, 수신 시각, 처리 상태 |
| `subscriptions` | Firebase UID, plan, 상태, 시작·갱신·종료 시각, 취소 시각, PG customer/subscription ID |
| `entitlements` | UID, plan, AI·저장량·팀 좌석 한도, 유예 종료, 마지막 변경 event ID |
| `refunds` | 원 결제 ID, 금액, 사유, 처리자, PG 환불 ID, 시각 |
| `audit_log` | 권한 수동 변경자, 이전/이후 값, 근거, 시각 |

## 보안 불변식

1. PG webhook 서명 또는 결제 조회 API 검증이 끝나기 전에는 entitlement를 만들거나 연장하지 않는다.
2. `payment_events.provider_event_id`는 unique로 해 webhook 재전송이 중복 결제를 만들지 않게 한다.
3. custom claim은 Billing backend의 Firebase Admin 자격 증명으로만 갱신한다. 브라우저 Firestore
   쓰기나 URL 파라미터로 plan을 바꾸지 않는다.
4. 결제 취소·환불·차지백은 entitlement를 즉시 또는 정해진 유예 정책에 따라 회수하고 감사 로그에 남긴다.
5. 모든 금액, 주문 ID, 사용자 ID는 서버에서 다시 검증한다. 브라우저가 보낸 가격은 신뢰하지 않는다.
6. PG secret·webhook secret·Firebase Admin key는 전용 secret manager에만 둔다. 이 Git 저장소와
   GitHub Pages에는 절대 넣지 않는다.

## 출시 전 정해야 할 제품 정책

- 무료/개인/학원 플랜의 월·연 가격, VAT 표기, AI 요청·저장량·문제집·좌석 한도
- 무료체험과 결제 실패 재시도, 유예 기간, 읽기 전용 전환, 데이터 export/삭제 기한
- 청약철회·부분 환불·환불 요청 채널·처리 기한
- 학원 계정에서 자료의 소유자, 관리자 퇴사·계정 이전, 학생 데이터 처리 역할

현재 AI Worker는 유효한 `pedagogy_plan` custom claim이 발급되면 `PLAN_DAILY_LIMITS_JSON`에
정의한 한도를 적용할 준비가 되어 있다. Claim을 발급할 Billing backend와 PG 선택·계약은 운영자가
완성해야 하며, 그 전에는 `DAILY_LIMIT` 하나만 사용한다.

## 저장량·문제집 수 한도의 별도 경계

현재 Firestore와 Storage는 브라우저 SDK가 직접 쓰므로, Security Rules만으로는 사용자별 누적
저장량·파일 수·플랜별 문제집 수를 원자적으로 계산해 결제 권한에 맞게 제한할 수 없다. Rules는
소유자, 문서 모양, MIME, 단일 파일 크기만 막는다. 따라서 유료 플랜에 저장량 또는 좌석 한도를
약속하려면 다음 중 하나를 **결제 오픈 전** 구현한다.

1. 로그인·App Check를 검증한 Billing/Upload backend가 entitlement를 확인한 뒤 짧은 수명의
   업로드 권한을 발급하고, 업로드 완료 시 원장에 용량·파일 수를 원자적으로 반영한다.
2. Cloud Functions/Cloud Run에서 Firestore 쓰기와 Storage finalize를 검증해 초과분을 격리·삭제하고,
   고객 화면에는 사용량을 읽기 전용으로 제공한다.

클라이언트가 `pedagogy_plan`을 읽어 버튼을 숨기거나 Firestore 문서에 사용량을 적는 방식은
우회 가능하므로 결제 제한으로 인정하지 않는다. 이 저장소의 현재 구현은 AI 요청 상한만 서버에서
강제하며, 저장량 유료 약속은 위 경계가 만들어질 때까지 가격표에 넣지 않는다.
