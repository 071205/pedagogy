# 변경 인계 — R8 렌더 실패·복구와 300문항 정합

- ID: `HANDOFF-2026-202`
- 날짜: `2026-10-27`
- 작성자: `Codex`
- 상태: `needs-follow-up` (로컬 검사 독립 합의 완료, R7 자원·운영 게이트 후속)
- 영향 영역: `tests`, `docs`
- 관련 이슈: `없음`

## 변경 내용

`reviews/audits/2026-10-27/r8-render-recovery.mjs`에 합성 guest 자료만 쓰는 주문형 로컬 감사
probe를 추가한다. 1194×834·768×1024·375×812에서 본문 글꼴 실패→네트워크 복구+재로드,
이미지 실패→정상 이미지 교체, 지연된 옛 렌더→최신 한 번 게시를 확인한다. 300문항의 고정
기대 ID·순서·개수와 지면/인쇄의 쪽·칸·치수·본문을 대조한다. 제품 소스 변경은 없다.
기존 광역 검사를 반복하는 대신 R8 인계에서 허용된 실패 후 복구/큰 입력 경계를 보완한다.

## 위험과 검토 요청

- Firebase 등 backend는 차단한다. 가짜 Storage URL 응답은 Playwright가 로컬로 생성한다.
  실제 인증·계정 동기화·원문/실자료 저장은 없다.
- 정상과 단독 stale RED의 시작 상태를 동일한 settled 지면으로 맞췄다. 준비 시간 초과를
  목표 방어 검출로 세지 않는다. 무효화 제거 시 bad publication 1회·swap 2회를 검출한다.
- 300문항 시간은 양쪽 모두 글꼴 준비 후 측정한다. sheet는 장식·축소판까지 포함하지만
  print는 실제 doPrint 준비 경계까지이므로 두 시간을 성능 우위/회귀율로 비교하지 않는다.
  중복 20초 단언은 제거하고 INFO만 기록한다. 실기기·대규모 표본 p95가 아니다.
- RED는 메모리 HTML 응답에만 변이를 심고 CSP 해시를 갱신한다. 저장소 제품 파일과
  원격 호스트에는 실패 주입하지 않는다. owned 서버/브라우저는 finally에서 종료한다.

## 검증

최종 정상/RED·독립 검토 결과와 영구 증거는 [감사 README](../../audits/2026-10-27/README.md)에 기록한다.
정상 세 화면×4과제 12건 exit0, 300문항 고정 순서·150쪽 정합과 정리 성공.
image/font/stale/count/print-order/print-layout RED6개 모두 목표 접두사에서 exit1·정리 성공.
지면 184/179/179ms·제품 doPrint 준비 313/339/323ms는 같은 실행의 각 1회 INFO다.

- `node scripts/check-audit-browser.mjs`: serve.py + regression-test.html **175/175**, 정규화
  왕복·잘못된 JSON root 12건 거절 통과, exit0.
- 최초 probe의 http 합성 이미지 URL은 제품 신뢰 경계에서 제거됐다. 허용된 https Storage
  형태의 가짜 URL과 로컬 route 응답으로 고쳤다. 제품 결함으로 등록하지 않는다.
- 초기 stale 단독 RED는 준비 시간 초과였다. settled 시작 상태 보완 뒤 목표 단언에서
  bad=1/swaps=2로 exit1을 확인했다.
- 글꼴을 포함하던 초기 300문항 타이머는 한 정상 재검사에서 20초 기준을 넘었다.
  다운로드·기기 부하 중 원인을 확정하지 않으며, 최종 probe는 양쪽 글꼴 준비 뒤 잰다.
  후속 모바일 준비 timeout도 최종 통과와 구별한다. 같은 실행 내 CDN 바이트 메모리 재사용으로 보완했다.
- 실제 시스템 인쇄·한글, Safari/iPad, 실계정 ACK, 유료 AI, 인간 과제 관찰은 미검증이다.
  R7/R8 운영 전체 완료가 아니다.

## staging 접근

이 세션 시작 때 계정1개·기본 fingerprint `d8bbf1f8ef96`, staging project GET와 web config
GET 모두 403/PERMISSION_DENIED를 재확인했다. 기존 로그인 세션/URL은 재사용하지 않았다.
사용자가 지금 로그인 가능하다고 답해 새 공식 Firebase CLI `loginAdditionalAccount(true)`
흐름을 시작했다. Chrome 공식 OAuth 주소에 `prompt=select_account`만 추가해 열었으며
URL/state/token/계정 객체를 출력·커밋하지 않는다. 기본 계정은 변경하지 않는다.
새 흐름은 10분 제한으로 종료됐으며 완료 callback이 없었다. 종료 뒤 계정1개·기본 fingerprint
`d8bbf1f8ef96` 유지를 재확인했다. 계정 추가/접근 복구 증거는 없고, 종료된 URL/세션을
재사용하지 않는다. 사용자에게 만료를 알렸고 다음 인증은 새 흐름이 필요하다.
CLI raw/OAuth 로그는 저장소에 없다. provider 호출·결제·IAM·production 변경도 없다.

