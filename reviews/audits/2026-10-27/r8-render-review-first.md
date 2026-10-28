## 합의

코드를 읽은 범위에서, 아래는 실제로 제품을 거칩니다.

- **글꼴**: 경고는 제품의 `showSheetFontWarn(sheetFontProblems())`(`index.html:9761`)에서만 나옵니다. 전체 grep 결과 호출부는 9761 한 곳뿐이라 `font` RED 앵커(`r8-render-recovery.mjs:30`)는 유일하고 하중을 받습니다. 복구 쪽도 `boot()`가 `p.goto`로 실제 재로드이고, `ctx.route`가 걸린 컨텍스트는 HTTP 캐시가 꺼지므로 재요청이 보장됩니다.
- **이미지**: 실패 판정이 제품의 `collectSheetIssues`(`index.html:9782‑9797`) → `sheetIssues` → `#sheetIssuesBtn`에서 오고, 테스트는 거기에 더해 독립 증거(`complete && !naturalWidth`)를 같이 봅니다(`:90`). 합성 URL은 `pedagogy-normalize.js:33‑47`의 호스트 통째 대조를 통과하므로 우회가 아니라 제품 경로입니다.
- **낡은 렌더 폐기**: 앵커가 무효화 지점(`index.html:9725`)으로 정확합니다. `#sheetStage` childList·비subtree 관찰(`:107‑108`)이 타당한 이유도 확인했습니다 — `decorateSheet`는 배지를 `.pq` **안**에 붙이고(`index.html:9868`) `.page` dataset만 건드려(`:9871`) stage 직계 자식을 늘리지 않으므로 `swaps===1`이 장식 때문에 부풀지 않습니다.
- **기존 검사 대비 개선 2가지**: `settled`가 `'ok'` + `sheetShownKey===sheetKey()`를 요구해(`:45`) `'fail'`도 정착으로 치는 기존(`check-sheet-view.mjs:88`)보다 엄격합니다. 앵커도 `includes` 확인(`check-sheet-view.mjs:40`)이 아니라 **유일성** 단언(`:36`)입니다. CSP 재해시는 `check-sheet-view.mjs:30‑35`를 그대로 옮긴 것이고, 어긋나면 인라인 스크립트가 막혀 조용히 통과가 아니라 부팅 대기 실패로 떨어집니다.
- **격리·정리**: 기본 거부 라우트(`:60`)에 base·jsdelivr·합성 Firebase 경로 1개만 허용, 데이터는 `PM_SETS_V7:guest` 합성뿐. `observeStaticChild`는 리스너 등록 전 종료 경합을 이중으로 막고(`serve-static-staging.mjs:34‑49`), `stop()`이 SIGTERM→SIGKILL로 올라가며(`:60‑69`), 스크립트가 `cleanup` 상태와 `serverStopped`를 JSON에 남깁니다(`:162‑164`).

## 미합의 — 재현 가능한 결함

**D1 (높음) stale RED가 타이밍으로 초록불이 될 수 있음.** `:111‑112`는 내용 변경 직후 즉시 게이트를 엽니다. 제품의 다음 조립 예약은 220ms(`index.html:9728`)입니다. RED는 무효화 줄을 지우므로, **옛 조립이 220ms 안에 끝나야만** 낡은 게시가 일어나 빨간불이 됩니다. 느린/부하 걸린 기계에서 새 조립이 먼저 시작되면 옛 조립은 `renderSheet` 자신의 `++sheetGen`(`index.html:9732`)에 걸려 스스로 폐기되고, `bad===0 && swaps===1`이 성립해 **RED가 통과**합니다. 기존 검사는 이 흔들림을 겪고 220ms를 검사 동안만 5000ms로 늘려 고정했고(`check-sheet-view.mjs:181‑184`, 주석에 "늘리지 않으면 깨보기가 운에 따라 초록불이 됐다"), 5ms 간격 독립 프로브도 둡니다(`check-sheet-view.mjs:190`). 새 검사에는 둘 다 없습니다.

