# R7 — 기존 Firebase staging 자원·지역·비용 실행안

작성: 2026-10-28 · 담당: Codex GPT-6 Sol / medium · 독립 검토: Claude 읽기 전용.
이 문서는 통합 레일 R7의 실행안이며 별도 실행 레일이 아니다. 현재는 **준비안**이다.
API 활성화·DB/버킷 생성·Auth 변경·billing 연결·배포는 아직 수행하지 않았다.

## 1. 대상과 실제 상태

[2026-10-28 안전한 GET 증거](../reviews/audits/2026-10-28/staging-readiness.json).
CLI 계정2개·기본 계정 fingerprint `d8bbf1f8ef96` 유지, 추가 staging 계정 `74138acea7c7` 명시 선택.
계정 객체·token·OAuth URL/state·SDK apiKey·OAuth client secret은 출력/커밋하지 않는다.

| 항목 | 고정 대상 / 확인 결과 | 남은 조건 |
| --- | --- | --- |
| Firebase | `pedagogy-ai-staging` / number `450368559700` / project GET200 | production `pedagogy-huryul`과 다르면 진행, 예상 staging identity와 다르면 중단 |
| web app | `1:450368559700:web:5e8f86074f042dd7d12bc1`, SDK config GET200 | config에 bucket 이름이 있다는 사실은 실제 버킷 생성 증거가 아님 |
| Firestore | GET403, ErrorInfo `SERVICE_DISABLED` | **DB 유무·지역은 미확인**. API 활성화 뒤 목록을 읽고 기존 DB가 있으면 먼저 조사 |
| Storage | bucket list200 / 빈 목록 | default 후보 `pedagogy-ai-staging.firebasestorage.app`, 실제 생성 안 됨 |
| Auth | `FIREBASE_AUTH`, domains: localhost와 staging 기본 Firebase 도메인2개 | Google provider GET404. 익명/이메일 enabled 필드는 응답에서 생략되어 null로 기록, 새로 켜지 않음 |
| App Check | Enterprise config 존재, TTL3600s, key SCORE, allowedDomains `[localhost]`, allowAllDomains=false | 정상 발급/거절·서비스별 enforcement 미검증. Auth 서비스 목록은 UNENFORCED |
| billing | `billingEnabled=false` | Cloud Billing 연결·Blaze 전환은 별도 결정. C1 공급자 실호출 승인은 아님 |
| 기존 Hosting | project resources에 `hostingSite=pedagogy-ai-staging` 존재 | 배포 이력/실제 제공 내용 미조사. `.web.app`/`.firebaseapp.com`의 Auth 승인은 reCAPTCHA 승인 증거가 아님 |
| 원격 guest | 기존 workers.dev guest는 로그인/AI/동기화 비활성 | 이번 staging 설정으로 덮어쓰거나 backend를 켜지 않음 |

재진단은 직접 REST GET만 사용했다. Firebase management getProject의 API-enable 부수효과를
단순 상태 조회에 사용하지 않는다. `.firebaserc` 기본 대상은 production이므로, 향후 변경 명령은
**추가 계정 `--account`와 `--project pedagogy-ai-staging`을 모두 명시**하고 기본 계정을 바꾸지 않는다.
실제 이메일은 로컬 계정에서 선택해 메모리에서만 인자로 전달하며 문서/공개 로그에 남기지 않는다.

## 2. 비용·지역 판단과 권장 경로

공식 문서 확인일: 2026-10-28. 무료 한도는 무료 사용 가능 범위이며 전체 서비스의 무제한 무료나
실제 사용요금 0원 보장이 아니다. 무료 호스팅 주소와 DB/Storage 과금은 별개다.

