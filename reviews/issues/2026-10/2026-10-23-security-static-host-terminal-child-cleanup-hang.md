# 정적 호스트 검사가 이미 signal 종료된 자식의 exit를 다시 기다려 정리하지 못함

- ID: `REV-2026-150`
- 날짜: `2026-10-23`
- 보고자: `Codex 독립 검토 /root/r5_gate_review; 부모 재현 확인`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests | server`
- 관련 인계: `HANDOFF-2026-199`

## 요약과 영향

`check-static-host.mjs`는 자식의 `exitCode === null`을 실행 중으로 판단한다.
signal 종료된 Node ChildProcess는 exitCode=null과 signalCode=SIGTERM을 유지하므로
이미 끝난 자식에 kill을 호출하고, 지나간 exit 이벤트를 기다리며 clean에 도달하지 못한다.
검사/CI 종료가 매달리고 임시 persistence 정리가 누락될 수 있다. ready도 signalCode를
확인하지 않는다. spawn의 비동기 error 및 종료 이벤트 등록 시점도 함께 검증해야 한다.

## 재현 절차

1. 실제 Node child를 실행해 스스로 SIGTERM 종료시키고 exit 이벤트가 지난 것을 확인한다.
2. 실제 smoke 소스를 VM 모듈로 실행하되 startStaticStaging은 종료된 child를 반환하도록,
   HTTP는 offline, net freePort는 loopback 대역으로 제공한다.
3. cleanup 및 kill 호출 횟수와 700ms 안에 module evaluation이 종료되는지 확인한다.

## 기대 결과 / 실제 결과

- 기대: 이미 종료된 child를 다시 기다리지 않고 실패를 보고하며 finally에서 persistence 정리.
- 실제: signalCode=SIGTERM, exitCode=null, killCalls=1, cleanCalls=0, evaluation.finished=false.

## 근거

- `scripts/check-static-host.mjs`: ready와 마지막 child 종료/clean 경계.
- `/private/tmp/r7-independent-2026-10-23/lifecycle-probe.mjs`, `lifecycle-probe.log`.
- 부모도 `node --experimental-vm-modules`로 같은 실제 종료 child probe를 재실행해 재현했다.
- 제품 서버·운영 설정·사용자 자료는 사용하지 않았다.

## 처리 기록

- 2026-10-23 · 독립 Codex 및 부모 재현. 종료/error listener를 적절한 시점에 등록하고,
  terminal 상태와 유한 종료 대기·정리 finally를 보장한 뒤 정상/RED 및 독립 검증이 필요하다.
- 2026-10-23 · 구현자 수정. `scripts/serve-static-staging.mjs`가 spawn 직후
  종료/error 감시를 등록하고 `exitCode`와 `signalCode`의 terminal snapshot을
  이벤트 전후에 확인한다. 비동기 spawn 오류도 완료로 기록한다. stop은 이미 종료된
  child를 다시 kill하지 않고, 실행 중인 자신이 만든 child만 SIGTERM→유한 대기→
  SIGKILL→유한 대기로 종료한다. `scripts/check-static-host.mjs`의 ready와 finally는
  lifecycle을 사용하며 stop 실패에서도 persistence `clean()`을 실행한다.
  실제 SIGTERM 종료 child·비동기 spawn 오류·무응답 합성 child 회귀가 통과했고,
  terminal snapshot을 고의로 제거한 `red-review-terminal.log`는 exit 1,
  `test-rev149-150-final.log`는 복구 후 통과. 실제 local Wrangler
  `test-static-host-review-fixes.log` 통과. 독립 재검증은 별도 대기.

- 2026-10-23 · 독립 후속 및 부모 재현: 기존 terminal/error/유한 stop 경계는 통과했으나
  standalone CLI의 24h wait timeout을 VM에서 25ms로만 단축하면 finally가 clean만 호출해
  실제 살아 있는 소유 child가 남는다(kills=0, cleans=1, childRemainsLive=true).
  `/private/tmp/r7-independent-2026-10-23/cli-timeout-probe.mjs` 및 log. 검사용 child는
  probe의 외부 finally에서 종료했다. CLI finally도 stopStaticStaging을 사용하도록
  같은 이슈의 후속 보완 및 표적 RED가 필요하여 in-progress로 되돌린다.
- 2026-10-23 · 구현자 후속 수정. standalone CLI 대기/신호 경로를
  `runStaticStagingCli()`로 분리해 실제 entry가 호출하도록 하고, `finally`에서
  `stopStaticStaging(lifecycle, clean)`을 사용한다. 새 단위 회귀는 실제 Node
  소유 child의 25ms CLI 대기 timeout에서 수정 전 `clean`만 호출되어
  `red-cli-timeout.log` exit 1, 수정 후 SIGTERM→exit→clean 순서로 통과했다
  (`test-cli-timeout.log`). 독립 probe의 안전한 후속 판정본도
  `cli-timeout-after-probe.log`에서 kills=1, cleans=1,
  childRemainsLive=false를 확인했다. 원본 probe의 이전 실패 기록은 유지한다.
  별도 독립 재검증 최종 판정은 대기한다.

- 2026-10-23 · 비구현자 독립 Codex 최종 재검증 통과. 부모가 코드·원 재현/수정 근거를 대조했고, 새 head CI 확인을 후속으로 남긴다.
