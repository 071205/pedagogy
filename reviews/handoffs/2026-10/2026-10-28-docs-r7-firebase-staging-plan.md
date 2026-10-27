# 변경 인계 — R7 Firebase staging 자원·지역·비용 준비안

- ID: `HANDOFF-2026-203`
- 날짜: `2026-10-28`
- 작성자: `Codex`
- 상태: `needs-follow-up` (준비안 독립 합의 완료, A0 구현 대기)
- 영향 영역: `docs`
- 관련 이슈: `없음` (기존 REV-093·REV-147 및 출시 게이트 유지)

## 변경 내용

[실행안](../../../docs/R7-FIREBASE-STAGING-PLAN.md)을 작성했다. 기존 `pedagogy-ai-staging`의
추가 계정/identity를 고정한 직접 GET으로 자원·Auth·billing·App Check 상태를 새로 조사했다.
공식 문서를 대조해 A(결제 미연결 Auth/Firestore 부분 검증)를 먼저, B(Storage)는 Blaze·비용·
지역 결정 뒤로 분리했다. 서울 Standard/Native/default DB는 생성 전 확인할 후보이며 아직 없다거나
생성됐다고 주장하지 않는다. 로컬 분리 overlay와 빈 프로필, 세 HTML/CSP·production 잔존 검사,
공급자 비호출 경계, 원격 변경별 중단·복원 조건을 준비안에 넣었다.

## 위험과 검토 요청

- Firestore403/SERVICE_DISABLED는 API 비활성이지 DB 부재 증거가 아니다.
- SDK config의 bucket 이름과 실제 bucket 생성, 키 등록과 정상 attestation을 구별한다.
- Firestore 지역은 생성 후 바꿀 수 없다. Storage Blaze 전환은 AI 호출/Identity Platform
  업그레이드 승인이 아니다. 예산 알림은 Firestore/Storage의 금액 상한이 아니다.
- 기존 localhost 운영 프로필의 로컬 실자료를 staging에 노출하지 않도록 빈 프로필을 요구한다.
- production·guest 공개 호스트·기본 checkout·transcript.txt는 변경/접근하지 않았다.

## 검증

- 실제 읽기 전용 원격: 프로젝트/web config200·기본계정 유지·계정2개. Firestore403/SERVICE_DISABLED,
  Storage 목록200/빈 목록, Google provider404, billing false. Enterprise config 존재, 실제 키의
  allowedDomains는 localhost만이고 allowAllDomains=false다.
- [안전한 진단](../../audits/2026-10-28/staging-readiness.json): 계정 객체·OAuth URL/state·token·
  SDK apiKey·OAuth client secret 없이 허용 필드만 보존했다. 원시 API 응답은 커밋하지 않는다.
- 공식 비용·지역·App Check 문서는 실행안 끝 링크와 감사 README에서 연결한다.
- 변경은 준비 문서/안전한 GET 증거뿐이다. 제품 기능·회귀/의존성·실행 환경은 바꾸지 않아 기존
  통과175/정상12/RED6을 반복하지 않는다. 새 기능/검사 구현도 아직 없다.
- review hygiene 통과(열림4·INDEX120/120·최근5/5), 변경 상대 링크·staging identity/금지 credential
  필드 대조·git diff --check 통과. 신규 CI/운영 검증 완료를 주장하지 않는다.

## 실제 변경 범위와 다음 행동

원격 변경 **0건**: API enable·DB/버킷 생성·Auth/Rules/IAM·billing·Worker/정적 배포·유료 AI 호출 없음.
다음은 준비안의 독립 합의 후 A 실행 범위를 확정하는 것이다. A0 로컬 overlay부터 구현하되,
불변 지역/원격 자원 생성은 결정한 범위에서만 수행한다. 실제 자료 이관은 high·독립 검토를 유지한다.
분리 backend/App Check/실기기·인간 관찰·main Sonar·R7/R8 운영 전체는 미완료다.

## 검토 기록

- 2026-10-28 · Claude opus/high · 읽기 전용 3회, 중첩0. 처음 지적한 G1~G8(Storage 없는 A의
  계정삭제/이미지 제외·텍스트 fixture 상한·CSP/authDomain·별도 플래그·staging 양성/prod 음성·
  Firestore App Check 증거·staging key/localhost·해시 결과검증)을 Codex가 코드와 대조해 보완.
  후속의 Hosting/reCAPTCHA·monitor 비거절·legal.html 누락도 직접 확인해 반영했다.
- 합의: [최종 판정](../../audits/2026-10-28/staging-plan-final-verdict.md) **준비안 확정, 새 차단 결함 없음**.
  미합의 없음. 실제 자원 구축/과금/attestation 성공에 대한 합의가 아니라 문서/코드 경계 판정이다.
  Worker의 kill switch/monitor는 source 설정이며 live 상태는 B 전 확인할 대상으로 유지한다.
- Codex 추가 판단: 같은 프로젝트 billing 연결 전 기존 staging Worker 공급자 차단을 입증하도록
  넣었다. origin/kill switch 앞단 거절을 App Check 검증으로 포장하지 않는다.
- 다음: **A0 medium 구현 + 독립 검토**. 분리 overlay/전용 설정·공개4엔트리/CSP·새 빈 프로필·
  production 음성/staging 양성·네트워크 guard와 실패 주입/필수 회귀를 수행한다. A1은 API 활성화 뒤
  기존 DB/Rules를 먼저 읽고, 생성 전 범위·서울 후보 지역을 확인한다. B는 결제 별도 결정이다.
