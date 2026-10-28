## 최종 합의, 준비안 확정

읽기 전용으로 4개 문서 + `worker/wrangler.staging.toml:9-24`, `scripts/build-public.mjs` PUBLIC_FILES/HTML_FRAMING만 확인했습니다. 파일 수정·실행·원격 호출 없음.

**마지막 3건 — 모두 반영 확인**
1. Hosting/reCAPTCHA: §1 표 `기존 Hosting` 행(배포 이력·제공 내용 미조사, `.web.app`/`.firebaseapp.com`의 Auth 승인 ≠ reCAPTCHA 승인)과 §4(키 `allowedDomains=[localhost]`라 그 호스트 attestation 추정 금지, 원격 호스트 신설 시 Auth/OAuth/CSP/reCAPTCHA/ALLOWED_ORIGINS/CORS 동시 대조)에 모두 들어감. `staging-readiness.json`의 authorizedDomains 3개 vs recaptchaKey allowedDomains=[localhost]와 일치.
2. B-1: "kill switch=0, `APP_CHECK_MODE="monitor"`(검증 실패를 거절하지 않음)" 명시됨. 실제 설정과 일치(`AI_KILL_SWITCH="0"`, `APP_CHECK_MODE="monitor"`, ALLOWED_ORIGINS는 :8787 2개뿐). "billing 연결 **전에** 별도 변경+독립 검토로 차단 입증" 순서도 유지됨.
3. A0-3: 공개 엔트리 열거에 `legal.html` 포함, "공개 파일 전체에서 production 식별자 잔존 거절"로 서술됨. `legal.html`이 실제 공개 산출물(HTML_FRAMING 등재)이라는 점과 부합.

**원래 G1~G8 — 해소 확인**
G1 Storage/계정삭제·releaseImage·wipeStorageImages A 미지원 명시(A0-4, §2 A행, A1 완료기준) / G2 텍스트·수식만·2권×3문항·이미지 전 경로 제외·base64 fallback 거절(A1-5) / G3 authDomain↔`frame-src` 동시 교체 + iframe 양성 대조(A0-3) / G4 connect-src는 차단 수단 아님 + `checkGuestPolicy` 미사용 + 음성(production 부재)·양성(staging 식별자·실제 SDK 초기화) 분리(A0-3·A0-6) / G5 staging 전용 플래그, `guestPreview:true` 재사용 금지, 로그인 ON·AI OFF·Storage OFF(A0-4) / G6 App Check 증거원은 Firestore enforcement, origin·kill switch 선차단은 증거 아님(A1-6, §4) / G7 overlay 전용 `service-config.js` + Enterprise site key + localhost:8796 고정·127.0.0.1 미치환(A0-4·A0-5) / G8 `csp-rehash.mjs`·`check-source-csp.mjs`/`buildPublic` 외부화 + 개수 불일치 시 원본 반환하므로 결과 별도 검증(A0-3).

새로운 구체적 차단 결함 없음. 문서가 "준비안"이고 생성·활성화·배포·결제·실호출 미수행이라는 상태 표기도 증거와 일치합니다.

**다음 행동**
1. A0 — medium 구현 + 독립 검토 (분리 빌드/overlay, 양성·음성 체커, 해시 재검증, 새 빈 프로필, 실패 주입 포함).
2. A1 — 생성 전 범위·지역 확인 (Firestore API 활성화 → DB 목록·edition/mode/location·Rules 대조 → 없을 때만 서울 `(default)` 생성 판단).
3. B — 결제는 별도 결정 (kill switch=1 등 공급자 차단 입증 후, Blaze·지역·사용량 승인과 함께).
