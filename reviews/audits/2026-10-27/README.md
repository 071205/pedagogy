# R7 guest framing 양성 대조

REV-2026-153의 실제 로컬 정상/RED 요약은 `guest-framing-summary.json`이다.
기존 06e9029 checker 사본의 부팅 후 top-level libraryView id만 제거해도 exit0이었던
검사 공백을 재현했다. 제품 소스나 HTTP CSP를 바꿨다는 뜻은 아니다.
현재 검사는 top-level count1을 먼저 요구하고 다른 origin iframe의 count0을 비교한다.

```sh
node scripts/check-guest-host.mjs
GUEST_HOST_RED=missing-library-view node scripts/check-guest-host.mjs
GUEST_HOST_RED=drop-frame-headers node scripts/check-guest-host.mjs
```

순차 실행한다. 정상은 exit0/234manifest·233제공자산/양성대조/헤더·404·iframe 통과,
두 RED는 각각 양성대조/HTTP CSP 목표 단언에서 exit1이다. 원격 RED는 초기 거절된다.
Wrangler 여러 개를 동시에 시작한 초기 probe는 readiness 실패가 있었고, 소유 프로세스
정리 후 단독·순차 실행으로 정상과 목표 RED를 확인했다. 이를 제품 결함으로 세지 않는다.

원래 격리 재현 코드·전체 로그는 `/private/tmp/pedagogy-guest-positive-before.mjs`와
같은 prefix의 before/normal/red/header-red/remote-red-denied.log다. 토큰·사용자 자료 없음.
코드는 현재 scripts의 local-only RED로 재현 가능하다. 원격 호스트 배포·App Check·
분리 Firebase·원문 무손실 이관·R7/8 운영 완료 증거를 대신하지 않는다.


## 실제 원격 guest 호스트

