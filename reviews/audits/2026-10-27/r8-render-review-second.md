Write 도구가 이 세션에서 비활성화되어 있어 판정을 메시지로만 전달합니다. 파일 수정·재실행·transcript 접근은 없었습니다.

---

# 최종 판정: 조건부 합의

D1/D2는 코드에서 해소됐습니다. 인쇄 양성 대조는 **코드 추가 완료 / 실행 증거 미완결**입니다. README의 RED 포괄 문구 한 줄만 증거 범위를 넘습니다.

## 질문 1 — D1/D2·인쇄 양성 대조

### 합의

**D1 해소.** `index.html:9728`의 `setTimeout(renderSheet, now?0:220)`은 소스 전체에서 220ms 타이머의 유일한 사용처라, `ms===220` noop 치환(`r8-render-recovery.mjs:129`)이 부수 효과 없이 정확히 그 debounce만 막습니다. wrapper(`:117`)가 실제로 붙잡힌 호출의 run id를 기록하고 `r8Finished.includes(r8OldRun)`(`:134`)로 그 종료를 기다린 뒤 `scheduleSheet(true)` → `setTimeout(...,0)`으로 차단을 우회합니다. `r8OldRun` 캡처와 타이머 치환이 같은 동기 evaluate(`:124-131`) 안이라 그 사이 새 세대가 끼어들 수 없습니다. 옛 호출의 비게시는 `index.html:9725`의 `sheetGen++` 무효화 → `live()` 조기 반환(`index.html:9745`)에서 나오고, RED가 그 줄만 제거해 `bad=1/swaps=2`를 기록했습니다. 방어선과 검출의 인과가 연결되고 순서가 결정적입니다.

**D2 해소.** 앵커 유일성 단언과 CSP 해시 재계산이 모듈 top-level(`:39-47`)에서 spawn(`:181`) 전에 끝나고, spawn은 try 안, finally가 browser·lifecycle을 모두 닫으며 정리 실패를 exitCode에 반영합니다(`:195-198`).

**인쇄 경계 실행은 입증됨.** `printCalls:1`이 3개 뷰포트 전부에 기록돼, 제품 `doPrint`가 `groupDiagnostics`/`printing` 재진입 guard(`index.html:9476-9477`)를 지나 `window.print()`(`:9556`)에 정확히 1회 도달했음을 보입니다. 더미 호출이 아닙니다.

### 미합의 — 새로 남은 재현 가능 결함

| | 항목 | 내용 |
|---|---|---|
| R-1 | 중 | **print-order/print-layout RED 미실행.** 코드 경로는 타당해 보이나(`:34-35`가 각각 `:173`·`:174` 단언을 때림) 보존 증거가 없습니다. |
| R-2 | 낮-중 | **220 하드코딩 + 가로채기 성공 미단언.** 제품 debounce가 바뀌면 후속 예약이 차단되지 않고, 자동 렌더가 먼저 끝나면 `scheduleSheet(true)`가 `key===sheetShownKey && !sheetBusy`로 조기 반환해 `bad=0/swaps=1`이 **여전히 초록**입니다. D1이 고친 경합으로 조용히 되돌아갑니다. |
| R-3 | 낮 | **`state.release` 단일 슬롯(`:57`).** gate 중 같은 pathname의 다른 쿼리 이미지가 동시 요청되면 resolver가 덮여 한쪽이 영구 pending → `:134`가 30초 timeout. 지금은 `&case=restored`가 같은 문서 메모리 캐시에서 재사용돼 발생하지 않습니다. fail-loud지만 flake 원인입니다. |
| R-4 | 낮 | **인쇄 캡처 범위 표현 과잉.** override는 `measuring` 재부여 + 강제 reflow까지 하며 제품의 120ms 안정화(`index.html:9535`)는 재현하지 않습니다. "window.print만 가로챈다"보다 한 걸음 더 합니다. |
| R-5 | 낮 | **CSP 해시 개수 미단언(`:41-44`).** 길이가 어긋나면 `hashes[i++]`가 undefined로 삽입됩니다. fail-loud지만 진단이 어렵습니다. |
| R-6 | 정보 | `swaps===1`은 "replaceChildren가 record 1건" + "decorateSheet가 `#sheetStage` 직계 자식을 늘리지 않음"이라는 구현 세부 의존입니다. 현재 증거로는 참입니다. |

## 질문 2 — 증거와 주장 일치

**일치**: 정상 12건(3화면×4과제)·`complete:true`, 177/184/181ms·311/306/305ms, `same:true`, 300/300 ID, 150쪽, `fontProblems:[]`, cleanup/serverStopped, CDN 메모리 재사용과 글꼴 실패 route 우선순위(`:61` > `:62`), 글꼴 **CSS 정의 부재** 한정(`index.html:67` 링크 하나만 차단), 데이터 URL 교체 복구 한정, 무효화 제거 시 bad=1/swaps=2, 성능은 코드에 시간 단언이 없어 INFO만. `r8-render-normal.json`은 스크립트 summary 형태 그대로의 원시 출력입니다. 운영/실계정/실기기/AppCheck/Sonar 완료 주장은 없습니다(README 38·66행, 인계 45-46·71행).

**불일치**: README 53-64행이 6개 명령을 나열한 뒤 "RED는 … 각각 exit1을 내므로"라고 포괄 서술하는데, 보존 증거는 4건(image·font·stale·count)뿐입니다(R-1).

**경미**: `r8-render-red-summary.json`은 원시 출력이 아니라 손으로 추린 digest입니다(`red`→`mode`, `complete`/`results` 생략). "RED 요약" 라벨과 모순되진 않지만 검증 불가능한 전사 단계가 하나 있습니다.

## 근거

읽은 파일: `r8-render-recovery.mjs`(전체 201행), `r8-render-normal.json`, `r8-render-red-summary.json`, `README.md:46-89`, 인계 문서 전체, 대조용 `index.html:9471-9569`·`9700-9784`. 추가 확인: `index.html`에서 `220`은 `:9728` 1곳, `font-kopub`는 `:67` CSS 링크 1곳, `$=s=>document.querySelector(s)`(`:2654`), `observeStaticChild` export(`scripts/serve-static-staging.mjs:33`).

## 다음 행동 (우선순위 순)

1. `R8_RENDER_RED=print-order`·`=print-layout`을 각 1회 실행해 exit1과 `error` 접두사를 요약에 추가하거나, README 63행을 "보존 증거는 4건, print-order/print-layout 미실행"으로 한정.
2. 220ms 가로채기 카운터(`window.r8Blocked`)와 release 직전 `assert(blocked>0)` 추가 (R-2).
3. `state.release`를 resolver 배열로 (R-3).
4. 치환 전에 `assert.equal(hashes.length, CSP 목록 길이)` (R-5).
5. 인쇄 문구를 "`window.print` 가로채기 + 측정용 `measuring` 재부여"로 정정하거나 120ms 안정화 재현 (R-4).

검증은 정상 12건 exit0과 `stale` RED(`bad=1/swaps=2`) 재확인으로 충분하며, 2번 적용 후 stale RED가 여전히 exit1인지 보는 것이 핵심입니다. 1·3·5는 독립이므로 순서 제약이 없습니다.
