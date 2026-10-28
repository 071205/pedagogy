읽기 전용 검토 완료 (5개 파일/범위 + 대조용으로 `scripts/build-guest-preview.mjs`, `worker/index.js`의 해당 함수만 확인). 플랜 파일 쓰기 도구가 비활성이라 결과를 그대로 적습니다.

## 합의

1. **A/B 분리가 증거와 맞다.** `billingEnabled=false`(staging-readiness.json:52-55) + `storage.buckets=[]`(32-35) + Storage의 Blaze 요건 ⇒ A에 원격 Storage를 넣을 수 없다. Firestore는 `403/SERVICE_DISABLED`(22-31)뿐이므로 "DB 유무·지역 미확인, 기존 DB 발견 시 중단"(계획 §1, A1.1~A1.2)은 현재 상태 그대로다.
2. **비가역 변경 통제.** 생성 후 지역 불변을 근거로 "삭제해 지역 맞추기·지역 변경을 롤백 수단으로 쓰지 않기"(§2, B.5)를 명시했고, alerts-only 예산을 하드 차단으로 표시하지 않았다. 비용 0 주장도 없다(§2 서두).
3. **Worker 비호출 경계가 코드로 성립한다.** `wrangler.staging.toml:17`의 허용 origin은 8787뿐이고, `worker/index.js:286`이 목록 밖/누락 Origin을 kill switch(292)·App Check(314)·공급자보다 먼저 거절한다. :8796 overlay에서 C1 0회는 구조적으로 유지된다.
4. **기본 대상 혼동 방지가 필요 조건으로 적혀 있다.** `.firebaserc`는 `pedagogy-huryul`, `firebase.json`은 firestore/storage rules를 모두 들고 있다.

## 미합의 — 보완이 필요한 구체 누락

**Q1 (범위·상태 정합)**

- **G1. A에서 구조적으로 실패하는 Storage 경로가 완료 기준에 없다.** 업로드는 `index.html:2944-2952` 실패 → `2981-2986`에서 base64 대체 + 오류 toast로 안전한 실패가 이미 있다. 그러나 `wipeStorageImages`(5682-5696)는 버킷이 없으면 `{listed:false}`를 반환하고 `storageCleanupComplete`(5698)가 false가 되어 **계정 삭제 흐름이 A에서는 성공 보고를 할 수 없다**. `releaseImage`(4769-4776)는 실패를 삼킨다. ⇒ "계정 삭제·이미지 정리는 A에서 미검증, 실패가 정상"을 A 범위에 명시.
- **G2. 합성 데이터의 이미지 상한이 없다.** base64 대체 경로를 타면 이미지가 Firestore 문서로 들어가 `index.html:2877-2880`이 피하려던 1MB 한도를 A에서 다시 건드린다. ⇒ 이미지 블록 제외 또는 수 KB 상한.

**Q2 (A0 overlay·CSP·App Check·Worker 경계)**

- **G3. `frame-src`의 production authDomain이 지목되지 않았다.** `index.html:35`, `document-editor.html:8` 모두 `https://pedagogy-huryul.firebaseapp.com`을 갖고 있어, config만 바꾸면 A1.4의 Google 로그인(authDomain iframe)이 CSP에서 막힌다. ⇒ authDomain↔frame-src 동시 교체 + staging authDomain 양성 확인.
- **G4. connect-src는 production 차단 수단이 아니다.** `index.html:34`의 Firestore/identitytoolkit/securetoken/appcheck 호스트는 프로젝트 공용이다. 잔존 차단은 식별자 문자열 검사로만 가능하다. ⇒ `build-guest-preview.mjs:10`(PROD 목록)·`164-180`(mkdtemp + `buildPublic` + 소스 불변 검증 175-177)을 재사용하되 **`checkGuestPolicy`는 그대로 못 쓴다** — 129행이 CSP에 firebase/identitytoolkit/recaptcha가 있으면 실패시킨다. staging 체커는 "production 식별자 부재(음성) + staging projectId/number/appId/authDomain 존재(양성)"로 갈라야 한다.
- **G5. overlay 플래그를 guest와 분리해야 한다.** `guestPreview:true`를 재사용하면 `build-guest-preview.mjs:51`에 따라 `initFirebase`가 즉시 return하고 로그인·App Check가 꺼져 **A1의 검증 대상이 사라진다**. staging은 "로그인 ON + AI OFF + Storage OFF"라는 새 조합이다. ⇒ 별도 플래그 + AI 앵커(52,55,56,71,73 대응 위치)만 선택 적용 + Storage 앵커(index.html:2949/4774/5685) 추가. A0.4는 "별도 빌드"라고만 한다.
- **G6. App Check 양성/거절을 Worker로는 증명할 수 없다.** §4는 kill switch만 지목하지만 `worker/index.js:286`의 origin 게이트도 App Check 검증(314) 앞에서 끊는다. ⇒ A0/A1의 App Check 증거는 Firestore enforcement(A1.6)로만 수집한다고 못 박을 것.
- **G7. staging site key와 origin 제약의 근거가 빠졌다.** `service-config.js:26`은 `appCheckSiteKey:""`이고 `index.html:2850-2857`·`document-editor.html:403-404`는 빈 키면 App Check를 초기화하지 않는다(그 상태의 `getAiAppCheckToken`은 index.html:2868-2871에서 빈 문자열 반환). ⇒ overlay 전용 `service-config.js`에 staging 키가 있어야 정상/거절 검증이 성립하고, 그 키의 `allowedDomains`는 `localhost`뿐(staging-readiness.json:70-77)이라 **127.0.0.1이 아닌 localhost:8796 고정**이라는 이유를 A0.5에 남길 것.
- **G8. 인라인 해시 재계산 수단 미지정.** `index.html:29`의 sha256 3개·`document-editor.html:8`의 1개는 config 한 글자로 어긋난다. ⇒ A0.3에 `scripts/lib/csp-rehash.mjs`·`scripts/check-source-csp.mjs`(또는 guest처럼 `buildPublic` 외부화)를 수단으로 명시.

## 다음 행동

1. §2~§3에 G1·G2 반영 — A 완료 기준에서 계정 삭제/이미지 정리를 명시적 미검증으로 빼고, 합성 이미지 상한을 적는다.
2. A0 설계를 G3~G5·G7~G8로 구체화 — overlay 전용 플래그·service-config.js, authDomain/frame-src 동시 교체, staging 전용 양성+음성 체커, guest 빌드의 mkdtemp/소스 불변 패턴 재사용, 해시 재계산 수단.
3. §4에 G6 추가 — origin 게이트도 선차단이므로 Worker는 App Check 증거원이 아니다.
4. 그 뒤에 A1(API 활성화 → DB 목록 확인 → 서울 `(default)` 생성 판단)로 진행. B는 결제·지역·사용량 결정 후 별도 승인.

범위 밖(미확인): 실제 계정/원격 구성, 운영·실기기·실자료 이관, Sonar, 회귀 재실행.
