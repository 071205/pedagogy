고정된 파일만 읽어 두 이견을 대조했습니다(실행은 하지 않았고, 파일은 그대로입니다).

## 합의
**두 항목 모두 주장과 일치합니다. 새 재현 결함 없음 → 최종 합의입니다.**

**1. 인쇄 RED 2개 (및 나머지 4개)**
- `r8-render-red-summary.json`은 image/font/stale/count/print-order/print-layout 6건이고, 각 `raw`가 `r8-render-red/*.json`을 가리킵니다.
- `print-order.json`: `error`가 `"print-order: print must retain all 300 questions in order ... - 'r8-q300'"`, `cleanup:["fulfilled","fulfilled"]`, `serverStopped:true`, `complete:false`, `results:[]`.
- `print-layout.json`: `error`가 `"print-layout: 300-question print/sheet layout must agree"`, 동일한 cleanup/serverStopped.
- 요약의 문자열이 raw와 글자 단위로 같고, 나머지 4건도 접두사(`image:`/`font:`/`stale:`/`count:`)와 cleanup/serverStopped가 같습니다. `r8-render-verification.json`의 `redCases` 6건(`exit:1`, `targetPrefix`)과도 일치합니다.
- 두 RED는 probe가 아니라 제품 소스의 `window.print();` 지점을 변형(q300 제거 / `scale(0.5)`)하고, 목표 단언(`r8-render-recovery.mjs:177`, `:178`)에서 걸립니다. `printCalls===1` 단언(`:176`)이 그 앞에 있어 "경계 미도달"로 위장되지도 않습니다.

**2. D1/D2 해소 판정 유지**
- D1: `r8-render-recovery.mjs:131-135`에서 `window.r8Blocked` 증가 후 **`assert(...>0)`가 `:136`의 `state.releases.splice(0).forEach(release=>release())`보다 앞**에 있습니다. 게이트 자체도 `:126`에서 `requests>before && releases.length>0`로 단언합니다. resolver는 `state.releases` 배열이고 `recovery`의 `finally`(`:146`)에서도 비웁니다.
- D2: CSP는 변형된 HTML의 인라인 스크립트 해시를 재계산하고 `:44` 목록 존재·`:45` 개수 일치를 단언한 뒤 위치별로 치환합니다(해시 목록은 순서 무관).
- `r8-render-normal.json`: `red:""`, `complete:true`, 3화면×4과제 **12건**, 파리티 `sheetMs 184/179/179`·`printMs 313/339/323`, 모두 `printCalls:1`·`same:true`·`sheetIds/printIds 300`·`pages:150`·`fontProblems:[]`, stale은 3화면 모두 `bad:0/swaps:1`.
- `stale.json`은 같은 최종 코드에서 `bad:1/swaps:2`로 목표 단언에 걸려 exit1 — 민감도가 살아 있습니다.
- README 마지막 R8 절(`README.md:46-94`)은 12건/exit0, RED별 접두사+cleanup/serverStopped 확인 요구, `window.print` 경계에서 `measuring`을 잠깐 재부여해 캡처한다는 문장(`:78`), 각 1회 기록이며 p95·실기기 아님, 시스템 인쇄/PDF·Safari/iPad·실계정은 미포함을 명시합니다. 과대 주장 없음.

## 남은 미합의
없습니다. 단, 합의된 **범위 한계**(이견 아님): 인쇄 파리티는 probe가 부여한 `measuring` 상태의 DOM 대조이므로 실제 `@media print`·시스템 인쇄·PDF 출력의 증거가 아니고, 성능 수치는 1회 로컬 기록입니다. 또 `stale` 차단은 debounce 상수 `220`에 결합돼 있어 제품이 바뀌면 조용히 통과하지 않고 `:135`에서 큰 소리로 실패합니다.

## 근거
`r8-render-red-summary.json`, `r8-render-red/{print-order,print-layout,stale,count,font}.json`, `r8-render-normal.json`, `r8-render-verification.json`, `r8-render-recovery.mjs` 전체, `README.md:46-94`. 테스트 재실행·모델 재호출·광역 지침 재탐색은 하지 않았습니다.

## 다음 행동
추가 수정 제안 없습니다. 직전 후속 검토의 "인쇄 RED 2개 미실행" 판정은 요약 갱신 이전 상태를 읽은 것이므로, 해당 지적을 해소됨으로 기록하고 현재 파일 세트를 그대로 커밋/핸드오프하면 됩니다. 남은 미검증(실제 시스템 인쇄, Safari/iPad, 실계정 ACK, main 출시 게이트)은 별 작업으로 유지하세요.
