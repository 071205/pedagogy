# 변경 인계 — 상용 보안 아키텍처 확정과 안전한 1단계

- ID: `HANDOFF-2026-118`
- 날짜: `2026-09-11`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | mock | document | tests | CI | docs | security`
- 관련 이슈: `REV-2026-081`, 열린 `REV-2026-074` 확인

## 변경 내용

`90536cb`의 코드와 HANDOFF-114/115/117, 보안 심층 검토, 출시·과금·운영 문서 및 열린
이슈를 대조했다. 최신 공식 문서로 GitHub Pages 상용 SaaS 제한, App Check custom backend
검증, CSP 전달 범위, Cloud Billing spend cap의 제한된 지원 범위를 확인했다.

- `docs/SECURITY-ARCHITECTURE.md`: private source/public build, Cloudflare 호스트·Worker,
  Firebase enforcement, CSP, 공급망, 비용원별 차단의 우선순위와 후속 구현 계약 확정.
- `docs/SECURITY-OPERATIONS-CHECKLIST.md`: 운영 콘솔 증적, 실제 로그인·과금 실험, 도메인
  이전의 로컬 데이터 export, 배포/롤백 순서. 운영 항목은 전부 미확인으로 분리했다.
- `scripts/build-public.mjs`: 런타임 17개 파일만 `dist/public/`에 복사. symlink·출력 초과
  파일/디렉터리·sourceMappingURL·대표 비밀 패턴 거부. SHA-256 목록은 웹 루트 밖에 저장.
  반복 빌드의 파일 바이트가 동일함을 확인했다. `.gitignore`에 dist 추가.
- 세 HTML의 `script-src-attr 'none'`: 기존 이벤트 속성 실행을 재현한 뒤 차단.
  JS property callback·listener·기존 inline script는 유지한다. `REV-2026-081`에 근거 기록.
- CI: checkout `persist-credentials: false`, job별 30분 timeout, ref별 중복 실행 취소,
  public build/브라우저 확인, 세 엔진 CSP 검사 연결. 자동 배포·새 자격 증명은 없다.
- 출시·운영 문서: 사용자 DELETE로 quota를 지운다는 낡은 설명을 현재 코드와 맞췄다.

## 독립 검토에서 유지·보정한 판단

전역 quota는 이미 구현됐고 `REV-2026-080`의 예약 ID와 fail-closed 수정은 유효하다.
다만 일일 호출 횟수 상한이지 전 서비스 금액 상한이 아니다. App Check는 index 초기화
준비만 있고 빈 key이며, 자체 Worker와 document AI에 전송·검증이 없다. Firebase enforcement
만으로 Worker가 보호되지는 않는다. WAF가 Firebase 직접 SDK 앞을 지킨다는 제안도 채택하지 않았다.

원본 저장소 비공개 전환은 이번에 실행하지 않았다. 현재 GitHub 원격 visibility·콘솔 설정을
확인했다고 주장하지 않는다. 이전 리뷰의 공개 상태는 과거 증거다. 공개 빌드는 **아직 원본
HTML/JS 바이트를 복사**하며 압축·주석 제거·엄격한 CSP·App Check 구현은 후속 단계다.
기존 공개 이력을 회수하거나 브라우저에 전달한 조판 로직을 숨길 수 있다는 보증은 하지 않는다.

## 검증

| 검사 | 결과 |
| --- | --- |
| `node scripts/build-public.test.mjs` | 통과. 실제 입력 복사·재현성, private decoy 제외, map/secret/입력 symlink/manifest symlink/누락 입력/출력 오염 거부 |
| `npm run build:public` / `npm run check:public` | 17개 산출물 생성·검사 통과 |
| `npm run test:public-browser` | 산출물만 `/pedagogy/`에 서비스. 네 페이지·로컬 script·시험지 템플릿 open/serialize·문서 HWPX 생성 정상, 내부 경로 404 |
| `CSP_ENGINES=chromium,webkit,firefox npm run test:csp` | 세 엔진 × 세 페이지 통과. 각 실제 응답에서 지시어만 제거하면 속성 실행 1 검출 |
| 수정 전 CSP 검사 | 실제 index에서 `1 !== 0` assertion 실패 확인. 초기 sandbox의 listen EPERM은 보안 재현으로 세지 않음 |
| `npm run check:fast` | 종료 코드 0. `serve.py`의 regression-test.html **158/158**, 실패 행 0. 기존 고장 주입의 FAIL 출력은 기대된 자기검사 |
| 후속 `npm run check:static` | 종료 코드 0 |
| `npm run check:launch` | 기대된 종료 코드 1, 기존 7개 차단 사유 유지 |
| `git diff --check` | 통과 |

`check:fast`의 HWPX Python·브라우저↔Python 대조는 로컬 `lxml` 부재로 기존 규칙대로
건너뛰었다. Chromium 교차환경 검사에는 기존 외부 CDN 차단 경고 2건이 있었다.
새 산출물/CSP 검사는 외부 서비스를 차단했다. 실제 로그인·reCAPTCHA·운영 Worker/DO·Rules
배포·GitHub Actions 서버 실행을 검증한 것이 아니다. Rules는 변경하지 않아 emulator를
다시 실행하지 않았다. 기존 sanitizer XSS 회귀는 CSP 없는 부모 문서에서 실행되므로 이번
CSP 강화로 검사 실패가 가려지지 않는다.

## 위험과 검토 요청

공개 파일 목록은 `serve.py`의 런타임 목록과 HTML 동적 참조를 대조했다. 새 런타임 파일이
생기면 allowlist와 산출물 브라우저 검사를 같이 갱신해야 한다. 비밀 패턴 검사는 완전한
secret scanner가 아니고 manifest는 attestation이 아니다. 실패한 빌드 뒤 남아 있는 이전
산출물을 자동으로 배포하면 안 된다. build와 verify가 성공한 결과만 승격한다.

`document-editor.html`은 기존 직접 URL 호환을 위해 산출물에 남겼다. App Check 강제 전에
두 AI 호출자를 함께 바꾼다. 새 호스트의 `frame-ancestors`를 모든 페이지에 none으로 두면
모의고사 iframe이 깨진다는 점을 특히 검토한다.

## 다음 검토자에게

현재 로컬 diff와 위 두 설계 문서, 새 scripts 네 개를 우선 검토한다. source/build 경계,
CSP 정책 제거 변형, 기존 158개 회귀가 서로 다른 위험을 검사하는지 재확인한다.
`REV-2026-074`의 0바이트 refs 메타파일 4개는 기존 스크립트로 정리했지만 원인은 미확인이라
열린 상태로 유지했다. `REV-2026-075`는 재현 불가 상태 그대로다. 추측 이슈는 추가하지 않았다.

원격 push/배포/저장소 visibility/운영 설정 변경은 수행하지 않았다. 설계 전체나 상용 출시를
완료로 표시하지 말고, **1단계 구현 완료 / 이후 단계·운영 증적 미완료**로 구분한다.