| 경로 | 가능한 범위 | 제한 / 결정 |
| --- | --- | --- |
| **A 권장: 결제 미연결 유지** | Google Auth, Firestore Standard 첫 DB 무료 할당량 내 텍스트·수식 합성 저장/ACK·충돌/Rules, Spark App Check 발급/거절 | Cloud Storage·이미지 정리·제품 계정 삭제 흐름은 보류. 전체 R7/R8 완료로 표시하지 않음 |
| B: Storage 포함 | A + 실제 Storage 업로드/거절·App Check Storage enforce·원격 이미지 출력 | 기존 staging에 Blaze 연결 필요. 결제 계정·비용 허용 범위·지역을 확정한 뒤 실행. 공급자 실호출은 계속 별도 C1 |

Firestore 후보는 **Standard / Native / `(default)` / `asia-northeast3`(서울)**다. 한국 사용자 흐름을
검증할 staging에 서울을 제안한다. DB 생성 후 지역을 변경할 수 없으므로, 생성 전에 실제 기존
DB와 위치 제약을 확인하고 예상과 다르면 멈춘다. 기존 DB를 삭제해 후보 지역으로 맞추지 않는다.
TTL·PITR·백업·복원·clone 같은 billing 필요 기능은 A에 포함하지 않는다. 합성 문서 검증 후
Firestore/계정/Storage를 서비스별로 정리하고 사용량을 확인한다.

Storage B의 기본 제안도 **서울 `asia-northeast3`**다(서비스 간 지역 일관성 목적). 서울 버킷에
미국 일부 지역의 Always Free 조건을 적용하지 않는다. `US-CENTRAL1/US-EAST1/US-WEST1` 후보는
무료 사용 조건이 있지만 한국 접근 지연·지역 간/인터넷 전송을 함께 검토해야 하므로, 비용 0원
보장이나 자동 선택으로 쓰지 않는다. 생성 후 지역 변경을 롤백 수단으로 삼지 않는다.

Blaze 승인 시 예산 알림은 서비스 정지 장치가 아니다. Firestore/Storage 전체를 보호하는 금액
상한으로 표시하지 않는다. 작은 합성 파일·횟수·크기 상한, 테스트 계정/정확 경로, 종료 시 cleanup,
Rules와 실제 사용량 확인을 별도로 둔다. 결제 연결을 되돌려 자원을 무조건 삭제/불능화하는 자동
롤백은 하지 않는다. 기존 Gemini 설정이 같은 프로젝트에 있어도 C1 호출은 0회로 유지한다.

## 3. 준비안 확정 뒤 실행 순서

### A0 — 생성 전 점검·분리 빌드 (로컬, medium 구현 + 독립 검토)

1. 위 identity·선택 계정·billing 상태를 다시 확인한다. 예상 밖 billing 연결/프로젝트/웹 앱이면 중단.
2. 전용 생성 산출물/임시 디렉터리의 staging overlay를 설계한다. 기존 `dist/public`, guest,
   production HTML/`service-config.js`/`.firebaserc`를 staging 설정으로 덮어쓰지 않는다.
3. 공개 엔트리 **index·document·mock·legal.html 및 모든 연관 설정/CSP**를 감사한다. index와 document에는
   production Firebase config·AI Worker URL이 별도로 들어 있다. 일부만 바꾸지 않는다.
   공개 파일 전체에서 production project/number/app/authDomain/bucket/AI origin 잔존을 거절한다.
   `frame-src`의 production authDomain도 **staging authDomain과 동시 교체**하고 해당 iframe의
   정상 로드를 양성 대조한다. mock iframe도 같은 분리 산출물만 연다. 스크립트 변형은
   `scripts/lib/csp-rehash.mjs`의 재해시나 `buildPublic`의 외부화를 사용하되, 재해시 helper가
   개수 불일치 시 원본을 반환하므로 결과를 별도로 검증한다. `scripts/check-source-csp.mjs`의
   실제 script/hash 일치·주입 거절 기준과 SRI/manifest를 staging 산출물에도 적용한다.
