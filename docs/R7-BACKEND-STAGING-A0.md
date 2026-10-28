# R7 A0 — 로컬 backend staging 산출물과 검증

2026-10-28 · [준비안](R7-FIREBASE-STAGING-PLAN.md)의 A0 구현이다.
기존 guest/production과 구별되는 **로컬 합성 자료 검증 도구**다. Firebase API 활성화·DB/버킷 생성·
Auth/Rules/IAM·billing·Worker/정적 원격 배포를 하지 않는다. 실제 Google 로그인·App Check 정상
발급/거절·Firestore ACK·R7/R8 운영 전체 완료는 A1 이후의 별도 증거다.

## 고정 대상·출력

- project `pedagogy-ai-staging`, number `450368559700`, web app `1:450368559700:web:5e8f86074f042dd7d12bc1`.
- origin은 **http://localhost:8796**. 127.0.0.1·다른 포트·원격 origin을 대체로 허용하지 않는다.
- 출력은 `dist/backend-staging-a0/public`만 사용한다. manifest/public configuration은 그 상위의
  `staging-manifest.json`에 있고 HTTP에서는 제공하지 않는다. 공개 allowlist와 크기/SHA를 검사한다.
- source PUBLIC_INPUTS, 기존 `dist/public`, `dist/guest-preview`는 변경하지 않는다. 변형은 임시
  입력 사본에서만 하고 검증 뒤 A0 출력만 교체한다. 잘못된 설정/앵커/입력 검증 실패는 이전 A0
  출력을 게시하지 않는다. 호스트는 항상 fresh build 성공 후 시작하며 실패 시 옛 출력으로 기동하지 않는다.
- 배포용 Wrangler config를 만들지 않는다. 호스트는 loopback만 바인드하고 Host·허용 파일·메서드를
  검사한다. 시작 뒤 파일이 바뀌거나 symlink면 정상 자산으로 제공하지 않는다.

## 설정 수집·실행

```sh
npm run read:backend-staging-config
# 출력된 저장소 밖 private 임시 public-config.json 경로만 아래 --config에 사용한다.
npm run build:backend-staging -- --config /absolute/private-temp/public-config.json
node scripts/build-backend-staging.mjs --check --config /absolute/private-temp/public-config.json

# 표준 CI/로컬 회귀: fixture SDK, 실제 제품 코드/DOM/저장/직렬화/네트워크 guard
npm run test:backend-staging

# 실제 고정 SDK 실행/전체 staging 옵션 초기화만 확인. backend 요청은 모두 차단한다.
node scripts/check-backend-staging.mjs --config /absolute/private-temp/public-config.json
```

설정 수집기는 추가 계정 fingerprint `74138acea7c7`만 선택한다. 없거나 refresh token이 없으면
default account로 돌아가지 않는다. 직접 GET으로 project/app identity·billing 미연결·Enterprise
SCORE/localhost 바인딩을 대조한다. 공개 SDK config만 mode0600/부모0700의 새 OS temp 파일로
쓰며 token·계정 객체·원시 응답·SDK key 값을 콘솔/감사 문서에 출력하지 않는다. 새 OAuth 흐름이나
`firebase getProject`의 API-enable 부수효과를 진단에 사용하지 않는다.

`npm run serve:backend-staging -- --config /absolute/private-temp/public-config.json`은 **브라우저를
열지 않는** 수동 로컬 호스트다. 일반 Chrome 프로필로 열지 말고 A1에서 마련할 전용 빈 프로필
절차를 사용한다. A0 검사기는 매번 새 Playwright 컨텍스트를 만들고 종료한다. 고정 포트가 이미
사용 중이면 실패하며 다른 origin을 임의 선택하거나 다른 프로세스를 종료하지 않는다.

## 프로필·앱 부팅 경계

기존 LS 데이터/다른 admission marker·기존 IndexedDB·Service Worker가 있는 미등록 프로필은
거절한다. 비동기 검사 전에 소유 marker를 남기지 않는다. 도중에 닫은 창이 다음 진입에 검사를
우회하지 못하게 한다. 검사 도중 추가된 LS도 다시 확인한다. IDB await 뒤 marker를 재확인해 다른 A0 창의 admission을 반영한다. 데이터는 지우지 않는다.
등록된 A0 프로필의 재로드만 자기 marker와 허용 저장소를 대조해 진행한다. 이 표식은 브라우저
샌드박스/서버 인증을 대체하는 보안 자격 증명이 아니며, 새 빈 프로필 사용 의무를 없애지 않는다.

