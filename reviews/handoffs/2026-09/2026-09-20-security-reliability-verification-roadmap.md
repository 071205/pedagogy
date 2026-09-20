# 상용 출시 전 보안·안정성 다각도 검증 로드맵

- ID: `HANDOFF-2026-151`
- 날짜: `2026-09-20`
- 작성자: `Antigravity`
- 상태: `ready-for-review`
- 영향 영역: `security | testing | ops | quality`
- 관련: `HANDOFF-2026-148`, `HANDOFF-2026-150`, `docs/COMMERCIAL-LAUNCH.md`

## 1. 배경 및 현황

`HANDOFF-2026-150` 및 커밋 `66f3d0a` 이후 SonarCloud 재분석이 완료되었다.
- **Reliability (안정성):** Bugs 140건 → 0건 (D등급 → **A등급** 🟢 달성)
- **Security (보안):** Vulnerabilities 157건 → 11건 (E등급, 93% 오탐 제거)
- **Maintainability (유지보수성):** A등급 🟢 (326 Code Smells)
- **패키지 공급망 검사:** `npm audit` 결과 취약점 0건(PASS) 확인

SonarQube(SAST) 수준을 넘어 실제 상용 서비스 출시 전 수행할 수 있는 다각도 보안·안정성 검증 프레임워크를 정리하여 후속 작업자에게 인계한다.

---

## 2. 권장 검증 매트릭스 (Codex 점검용)

### A. 보안 침투 및 동적 검증 (Security)

1. **동적 침투 테스트 (DAST / OWASP ZAP)**
   - 정적 코드 분석이 놓치는 런타임 취약점(XSS 페이로드 실반영, CORS 헤더 우회, Worker 엔드포인트 파라미터 변조 등)을 점검한다.
   - 대상: Cloudflare Worker API 및 GitHub Pages / Staging 배포본.

2. **시크릿 누출 감사 (Secret Scanning)**
   - `gitleaks` 또는 `trufflehog`를 로컬에 실행하여 Git 히스토리 전체에 Firebase Service Account Key, Anthropic Key, Cloudflare Token 등이 실수로 커밋된 적이 있는지 전수 확인.

3. **CSP 유효성 정밀 평가 (Google CSP Evaluator)**
   - SonarCloud가 잔여 취약점으로 지적한 HTML 메타 태그의 `unsafe-inline` 및 와일드카드(`*`) 정책이 실제 XSS 방어에 안전한지 검증하고 불필요한 완화 규칙 축소.

### B. 신뢰성 및 극한 환경 검증 (Reliability & Chaos)

1. **몽키/카오스 테스팅 (Fuzzing / Gremlins.js)**
   - 비정상적인 사용자 인터랙션(0.01초 단위 무작위 클릭, 수만 자 텍스트/이모지/특수문자 입력) 시 에디터나 조판기가 크래시(White Screen) 없이 회복하는지 점검.

2. **네트워크 장애 회복력 테스트 (Offline Survival)**
   - 문항 편집 및 저장 도중 네트워크 강제 오프라인 전환 시 로컬 스토리지 보존 및 재연결 후 동기화 동작 확인.

3. **부하 및 동시성 스트레스 테스트 (k6 / Artillery)**
   - 50~100명의 가상 동시 사용자가 시험지 생성, Firestore 동시 쓰기, HWPX 다운로드를 요청할 때 Cloudflare Worker Quota 락(Race Condition) 및 오류율 관측.

### C. 저장소 내 이미 준비된 핵심 검증 도구 실행

- `npm run check:launch`: 상용 출시 차단 항목(결제, 법무, App Check 등) 점검
- `npm run check:rules`: Firebase Emulator 기반 Firestore/Storage 보안 규칙 검증
- `npm run test:cross`: Chromium, Firefox, WebKit(Safari) 3대 엔진 크로스 브라우징 조판 일치 검증
- `npm run test:audit-browser`: 158개 브라우저 감사 시나리오 검증

---

## 3. 다음 작업자(Codex) 액션 가이드

1. `check:launch`를 실행하여 현재 상용 출시 게이트의 미충족 항목 목록을 확인한다.
2. SonarCloud 잔여 11건(CSP 7건, serve.py 4건) 중 안전하게 보완 가능한 CSP 메타태그 정리를 검토한다.
3. 로컬 환경에서 `check:rules`와 `test:cross`를 수행하여 엔진 및 보안 규칙의 무결성을 최종 점검한다.

## 통합 검토 기록 — 2026-09-20 Codex

실행 순서와 모델은 [활성 레일](../../../docs/DEV-TOKEN-ROADMAP.md)의 R1/R6~R8로 편입했다.
동일 커밋의 유효한 CI 결과부터 재사용하며 전체 검사·DAST·부하를 매번 실행하지 않는다.
현재 Bugs 0·취약점 11·Code Smells 326 수치는 API 대조했으나, ‘93% 오탐 제거’는
제외 범위와 수정·분류 변화가 섞여 있어 확정 성과로 채택하지 않는다. 과거 Reliability impact와
Standard Bugs도 직접 비교하지 않는다. npm audit 결과만으로 전체 공급망 검증 완료를 뜻하지 않는다.