4. 기존 guest 산출물은 계속 guest다. 전체 staging은 눈에 띄는 합성 테스트 전용 표시를 가진
   별도 빌드이며, 아직 없는 Storage를 정상 초기화/업로드 완료로 표시하지 않는다.
   **staging 전용 플래그**로 로그인 ON + AI OFF + Storage OFF를 구분한다. `guestPreview:true`는
   initFirebase/Auth/App Check를 끄므로 재사용하지 않는다. staging 전용 `service-config.js`에
   위 앱에 연결된 Enterprise site key를 넣고 키 없음/잘못된 project/app이면 검증 부팅을 거절한다.
   key는 공개값이지만 이번 안전 진단에는 원문을 보존하지 않았으므로 실행 때 identity를 재대조한다.
   기존 guest 빌드의 mkdtemp·원본 불변/manifest 패턴은 재사용하되, Firebase SDK 자체를 거절하는
   `checkGuestPolicy`는 사용하지 않는다. staging 전용 검사는 production 식별자 부재(음성)와
   staging projectId/number/appId/authDomain 및 실제 SDK 초기화(양성)를 함께 요구한다.
   Storage는 업로드뿐 아니라 releaseImage/wipeStorageImages·제품 계정 삭제 UI까지 A 미지원으로
   명시한다. 실패를 삼키거나 업로드 완료/계정 정리 완료로 보이지 않도록 해당 경로를 차단/안내한다.
5. 로컬 origin 후보는 `http://localhost:8796`. Auth·reCAPTCHA가 허용하는 hostname과 맞춘다.
   127.0.0.1은 기존 Auth/reCAPTCHA 허용 목록과 다르므로 자동 치환하지 않는다.
   포트만 다르다고 개인정보 격리가 보장되진 않으므로 **새 빈 브라우저 컨텍스트/전용 프로필**을
   사용한다. 기존 localhost:8787의 프로필·guest 데이터나 운영 로그인 자료를 재사용하지 않는다.
6. AI UI/실호출을 차단하고, 브라우저 network에서 production Firebase/Worker와 staging AI 호출을
   모두 거절한다. CSP connect-src의 Google API 호스트는 프로젝트 공용이므로 CSP만으로
   production을 차단했다고 쓰지 않는다. 검사 network guard는 메모리에서 staging API key와
   프로젝트/앱/버킷 path를 대조하고, OAuth는 확인된 staging callback에 한정한다. 원시 URL/query/
   body/header·token은 로그로 출력하지 않는다. App Check는 첫 보호 서비스 접근 전에 초기화한다.
   App Check 토큰을 URL/지속 저장/로그에 남기지 않는다. debug token은 필요 시
   staging 로컬에만 두며 실제 Enterprise 정상 발급 증거와 구별한다.

A0 완료 기준: 실제 target identity + production 잔존 없음 + 새 프로필 + 예상 밖 네트워크 거절의
정상/실패 주입·기존 필수 회귀·독립 검토. 로컬 overlay 준비는 원격 backend 완료가 아니다.

### A1 — 원격 Auth/Firestore 준비 (확정된 A 실행 범위에서만)

1. Firestore API 활성화는 별도 변경으로 기록하고 operation 완료 뒤 DB 목록을 읽는다.
   기존 DB가 있으면 ID·edition·mode·location과 실제 Rules를 먼저 읽고 계획과 대조한다.
2. DB가 없는 것이 확인된 경우에만 위 서울 후보 `(default)`를 만든다. 생성과 Rules 적용 사이
   클라이언트 접속을 열지 않는다. test mode의 공개 read/write Rules로 시작하지 않는다.
3. 저장소 `firestore.rules`와 필요한 인덱스를 검토하고 staging에만 배포한다. 현재 library/
   mock/revision/setSchemaVersion 플래그와 Rules 호환을 검증한 뒤 해당 클라이언트를 연결한다.