**D2 (높음) 조기 실패 시 소유 서버 유실 + JSON 미기록.** `spawn`은 `:22`, 정리 `finally`는 `:161`인데 그 사이 `:44 const html=htmlForRed()`가 **try 밖**에서 `:36`의 단언을 실행합니다. 앵커가 소스 변화로 어긋나면(그 단언의 존재 이유 그 자체) 예외가 나면서 python 서버는 이미 포트를 잡은 채 남고, `render-recovery.json`은 아예 쓰이지 않습니다. 재현: 앵커 문자열 하나를 소스에서 바꾸고 실행.

**D3 (중간) RED 경계가 4개 주장 중 2개를 덮지 않음.** `count` RED는 게시 **뒤** stage에서 q300을 제거하므로(`:32`) 첫 실패는 `sheetIds`(`:139`)에서 나고, 그 뒤 `printIds`(`:140`)와 `same`(`:141`)에는 도달조차 하지 않습니다. 즉 "인쇄/지면 정합"과 "인쇄 순서"는 단언만 있고 **양성 대조가 없습니다**. `clip`/`shrink` 종류도 RED가 없습니다.

**D4 (중간) 글꼴 실패 모드가 한 갈래뿐.** 라우트가 `/font-kopub@/` 전체를 막아(`:58`) "정의가 아예 없음"만 만듭니다. 제품 주석은 두 모드를 구분하고(`index.html:9798‑9800`), 기존 검사는 파일만 막기(⑨‑b)와 CSS째 막기(⑨‑c)를 모두 돌립니다(`check-sheet-view.mjs:76‑78`). 정의는 있는데 받다 실패하는 모드 — `ready()`/`check()` 분기(`index.html:9809`, `:9818`) — 는 새 검사에서 회귀해도 통과합니다.

**D5 (중간) 인쇄 쪽이 제품 경로의 재구현이고 순서가 다름.** 테스트는 `buildPrintDoc → warmPrintFonts → fonts.ready → awaitPrintImages → measuring → offsetHeight → rAF → fitPrintDoc`(`:132‑135`)인데, 제품 `doPrint`는 `… → rAF → fonts.ready → rAF → awaitPrintImages → measuring → body.offsetHeight → setTimeout 120ms → pd.offsetHeight → fitPrintDoc → warnIfClipped`(`index.html:9501‑9543`)입니다. 그 120ms는 "폰트 적용 전 폭을 재면 축소 배율이 엉뚱해진다"고 명시된 지점입니다(`index.html:9527‑9530`). 빠지면 `same`(`:141`)이 **제품이 실제로 인쇄하지 않는 배치**와의 비교가 되어, 느린 기계에서 인쇄 쪽 축소 배율만 달라지는 거짓 실패가 납니다. 또 `fitPrintDoc()` 반환값을 버려서 잘림 경고 정합은 비교 대상에 없습니다. (`window.print()` 때문에 `doPrint` 직접 호출이 불가한 건 인정합니다 — 순서만 맞추면 됩니다.)

**D6 (낮음~중간) 심는 자료 모양이 정규화 전 모양.** `check-sheet-view.mjs:46‑47`이 "빠진 필드가 있으면 편집기가 처음 열 때 채워 넣어 자료가 실제로 바뀐다(예: `choices.images`)"고 적고 그 모양대로 심습니다. 새 seed(`:63`)는 statement 블록만 써서 지금은 피해 가지만, `swaps===1`(`:114`)과 `settled`의 키 동일성은 정규화가 statement/세트 필드를 건드리는 순간 거짓 실패로 바뀝니다.

**D7 (낮음)** `records.some(...)`(`:107`)은 콜백 배치당 1회만 셉니다. 서로 다른 task의 두 게시는 배치가 갈리므로 현재는 무해하지만, 변수 이름이 뜻하는 "교체 횟수"는 아닙니다(기존 `check-sheet-view.mjs:187`도 동일).