### 최종 staging 접근 복구

사용자가 첫 창 미표시/오류를 알려 Chrome 새 인스턴스 옵션을 제거하고 **새** 공식 흐름을
시작했다. native Chrome에서 Google 탭 존재만 안전하게 확인하고 그 탭을 앞으로 표시했다.
사용자 성공 응답 뒤 실제 callback과 `accountCount=2/defaultUnchanged=true`를 회수했다.
추가 계정 fingerprint `74138acea7c7`를 명시 선택한 GET에서 프로젝트·웹 앱 **200**,
projectId/number/appId가 과거 기록과 일치했다. 현재는 인증 대기/403 접근 불가 상태가 아니다.

[안전한 진단](../../audits/2026-10-27/staging-access-recovery.json): Firestore403은
`SERVICE_DISABLED`, bucket list200/빈 목록, Auth authorizedDomains는 localhost와 기본 Firebase
도메인뿐, App Check Enterprise 설정 존재·Auth 서비스 UNENFORCED, Google provider GET404,
billingEnabled=false다. 허용 도메인/정상 토큰 발급·거절, Firestore/Storage Rules·자원은 미완료다.
조회만 했고 API enable·지역/버킷 생성·IAM·결제/공급자 호출·production 변경은 없다.
자동 승인 검토가 추가 GET 진단 한 번을 deadline 초과로 거절했으나, 허용된 단일 재시도에서
Firestore reason/Google provider 안전 필드 조회를 완료했다. 미해결 승인 거절은 없다.

## Claude 1차 지적의 처리

- D1: 옛 renderSheet 호출의 종료 자체를 추적하고, 그때까지 다음 220ms 예약을 차단한다.
  그 뒤 최신 조립을 허용하므로 느린 기계에서 새 세대가 먼저 시작해 RED가 초록불 되는 경합을 없앴다.
- D2: 변이 앵커·CSP 준비를 서버 spawn 전에 수행하고 spawn은 try/finally 안으로 옮겼다.
- D3/D5: 제품 doPrint를 직접 실행하고 print-order/print-layout 독립 RED를 추가했다.
  잘림/축소 경고 전체에 대한 주장은 하지 않는다.
- D4/D9: 글꼴 정의 부재의 복구·이미지 데이터 URL 교체 복구로 정확히 한정한다.
- D6/D7/D8: 현재 statement fixture로 한정, stage mutation record별 집계, INFO 성능 기록으로 정리했다.

## 다음 검토자에게

신규 probe 전체와 `index.html:9700` 렌더/경고, `scripts/check-sheet-view.mjs` 기존 표적 검사,
`pedagogy-normalize.js` URL 경계, `scripts/serve-static-staging.mjs` lifecycle을 검토한다.
운영 게이트·이관/high 구현·Sonar 차단을 이 로컬 검사로 닫지 않는다.

## 검토 기록

- 2026-10-27 · Claude opus/high · 읽기 전용 3회(중첩0). 첫 코드 검토의 경합·조기 정리·인쇄 양성
  대조를 Codex가 코드와 검사로 독립 확인하고 보완했다. 두 번째의 인쇄 RED 증거 미완결 판정은
  요약 갱신 직전 상태였으며 원시6개 보존 후 세 번째에서 해소·**최종 합의, 새 재현 결함 없음**.
  [판정](../../audits/2026-10-27/r8-render-final-verdict.md). 검토자는 검사를 재실행하지 않고 코드/원시
  증거를 대조했다. 이후 staging 직접 GET 진단은 그 R8 검토 범위 밖이다.
- 구현자 Codex: 정상12 exit0, 독립 목표 RED6 exit1, 최종 debounce 계수/배열/CSP 보강 뒤
  정상12·stale RED를 재확인했다. 제품 source index SHA와 최종 probe SHA는 감사 manifest로 연결한다.
- 다음: Sol medium에서 기존 staging Firestore API/자원·Storage·Auth·Rules·origin/App Check 준비.
  결제 연결/새 공급자 호출은 C1 별도 게이트, 실제 자료 이관은 high·독립 검토를 유지한다.
  기본 checkout·production 전환·실자료 이관을 이번에 수행하지 않았다.
