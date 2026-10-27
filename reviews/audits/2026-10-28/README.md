# R7 staging 자원·지역·비용 준비 — 2026-10-28

[staging-readiness.json](staging-readiness.json)은 추가 계정을 명시 선택한 직접 REST GET의
**안전 필드**만 보존한다. 기본 계정은 유지됐다. 모든 조회 대상은 고정된 기존 staging
`pedagogy-ai-staging`/450368559700이며 원격 변경과 AI 공급자 요청은 없다.

현재 상태: project/web config200, Firestore403/SERVICE_DISABLED(실제 DB 유무/지역 미확인),
bucket 목록200/빈 목록, Google provider404, billing false. Auth는 FIREBASE_AUTH이며
localhost+기본 Firebase 두 도메인만 승인됐다. Enterprise 앱 설정은 존재하고 TTL3600s,
실제 SCORE 키 allowedDomains는 localhost뿐이며 allowAllDomains=false다. 발급/거절은 미실행이다.

익명/이메일 enabled 응답 생략은 진단에서 null로 남겼다. config 안 bucket 이름은 생성 증거가
아니며, App Check Auth UNENFORCED 목록을 Firestore/Storage enforce 증거로 확대하지 않는다.
계정 객체·토큰·OAuth URL/state·SDK apiKey·secret·원시 응답을 기록하지 않는다.

[준비안](../../../docs/R7-FIREBASE-STAGING-PLAN.md)과
[인계](../../handoffs/2026-10/2026-10-28-docs-r7-firebase-staging-plan.md)를 따른다.
공식 문서(2026-10-28 확인):

- [Storage 요건](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024): Blaze 필수, 새 bucket 명명·미국 일부 지역 무료 조건.
- [Firestore 지역](https://firebase.google.com/docs/firestore/locations): 서울 지원·생성 후 변경 불가.
- [Firestore 비용](https://firebase.google.com/docs/firestore/pricing): 첫 DB 무료 할당량과 billing 필요 기능 구별.
- [App Check](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider): Spark에서도 제한된 score 범위 지원, 정상 발급과 enforcement는 별도 증거 필요.
- [예산](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills): alerts-only는 서비스를 정지하지 않으며 지원 서비스 한정 spend cap을 Firestore/Storage 전체에 적용하지 않음.

이 조사·준비안은 원격 provisioning/배포·R7/R8 운영 전체 완료 증거가 아니다. 이전 통과한
광역 검사를 재실행하지 않았고, 실제 API 활성화/지역 생성/결제는 수행하지 않았다.

## 독립 검토·문서 검증

Claude opus/high 읽기 전용 3회, 중첩0. [첫 검토](staging-plan-review-first.md)의 G1~G8과
[후속 결과](staging-plan-review-second.md)의 세 문구 누락을 제품/빌드 코드와 GET 필드로
독립 대조해 보완했다. [최종 판정](staging-plan-final-verdict.md)은 **준비안 확정·최종 합의**다.
검토자는 지정 코드/문서를 읽었으며 원격 호출·테스트 재실행·파일 수정은 하지 않았다.
Worker의 monitor/killSwitch 언급은 저장소 설정 기준이고 실제 live 설정 조회/차단 증거가 아니다.

문서 위생 통과(열림4·INDEX120/120·최근5/5), 변경 상대 링크·안전 JSON identity/credential 필드
대조·git diff --check 통과. 제품/검사 구현은 없어 기존 회귀175·정상12/RED6은 재실행하지 않았다.
새 구현/회귀 추가 시 필수 브라우저 회귀와 실패 주입·독립 검토를 다시 수행한다.

## A0 로컬 구현·검사 — 독립 코드 검토 대기

[실행 설명](../../../docs/R7-BACKEND-STAGING-A0.md) ·
[HANDOFF-204](../../handoffs/2026-10/2026-10-28-security-r7-backend-staging-a0.md).
[소스 지문·검사](a0-verification.json), [fixture 원본](a0-browser-fixture.json),
[실제 SDK 원본](a0-real-sdk.json)을 보존한다. 9개 runtime RED는 실제 목표 단언에서 실패를
확인한 뒤 checker가 검출 성공으로 기록한다. artifact RED12와 설정 거절9도 통과했다.

프로필 admission 전에 marker를 쓰거나 앱 코드를 실행하지 않고, 검사 완료 뒤 classic scripts를
원래 순서/SRI로 로드한다. dirty LS·IDB 재로드·다른 origin·검사 pending 상태도 확인했다.
실제 SDK 결과는 고정10.12.0 실행/전체 App 설정 일치뿐이며, 모든 backend 요청을 차단했다.
CSP auth iframe 양성 대조는 로컬 가짜 응답이다. 실제 Google 로그인/attestation/ACK가 아니다.

첫 Claude 코드 검토600초와 축소 검토360초는 둘 다 exit124/최종 의견0건이다. stderr progress는
비어 원인을 추정하지 않는다. 준비안에 대한 이전 Claude 합의와 **코드 검토 미완료**를 구별한다.
현재는 담당 대체에 대한 사용자 답을 기다린다. A1/API 활성화·자원 생성·Auth/Rules·과금·배포·
실자료/production 변경은 없다. 새 CI 실행/병합/운영 검증 완료도 주장하지 않는다.