4. staging Google provider를 활성화할 OAuth 설정·지원 연락처를 확인한다. client secret을
   공개 config에 넣지 않는다. 임시 이메일/익명 인증으로 Google 정상 로그인 검증을 대체하지 않는다.
   localhost는 기존 authorizedDomains에 있으므로 무조건 목록을 덮어쓰지 않는다.
5. 전용 검증 계정은 최대2개, 합성 문제집은 최대2권·권당3문항의 **텍스트/수식만** 사용한다.
   image 블록·answerImg·선지/표 이미지·PDF/원문·파일/붙여넣기/AI 이미지 입력은 A에서 제외한다.
   base64 fallback이 Firestore로 들어가 크기 한도를 건드리는 것을 테스트 준비 때 거절한다.
   각 검증 조작은 1회, 실패의 자동 재시도는 하지 않으며 예상 밖 트래픽이면 탭/리스너를 닫고 중단한다.
   이 작업 상한은 서버의 전역 과금 차단 장치가 아니다.
   자기 경로 성공·타인 UID/잘못된 모양 거절·실제 서버 ACK·재진입을
   확인한다. 운영 UID/문제집·원문을 복사하지 않는다. ID token은 메모리에서만 사용한다.
6. App Check는 기존 localhost Enterprise 키를 identity/domain 대조 뒤 사용한다. staging Firestore
   monitor 정상/실패 관찰 뒤 Firestore만 enforce하고 자기 UID+누락 토큰 거절을 확인한다.
   **A의 실제 App Check 양성/음성 증거원은 Firestore enforcement**다. origin에서 먼저
   거절되는 기존 Worker 응답을 App Check 거절로 세지 않는다. Storage/Auth enforcement·
   Identity Platform 업그레이드는 이 결과에서 추정하지 않는다.

A1 완료 기준: 원격 자원/Rules identity와 hash·Google 로그인·서버 ACK·계정 격리·App Check 양성/
음성/rollback 기록. Storage 원격·이미지 정리·제품의 계정 삭제 여정·시스템 인쇄·Safari/iPad·
인간 관찰은 미검증이다. 테스트 문서/사용자는 별도의 정확한 fixture ID/UID 목록으로만 정리하고
그 행정 정리를 제품 계정 삭제의 성공 증거로 쓰지 않는다. Auth 계정 삭제는 Google 계정 삭제와
구별하며, 기록되지 않은 기존 테스트 사용자/DB를 일괄 삭제하지 않는다.

### B — 결제 결정 후 Storage 확장

1. billing 연결 **전에** 실제 staging AI Worker 설정을 읽고 공급자 요청이 불가능한 차단을
   별도 변경/독립 검토로 입증한다(예: staging만 kill switch=1). 현재 저장소 설정은 kill switch=0, `APP_CHECK_MODE="monitor"`(검증 실패를 거절하지 않음)이다.
   브라우저의 다른 origin만 믿지 않고 기존 :8787 경로/검증 계정에서도 공급자에 닿지 않게 한다.
   그 후 승인된 Cloud Billing 연결/Blaze와 대상·지역·사용량 관측을 확인한다. 기존 staging의
   결제 연결이 AI 실호출/Identity Platform 업그레이드 승인으로 확장되지 않도록 범위를 기록한다.
2. 이름/지역/Firestore와의 연결을 대조하고 default bucket을 생성한다. 같은 이름이 이미 있으면
   무조건 재사용/삭제하지 않고 owner·Firebase 연결·위치·공개 ACL/IAM을 확인한다.
3. staging `storage.rules`를 공개 접근 없이 적용하고 정확한 localhost origin의 CORS만 필요한
   범위로 설정한다. Firebase download token URL·로그/referrer 노출과 폐기 절차를 확인한다.
4. 합성 이미지에 한해 업로드/읽기/삭제·타인 UID/크기/타입 거절·Storage App Check 정상/누락
   거절·전환 전후 rollback·이미지 포함 출력 경로를 검증한다. 운영 이미지로 대체하지 않는다.
