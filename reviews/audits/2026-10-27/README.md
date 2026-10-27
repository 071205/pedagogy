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
