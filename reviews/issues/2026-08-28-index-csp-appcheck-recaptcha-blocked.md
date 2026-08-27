# CSP가 App Check(reCAPTCHA Enterprise) 스크립트를 차단한다

- ID: `REV-2026-005`
- 날짜: `2026-08-28`
- 보고자: `Claude`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-003`

## 요약과 영향

`HANDOFF-2026-003`에서 추가한 Firebase App Check(`ReCaptchaEnterpriseProvider`)가
`index.html`의 CSP `script-src`에 막혀 절대 활성화되지 못한다. 지금은
`service-config.js`의 `appCheckSiteKey`가 빈 값이라 겉으로 드러나지 않지만,
인계 문서의 다음 단계(콘솔에서 site key 발급 → `service-config.js`에 채움 →
Firestore/Storage/Auth에 enforcement 활성화)를 그대로 따라가면, App Check가 유효한
토큰을 절대 발급받지 못한 채로 enforcement만 켜지는 상태가 된다. enforcement가 켜진
뒤에는 App Check 토큰이 없는 모든 Firestore/Storage/Auth 요청이 거부되므로 — 로그인,
문제집 저장, 이미지 업로드를 포함해 **로그인 사용자 전체의 클라우드 기능이 막힌다.**

## 재현 절차

1. `python3 serve.py --port 8799`로 로컬 서버를 띄우고 `http://127.0.0.1:8799/index.html`을 연다.
2. 브라우저 콘솔에서 Firebase App Check(`ReCaptchaEnterpriseProvider`)가 실제로 주입하는
   스크립트와 같은 호스트로 스크립트 태그를 넣어본다:
   ```js
   const s = document.createElement('script');
   s.src = 'https://www.google.com/recaptcha/enterprise.js?render=test';
   document.head.appendChild(s);
   ```
3. 콘솔에 CSP 위반 오류가 즉시 뜬다.

## 기대 결과 / 실제 결과

- 기대: `appCheckSiteKey`를 채우고 `firebase.appCheck().activate(...)`를 호출하면
  reCAPTCHA Enterprise 스크립트가 로드되고 정상적으로 App Check 토큰이 발급된다.
- 실제:
  ```
  Loading the script 'https://www.google.com/recaptcha/enterprise.js?render=test'
  violates the following Content Security Policy directive: "script-src 'self'
  'unsafe-inline' https://cdn.jsdelivr.net https://www.gstatic.com https://apis.google.com".
  ... The action has been blocked.
  ```
  `index.html`의 `script-src`에 `https://www.google.com`이 없어 차단된다.
  (`frame-src`에도 reCAPTCHA 챌린지 iframe이 쓰는 `https://www.google.com`이
  없어, 스크립트가 통과하더라도 챌린지 자체가 다시 막힐 가능성이 있다 — 실제
  site key로 재검증 필요.)

## 근거

- `index.html`의 CSP `<meta>` (라인 26~37): `script-src`에
  `'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.gstatic.com https://apis.google.com`만
  있고 `https://www.google.com`이 없다.
- `index.html` 라인 1507~1511: `appCheckSiteKey`가 있을 때만
  `new firebase.appCheck.ReCaptchaEnterpriseProvider(appCheckSiteKey)` 로
  `firebase.appCheck().activate(provider, true)`를 부른다 — 이 호출이 내부적으로
  reCAPTCHA Enterprise 스크립트를 동적으로 주입한다.
- 위 스크립트 태그 주입 재현으로 실제 CSP 위반을 확인함(콘솔 로그, `read_console_messages`).
- `initFirebase()`의 App Check 활성화 코드는 동기적으로 예외를 던지지 않으므로
  `appCheckReady=true`가 그대로 찍힌다 — 즉 코드는 "성공"으로 보이지만 실제
  토큰 발급은 조용히 실패한다(가설: 실제 site key로 재현해 최종 확인 필요, 단
  `script-src` 위반 자체는 site key와 무관하게 이미 확정적으로 재현됨).

## 제안 (선택)

`script-src`와 `frame-src`에 reCAPTCHA Enterprise가 쓰는 호스트를 추가한다
(`https://www.google.com`, 필요시 `https://www.gstatic.com/recaptcha/`는 이미 gstatic
전체가 허용돼 있어 별도 불필요). App Check enforcement를 켜기 전에 실제 site key로
로그인 → 저장 → 이미지 업로드까지 다시 확인한다.

## 처리 기록

- `2026-08-28` — `Claude`: 등록.
- `2026-08-28` — `Claude`: 수정. `index.html`의 CSP `script-src`·`frame-src`에
  `https://www.google.com`을 추가했다(reCAPTCHA Enterprise가 스크립트와 챌린지
  iframe에 쓰는 호스트). 원인은 App Check `ReCaptchaEnterpriseProvider` 도입 시
  이 호스트를 CSP 허용 목록에 넣지 않은 누락.
  검증: (1) `python3 serve.py --port 8799`로 띄운 뒤 브라우저에서
  `document.createElement('script'); s.src='https://www.google.com/recaptcha/enterprise.js?render=test'`를
  주입 — 수정 전엔 CSP 위반으로 즉시 차단됨을 확인, 수정 후 같은 시도에서 위반 로그가
  더 이상 뜨지 않음을 새 탭에서 재확인. (2) `regression-test.html` 재실행 —
  `83 / 83 통과`, 회귀 없음.
  남은 위험: 실제 `service-config.js`의 `appCheckSiteKey`를 채우고 콘솔에서
  enforcement를 켤 때, reCAPTCHA 챌린지 iframe/네트워크 흐름까지 실제 site key로
  한 번 더 실사용 검증할 것(이번 수정은 CSP 차단이라는 확정된 결함만 없앤 것이고,
  App Check 토큰 발급의 나머지 흐름은 실제 site key 없이는 끝까지 재현하지 못했다).
