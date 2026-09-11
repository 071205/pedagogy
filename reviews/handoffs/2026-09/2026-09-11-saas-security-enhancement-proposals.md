# 변경 인계 — 엔터프라이즈 SaaS 보안 강화 제안서

- ID: `HANDOFF-2026-114`
- 날짜: `2026-09-11`
- 작성자: `Gemini (Security Audit)`
- 상태: `ready-for-review`
- 영향 영역: `docs | security | infrastructure`
- 관련 이슈: `없음`

---

## 1. 개요 및 분석 배경

현재 PEDAGOGY 시스템은 `firestore.rules`, `storage.rules`, 그리고 `worker/quota.test.mjs` 등을 통해 데이터베이스 격리, 용량 폭탄 방어, 동시성(Race Condition) 공격 방어, XSS 방어(sanitize) 등 훌륭한 수준의 자체 방어 기제를 갖추고 있습니다.

그러나 본 서비스가 상용(Enterprise) B2B/B2C SaaS 모델로 확장하기 위해서는, 코드 내부의 방어를 넘어 **외곽 네트워크 계층 방어, 자동화된 보안 형상 관리(CSPM), 그리고 학생 개인정보(PII) 유출 방지**와 같은 SaaS 특화 보안 계층이 추가로 필요합니다. 이 문서는 현재 아키텍처에 적용하기 가장 적합한 4가지 보안 강화 솔루션을 제안합니다.

---

## 2. 주요 보안 강화 제안 (Action Items)

### ① Cloudflare WAF(웹 방화벽) 및 Rate Limiting 활성화
현재 Cloudflare Worker를 통해 AI 쿼터를 관리하고 있으나, 최전방(Edge)에서의 봇(Bot) 방어나 WAF가 명시적으로 설정되어 있지 않습니다.
- **제안:** 도메인 앞단에 Cloudflare WAF를 활성화하여 SQL/NoSQL 인젝션 패턴과 비정상적인 접근을 Firebase 도달 전에 차단해야 합니다.
- **효과:** 앱 내부 로직(Firebase)이 감당해야 할 부하와 클라우드 비용(Billing)을 외곽에서 미리 방어할 수 있습니다.

### ② Firebase App Check (reCAPTCHA Enterprise) 적용 강제
`COMMERCIAL-LAUNCH.md`에 출시 차단 조건으로 명시되어 있는 항목입니다.
- **제안:** 웹 클라이언트에 Firebase App Check를 연동하여, "정상적인 PEDAGOGY 프론트엔드"에서 발생한 요청이 아니면 Firestore 및 Storage가 응답을 거부하도록(Enforcement) 설정해야 합니다.
- **효과:** 공격자가 포스트맨(Postman)이나 파이썬 스크립트로 API 엔드포인트를 직접 찔러 데이터를 긁어가거나 비용을 발생시키는 행위를 원천봉쇄합니다.

### ③ 데이터 유출 방지(DLP) 파이프라인 적용 (Worker 계층)
교사나 강사가 학생의 정보가 포함된 텍스트/이미지를 AI로 변환할 때, 민감한 개인정보(PII)가 Anthropic 모델로 넘어갈 위험이 있습니다.
- **제안:** Cloudflare Worker (AI 요청 프록시) 내부에 정규식이나 가벼운 형태소 분석기를 이용한 마스킹(Masking) 로직을 추가합니다.
- **효과:** 학생 이름이나 전화번호 패턴이 발견되면 `홍*동` 등으로 자동 마스킹하여 서드파티 AI 플랫폼으로 데이터가 유출되는 것을 차단합니다. B2B(학교/학원) 계약 시 강력한 보안 세일즈 포인트가 됩니다.

### ④ 클라우드 보안 형상 관리(CSPM) 및 지속적 모니터링 도입
로컬 환경의 `check:launch`나 `check-audit-safety.mjs` 테스트는 훌륭하지만, 배포 이후 클라우드 콘솔에서의 휴먼 에러를 실시간으로 잡지 못합니다.
- **제안:** Google Cloud Security Command Center (SCC) 또는 가벼운 SaaS 보안 도구(Fencer 등)를 Firebase 프로젝트와 연동합니다.
- **효과:** 관리자가 실수로 Storage 버킷을 전체 공개로 변경하거나 IAM 권한을 잘못 부여했을 때 즉각적인 경고(Alert)를 받을 수 있습니다.

---

## 3. 다음 작업자를 위한 가이드
본 제안서는 코드 수정(Feature)이 아닌 인프라 및 아키텍처 개선 제안입니다. 운영자 및 인프라 담당자는 유료 전환 및 정식 출시(COMMERCIAL-LAUNCH) 이전에 위 제안들을 차례대로 도입하고, 적용 완료 시 이 문서를 `resolved` 상태로 변경해 주시기 바랍니다.
