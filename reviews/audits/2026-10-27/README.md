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