서비스 설정만 먼저 실행한다. 나머지 public classic scripts는 `application/x-a0-script`로 보류하고
admission 성공 후 원래 순서·src·SRI로 로드한다. eval/inline 주입 없이 전역 스코프를 보존한다.
자체 classic script마다 실행 시점 context gate를 앞에 두어 타임아웃 뒤 늦게 도착한 앱 코드도 차단한다.
외부 CDN 실패는 선택적 fallback을 위해 다음 로드를 진행하며, 해당 CDN의 전역 선언까지 취소한다는 뜻은 아니다.
늦은 document init/mock boot도 별도로 처리한다. 로그인/App Check 초기화는 켜 두고, App Check가
Auth/Firestore 서비스보다 먼저 시작한다. Storage 객체는 만들지 않으며 mock cloud sync는 0이다.

index·document의 Firebase config와 `frame-src`를 같이 staging으로 바꾸고, mock·legal에도 동일
설정/표시를 넣는다. public 전체의 production 식별자/AI origin 잔존과 staging SDK/App identity,
원본 보존·CSP/HTTP headers·inline script 부재·manifest를 함께 검사한다. guest 검사를 재사용해
Auth까지 꺼 버리지 않는다.

## 지원 제외·네트워크 검사의 의미

A0는 텍스트/수식 fixture만 다룬다. 파일 선택·파일 paste/drop, AI와 이미지 업로드/정리·계정 삭제는
안내와 함수 진입 guard로 중단한다. `saveSets`와 `setToDoc`는 이미지/원문 metadata를 거절한다.
실패한 업로드가 base64로 우회해 Firestore에 저장되는 것을 정상 기능으로 취급하지 않는다.
테스트에서 로그인 버튼은 실제 동의 UI 후 **fixture SDK 경계**까지만 호출하며 계정을 만들지 않는다.

런타임 fetch/XHR guard는 고정 origin·프로젝트 path·API key를 대조한다. 공용 Google API host를
허용한다는 사실만으로 production 차단을 주장하지 않는다. 이 guard는 서버 Auth/Rules/App Check나
모든 브라우저 전송 수단을 대체하는 접근 통제가 아니다. Chromium 검사기의 추가 route는 실제
Firebase/Auth/App Check/reCAPTCHA/AI 요청을 모두 거절한다. 실제 SDK 모드도 정적 고정 gstatic
SDK만 받아 실행하며, 성공한 attestation·Google 로그인·서버 데이터 읽기/쓰기를 의미하지 않는다.

Auth iframe 양성 대조는 staging authDomain의 **가짜 응답을 로컬 route로 제공**해 부모 CSP가
허용하는지 보는 것이다. 원격 Firebase OAuth handler/로그인 성공으로 확대하지 않는다.
고정 SDK 모드는 `10.12.0` 실행과 실제 App 옵션 일치를 확인한다. fixture와 실제 SDK 결과는
서로 다른 JSON으로 기록한다.

SDK10.12.0의 App Check 주소는 `content-firebaseappcheck.googleapis.com`의 고정
projectId/appId + `:exchangeRecaptchaEnterpriseToken`이다. runtime은 POST/고정 key까지 제한하고
SDK 화면의 CSP도 같은 host를 허용한다. 원래 native fetch를 별도 보존해 exact SDK endpoint의
로컬 가짜 응답으로 CSP 양성을 확인한다. 이는 실제 App Check 발급 성공이 아니며 실제 SDK
모드에서는 이 fulfillment도 꺼 둔다. 경로 거절·바인딩 제거·CSP host 제거 RED를 분리한다.

## 검증·다음 단계

검사 명령과 실제 결과·독립 검토는 [HANDOFF-204](../reviews/handoffs/2026-10/2026-10-28-security-r7-backend-staging-a0.md)에 남긴다.
브라우저 RED는 SDK 초기화 제거·fetch guard 제거·AI/Storage 진입 방어 제거·cloud 이미지 방어
제거·dirty LS/IDB 방어 제거·CSP auth frame 누락·admission marker 조기 기록·늦은 앱 gate 제거·동시 창 marker 재검사 제거을 각각 실제 목표
단언에서 실패시키고, 종료/서버 정리까지 확인한다. CI verify job은 private config/CLI 계정 없이
fixture 정상/RED를 실행한다. 실제 SDK 모드는 별도 주문형 확인이며 CI에 비밀 설정을 넣지 않는다.

A1은 기존 준비안대로 API 활성화 후 DB 목록/기존 Rules·지역을 먼저 확인한다. Google provider와
실제 App Check·Firestore ACK는 그 단계에서 검증한다. Storage/Blaze·실자료 이관/high·main Sonar
출시 게이트는 이 로컬 구현으로 닫지 않는다.
