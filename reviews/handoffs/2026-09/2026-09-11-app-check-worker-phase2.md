# 변경 인계 — App Check 클라이언트·Worker 2단계

- ID: `HANDOFF-2026-119`
- 날짜: `2026-09-11`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | document | worker | tests | docs | security`
- 관련 이슈: `없음`

## 변경 내용

`HANDOFF-2026-118`에서 확정한 App Check 코드 단계를 구현했다. 운영 site key와 콘솔 설정은
임의로 채우지 않았다.

- `index.html`과 `document-editor.html`이 reCAPTCHA Enterprise App Check를 초기화하고,
  초기화된 경우 AI 요청마다 새 `X-Firebase-AppCheck` 토큰을 보낸다. site key가 빈 현재
  전환 상태는 기존 호출을 유지한다. 초기화 후 토큰 발급 실패는 빈 헤더로 재시도하지 않는다.
- `worker/app-check.js`는 App Check 전용 JWKS로 RS256 서명, `typ`, issuer, audience,
  만료/발급 시각, app ID allowlist를 검증한다. 토큰 길이는 8 KiB로 제한한다. JWKS는 응답
  TTL과 6시간 중 짧은 값만 캐시하고 unknown kid는 한 번만 강제 갱신한다. 공개키 장애는
  invalid token과 구분한다.
- Worker는 `off → monitor → enforce` 모드를 지원한다. 알 수 없는 값은 enforce로 닫힌다.
  enforce의 invalid token은 401, verifier/JWKS 설정 장애는 503이며 body/quota/AI 전에 끝난다.
  CORS에 App Check 헤더를 추가했다.
- kill switch를 Origin 검사 직후로 옮겨 Auth/App Check/JWKS·본문·quota·AI 작업 전에
  503으로 종료한다. 잘못된 Origin은 계속 그보다 먼저 403이다.
- `wrangler.toml`에 공개 project number/app ID와 명시적 `APP_CHECK_MODE="off"`를 추가했다.
  현재는 운영 보호가 켜진 상태가 아니다. `check:launch`가 `enforce`가 아닌 설정을 출시
  차단 사유로 보고한다.

## 위험과 검토 요청

1. `worker/app-check.js`의 Firebase claim 계약과 WebCrypto 서명 검증을 독립 검토한다.
   Auth JWKS와 App Check JWKS가 섞이지 않았고 project ID와 project number가 구분되는지 본다.
2. site key를 넣기 전에 두 클라이언트가 모두 배포되는지 확인한다. frontend 구버전과
   enforce Worker를 함께 두면 AI가 전부 401이 된다.
3. `off`는 호환을 위한 현재 기본값이다. production 완료값이 아니다. staging에서 실제 Google
   token/JWKS, 허용 app, 다른 app, 누락 토큰을 확인한 뒤 monitor와 enforce를 순서대로 적용한다.
4. App Check는 재사용 가능한 JWT이며 사용자 인증·Rules·quota를 대체하지 않는다. replay
   protection은 이번 범위에 없다.
5. document editor의 Firebase SDK/CSP 호스트가 늘었다. 실제 Google 로그인과 reCAPTCHA iframe은
   외부 서비스를 차단한 로컬 브라우저 검사로 증명하지 못했다.

## 검증

- `node worker/app-check.test.mjs`: claim·서명 변조·다른 app/audience/issuer·만료·설정 오류,
  JWKS cache·timeout·unknown kid 1회 갱신·장애 분류 통과.
- `node worker/worker-contract.test.mjs`: missing/invalid 401, verifier 장애 503, monitor 통과,
  mode 오타 fail-closed, App Check가 quota/AI보다 앞, CORS, kill switch 선차단 통과.
- 실패 주입: enforce 분기를 임시 무력화하자 기대 401이 실제 200이 되어 실패했다. 문서 AI의
  App Check 헤더를 임시 제거하자 `check-static`이 실패했다. 둘 다 복원 후 통과했다.
- `npm run test:public-browser`: 공개 산출물의 두 AI 화면에서 token helper 성공 및 초기화 후
  발급 실패 차단 확인. 네 페이지·HWPX·private 경로 404도 통과.
- `CSP_ENGINES=chromium,webkit,firefox npm run test:csp`: 3엔진 × 3페이지 통과,
  CSP 지시어 제거 고장 주입도 검출.
- `npm run check:fast`: 종료 코드 0. `regression-test.html` 158/158, Chromium 플랫폼 회귀,
  Worker·정적·라이브러리·고장 주입 검사 통과. `lxml` 부재로 기존 HWPX Python 대조 일부는
  명시적으로 건너뛰었다. CDN 차단 경고 2건은 기존 기대값이다.
- `npm run check:launch`: 기대대로 종료 코드 1, App Check Worker enforce를 포함한 8개
  출시 차단 사유 보고.
- `git diff --check`, `npm run check:public`: 통과.

검사 중 JWT 서명의 마지막 Base64URL 문자만 바꾸던 fixture가 패딩의 미사용 비트만 건드려
원래 서명 바이트가 될 수 있음을 재현했다. 서명 첫 바이트를 뒤집도록 고쳐 반복 가능하게 했다.

## 다음 검토자에게

검토 범위는 이번 handoff의 App Check 파일과 `HANDOFF-2026-118` 전체 dirty diff다. 독립
검토가 끝나기 전 운영 배포나 enforce 전환을 승인하지 않는다. 콘솔 작업은
`docs/SECURITY-OPERATIONS-CHECKLIST.md` B·C 절의 미확인 항목에 실제 version ID와 결과를 남긴다.

`REV-2026-074` 메타파일은 검사 중 32개(그중 refs 12개)가 재발해 기존 좁은 스크립트로
정리했다. 생성 원인은 여전히 확인하지 못했으므로 이슈를 닫지 않는다.