[게스트 미리보기](https://pedagogy-guest-preview.dbruddl79.workers.dev).
`guest-deployment-verification.json`은 source d65e759·PR head88c86d5/merge의 필수CI4개,
전용cwd/config·정확10007·이번호출생성·deployment version ID·원격233자산/헤더/404·
양성/iframe 결과를 묶는다. `pages-source-verification.json`은 기존 Pages 핵심5파일의
소스 일치이며 guest와 혼동하지 않는다. `main-sonar-status.json`은 main의 기존
new_security_rating5/ERROR가 남았다는 실제 분석 revision 증거다.

원격 재현: `GUEST_HOST_BASE=https://pedagogy-guest-preview.dbruddl79.workers.dev node scripts/check-guest-host.mjs`.
정상 exit0이고 원격에 실패 주입하지 않았다. 원격 RED는 코드가 초기 거절한다.
CLI raw 로그는 비공개 임시 폴더 pedagogy-r7-guest-published-i388sph8에만 두고
토큰·계정 식별자·debug 원문을 공개하지 않는다. rollback은 실행하지 않았다.
새 guest의 공개는 backend/Auth/AppCheck·원문 이관·R7/8 전체 운영 완료를 뜻하지 않는다.


Claude 3차의 실제 증거 대조 최종 합의는 `claude-final-verdict.md`에 보존한다.
그때 원시 API로 담기지 않았던 PR Sonar/Pages built 필드는 Codex가 같은 revision으로
추가 조회해 `publication-checks.json`에 보존했다. 이 추가 JSON까지 Claude가 재검토했다고
주장하지 않는다. 실제 CI·원격과 기존 게이트 구분에 구체적 불일치는 없었다.

## R8 렌더 실패 후 복구·300문항 조립

주문형 감사 probe: `r8-render-recovery.mjs`. 합성 guest 자료와 독립 Chromium 컨텍스트만
사용한다. Firebase 요청은 가짜 Storage 이미지 경로 한 개의 로컬 응답을 제외하고 차단한다.
production·로그인·실자료·유료 AI·원격 호스트는 건드리지 않는다. 동일 실행에서 CDN 바이트를
메모리에 재사용하며 글꼴 실패 route는 캐시보다 먼저 적용한다. CDN 접근 자체는 필요하다.

```sh
node reviews/audits/2026-10-27/r8-render-recovery.mjs
R8_RENDER_RED=image node reviews/audits/2026-10-27/r8-render-recovery.mjs
R8_RENDER_RED=font node reviews/audits/2026-10-27/r8-render-recovery.mjs
R8_RENDER_RED=stale node reviews/audits/2026-10-27/r8-render-recovery.mjs
R8_RENDER_RED=count node reviews/audits/2026-10-27/r8-render-recovery.mjs
R8_RENDER_RED=print-order node reviews/audits/2026-10-27/r8-render-recovery.mjs
R8_RENDER_RED=print-layout node reviews/audits/2026-10-27/r8-render-recovery.mjs
```

정상은 세 화면 × 네 과제 **12건, exit0**이다. RED는 정상 통과로 포장하지 않고 각각 exit1을
내므로 실행자가 `error`의 목표 접두사·cleanup/serverStopped를 함께 확인한다.
`R8_RENDER_OUT`은 결과 디렉터리를 지정한다(기본은 실행마다 새 OS temp 폴더).
기본 CI에 연결하지 않은 R8 현장 감사 도구이며, 기존 check:fast의 광역 회귀를 대신하지 않는다.

확인 범위:

- 글꼴 CSS 정의 부재→경고→네트워크 복구+실제 재로드 후 경고 해제. 정의가 있는 폰트 파일
  다운로드 실패 분기는 기존 `check-sheet-view.mjs`의 별도 검사이며 이번 복구 주장이 아니다.
- 실패 이미지→`sheetIssues`와 화면 경고→데이터 URL 교체+saveSets→실제 이미지 로드와 경고
  해제. 이미지 교체 UI 조작의 검증은 아니다.
- 이미지 대기를 실제로 붙잡은 옛 renderSheet 호출이 종료할 때까지 다음 220ms 예약을
  차단한다. 그 후 최신 렌더를 허용해 bad=0/swaps=1과 최신 본문을 확인한다. 타이머 운에
  기대지 않는다. 정상·RED 모두 같은 준비 상태/순서를 사용한다.
- 300문항 고정 기대 ID·순서·개수와 150쪽 지면/인쇄의 칸·본문·치수·배율을 대조한다.
  제품 `doPrint`를 실제 실행하고 시스템 `window.print` 경계에서 측정용 `measuring`을 잠깐 재부여해 캡처한다. 실제 종이 인쇄·PDF
  출력 검증은 아니다. 잘림/축소 경고 종류 전체를 검증한다는 주장도 하지 않는다.
- 같은 실행에서 글꼴 준비 뒤 지면은 **184/179/179ms**, 제품 인쇄 준비는 **313/339/323ms**
  (1194×834·768×1024·375×812 순서). 측정 범위가 달라 속도 우위를 뜻하지 않고, 각 1회
  기록이며 p95/실기기 성능이 아니다. 기존 검사와 중복인 20초 성능 단언은 두지 않는다.

[소스·probe 지문](r8-render-verification.json), [최종 정상](r8-render-normal.json), [RED 요약](r8-render-red-summary.json),
[첫 Claude 코드 검토](r8-render-review-first.md)·[후속 검토](r8-render-review-second.md)를 보존한다.
RED 원시 출력 6개도 `r8-render-red/`에 보존하며 요약에서 각각 연결한다.
[Claude 최종 합의](r8-render-final-verdict.md)는 고정된 최종 probe·정상12·RED6개 원시 출력과
문구를 대조한 코드/증거 판정이다. 검토자가 직접 검사를 재실행했다는 뜻은 아니다.
staging 접근 복구의 후속 API 진단은 그 R8 최종 검토 범위와 구별한다. 첫 검토는 restricted 환경에서
/tmp 결과를 읽지 못했으므로 코드 검토만이다. 초기 probe의 http 합성 이미지 제거, 단독 stale
준비 시간 초과, 글꼴 포함 타이머 20초 초과와 후속 CDN 준비 시간 초과는 개발 중 하네스
실패이며 최종 통과로 덮지 않는다. /private/tmp/pedagogy-r8-render-* 로그가 상세 근거지만
영구 보존을 가정하지 않는다.

serve.py의 regression-test.html 필수 회귀는 **175/175 통과**, 정규화 왕복과 잘못된 JSON root
12건 거절도 exit0이다. R7 backend·App Check·이관, 실계정 ACK·실제 Safari/iPad·인간 관찰·
main Sonar 출시 차단은 이 검사로 닫지 않는다.


## 분리 Firebase staging 접근 복구

[진단 원본의 안전 필드](staging-access-recovery.json). 추가 계정 인증 callback 완료, CLI 계정2개·
기본 계정 유지. 명시 선택한 추가 계정으로 과거 staging project/web config GET200과 ID/번호를
확인했다. 원시 계정 객체·토큰·OAuth URL/state는 보존하지 않는다. getProject management의
API-enable 부수효과를 피하고 직접 REST GET만 사용했다.

Firestore403의 ErrorInfo는 SERVICE_DISABLED다. Storage bucket 목록은 비어 있으며 Google provider
설정은404다. App Check Enterprise 설정 존재는 정상 토큰 발급/허용 도메인·enforce 증거가 아니다.
billingEnabled=false·Auth App Check UNENFORCED다. API 활성화·자원/Rules 배포·IAM·결제·유료 AI·
production 변경은 없다. 다음은 기존 staging의 backend 자원/Auth·origin/App Check 준비이며,
접근 복구를 staging 전체 준비나 R7/R8 운영 완료로 확대하지 않는다.