5. 검증 파일/테스트 계정과 사용량을 점검한다. bucket/DB를 삭제하거나 지역을 바꾸는 것을
   기본 rollback으로 삼지 않는다. enforcement/Rules/client release를 검증된 이전 값으로 복원한다.

## 4. Worker·원격 origin·운영 이전 경계

기존 AI staging Worker `pedagogy-ai-staging`의 origin은 localhost/127.0.0.1:8787뿐이다.
새 localhost:8796에서 그 Worker가 동작한다고 주장하지 않는다. A0/A1은 그 Worker를 호출하지
않고 진행한다. Worker App Check의 실제 양성/음성 검사는 **공급자에 절대 닿지 않는 stub 또는
별도 차단 경로**를 먼저 독립 검토한 뒤 실행한다. kill switch가 인증 전에 끊으면 App Check
검증 증거가 되지 않는다. origin 선차단도 같은 한계가 있다. 기존 공급자·quota 승인을 끌어와 실제 AI를 호출하지 않는다.

기존 Firebase Hosting 사이트도 후보이지만 배포 이력·실제 제공 내용을 읽기 전용으로 확인하기
전에는 초기화/덮어쓰기하지 않는다. 현재 `.web.app`/`.firebaseapp.com`이 Auth에 승인되어도
Enterprise 키는 localhost만 허용하므로 그 호스트에서 정상 attestation된다고 추정하지 않는다.
원격 전체 staging 호스트를 만들 때는 별도 무료 기본 주소를 정하고 Auth authorizedDomains·
OAuth redirect·CSP frame/connect·reCAPTCHA allowedDomains·Worker ALLOWED_ORIGINS·필요 CORS를
함께 대조한다. 현재 키의 localhost 허용만으로 workers.dev를 정상이라고 표시하지 않는다.
기존 guest 호스트의 backend를 활성화하거나 production 도메인을 staging에 재사용하지 않는다.

Pages/private 전환·실자료 export/import/Blob 이관은 이 준비안 밖이며 기존 high 설계/구현·
독립 검토를 유지한다. main Sonar 보안 실패도 별도 출시 게이트로 남는다.

## 5. 실행 전 결정과 검증 기록

권장 결정: **A 먼저, 결제 연결 없이 합성 Auth/Firestore 검증; 서울 DB는 생성 전 확인**.
B는 결제·지역·비용 관측을 함께 결정한 뒤 후속 실행한다. 이 문서 작성이나 A 선택만으로
결제 연결·Storage 원격·C1 유료 호출·R7/R8 운영 전체 완료가 승인/달성됐다고 쓰지 않는다.

현재 실제 실행: 읽기 전용 GET과 공식 문서 확인뿐. 신규 코드/기능 검사는 아직 없고, 기존 통과
회귀175/정상12/RED6은 변경 없이 재실행하지 않는다. 다음 A0 구현에서 관련 회귀/실패 주입과
serve.py의 regression-test.html을 확인하고, 원격 변경별 증거·실패·복원 범위를 같은 인계에 남긴다.

## 근거 — 공식 문서 (2026-10-28 확인)

- [Firebase 가격](https://firebase.google.com/pricing): Spark/Blaze·제품별 무료 할당량.
- [Firestore 비용](https://firebase.google.com/docs/firestore/pricing): 첫 DB 무료 할당량·billing 필요 기능.
- [Firestore 지역](https://firebase.google.com/docs/firestore/locations): 서울 지원·생성 후 지역 변경 불가·위치 의존성.
- [Storage 요건](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024): Blaze 필요·새 bucket 이름/지역별 무료 조건.
- [Google 인증](https://firebase.google.com/docs/auth/web/google-signin): provider 활성화·브라우저 로그인.
- [App Check Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider): Spark 지원 범위·초기화·단계적 enforce.
- [예산과 비용](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills): alerts-only와 지원 서비스 한정 spend cap 구별.