**D8 (낮음) 성능 상한 중복.** `:142`의 20초 단언은 `check-sheet-view.mjs:364`와 같은 값이고, 이제 뷰포트 3개 × 300문항으로 3배 실행되며 다른 실행과 동시에 돕니다. 성능 우위를 주장하지 않는다면 하드 단언보다 INFO 기록이 맞습니다(흔들림만 늘립니다).

**D9 (낮음) 이미지 "교체"는 데이터 층만.** `:93`은 `blocks.at(-1).data.dataUrl`을 바꾸고 `saveSets()`를 부릅니다. 제품의 이미지 교체 UI 경로는 거치지 않으므로, 주장은 "URL이 바뀌면 다시 받아 그린다"까지여야 합니다.

**부수**: `results`는 성공한 케이스만 push되어(`:85,97,115,145`) 실패 시 어느 단계였는지는 `error` 문자열로만 남습니다. `state.release?.()`(`:118`)가 이미 소비된 resolver를 다시 부르는 건 무해합니다.

## 근거 / 확인 범위

- 지정 5개 파일·구간을 읽었고, 판단에 필요한 최소 추가 확인만 했습니다: `showSheetFontWarn`/`decorateSheet`/`scheduleSheet`/`saveSets` 호출부 grep, `decorateSheet`(`index.html:9859‑9872`), `doPrint`(`:9475‑9564`), `fitPrintDoc`/`buildPrintDoc` 기본 인자, `serve.py` 헤더(META 기반 CSP라 `route.fulfill`로 내려도 동등).
- **미완료 구분**: `/private/tmp/pedagogy-r8-render-*/render-recovery.json`은 현재 도구가 작업 디렉터리 밖을 읽지 못해(restricted) **확인하지 못했습니다**. 이번 검토는 전적으로 정적 코드 근거이며, 실행 결과로 D1·D5의 흔들림이 실제로 발현했는지는 **미확인**입니다. 또 그 JSON은 `:165`에서 종료 시점에만 쓰이므로, 진행 중 실행에는 파일이 없거나 이전 실행의 것일 수 있습니다 — `red`/`complete`/`error` 필드로 구분해야 합니다.

## 다음 행동 (소유자가 적용 / 저는 파일을 고치지 않았습니다)

1. **D1 먼저**: stale 블록에서 220ms 예약만 선택적으로 늘리고(`check-sheet-view.mjs:183‑184` 방식) 5ms 프로브를 추가한 뒤, `R8_RENDER_RED=stale`을 **반복 실행**해 항상 빨간불인지 확인. 지금 결과의 stale RED 빨간불은 "타이밍으로 맞았을 수 있음"으로 표기.
2. **D2**: `spawn` 이후 전부를 try로 감싸거나, `htmlForRed()`를 spawn **앞**으로 올림. 둘 중 후자가 1줄입니다.
3. **D3**: `printIds`/`same` 전용 RED 추가(예: 인쇄 쪽만 순서를 뒤집는 변이), 그리고 `count` RED는 게시 전 경로를 건드리도록 변경.
4. **D5**: 인쇄 재현 순서를 `doPrint`와 1:1로 맞추고(`rAF` 2회 + `measuring` 뒤 120ms), `fitPrintDoc()` 반환값도 지면 쪽(`collectSheetIssues`의 `clip`)과 비교.
5. **D4**: `blockFonts:'files'|'css'` 두 모드로 분리.
6. **D8**: `sheetMs` 단언을 기록으로 강등.
7. 위 수정 전까지 이 검사의 주장 범위는 **"글꼴(정의 부재 모드) 복구·이미지 데이터 교체 복구·300문항 지면 순서/개수"** 까지로 한정하고, "인쇄 정합"과 "낡은 렌더 폐기"는 양성 대조가 보강된 뒤에 주장하는 것을 권합니다.
