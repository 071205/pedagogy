# 변경 인계 — 구조 3단계: 인쇄 배치 엔진 분리

- ID: `HANDOFF-2026-079`
- 날짜: `2026-09-09`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `index`, `server`, `tests`, `docs`
- 기준 HEAD: `48890c4`
- 설계: [`docs/STRUCTURE-DESIGN.md`](../../../docs/STRUCTURE-DESIGN.md) 3단계
- 관련 인계: `HANDOFF-2026-076`(검토 기준) · `-077`(2단계)

## 무엇을 했나

문항이 **지면에서 어떻게 놓이는가** 를 [`pedagogy-print.js`](../../../pedagogy-print.js)
(252줄)로 옮겼다 — 묶음 경계 · 번호 · 넘치는 수식 축소 · 인쇄본 그림 대기.
미리보기와 인쇄가 **함께** 쓰는 부분이다. `index.html` **6,546 → 6,353줄**
(`git diff` 16 추가 · 209 삭제). **동작은 바꾸지 않았다.**

옮긴 12개: `spanOf` `setPair` `problemGroups` `groupAt` `pairEveryN` `hasPassage`
`groupSpanOf` `computeNums` `shrinkWideMathAll` `shrinkWideMath` `fitMathIn`
`awaitPrintImages`.

## ⚠️ 설계와 다르게 한 것 — 여기가 검토 요청의 핵심

설계 3단계 목록에는 `buildPrintDoc` 과 `fitPrintDoc` 도 있었는데 **옮기지 않았다.**
옮기기 전에 의존을 실제로 재 보니 순수하지 않다:

| 함수 | 실제 의존 |
|---|---|
| `buildPrintDoc` | `activeSet()` 을 읽고 **`#headerInput` 값으로 세트를 고친다**(`s.header=…`) · `$("#printDoc")` 에 쓴다 · `toast()` · `renderMathInElement` |
| `fitPrintDoc` | `$("#printDoc")` 을 직접 잡는다 · 넘침을 `toast()` 로 알린다 |
| `doPrint` | 진행 표시 · 재진입 방지(`printing`) 같은 앱 상태 |

옮기려면 의존을 다섯 개 주입해야 하고, 그건 '옮기기' 가 아니라 **'옮기기 + 고치기'** 다.
`reportNormDropped`(toast 하나 때문에 본체에 남긴 것)와 같은 판단이며,
`HANDOFF-2026-076` §2 가 정한 기준 — **"모듈은 경계에 필요한 값만 소유한다"** — 과도
맞는다고 봤다. 옮기려면 별도 단계로 해야 한다.

그래서 세 모듈 전부 **Node 에서 그대로 돈다**(브라우저 API 를 쓰는 것은 인자로 받은
노드뿐이다).

## ⚠️ 내가 만든 검사가 헛돌았다 — 깨보기가 잡았다

`shrinkWideMathAll()` 의 **읽기·쓰기 단계 분리**(300문항 인쇄에서 1616ms → 265ms 를 만든
것)를 지키는 검사를 새로 넣었는데, 처음 쓴 판정이 **"첫 읽기 앞이 전부 쓰기인가"** 였다.
일부러 읽기·쓰기를 섞어 스래싱을 되살렸는데도 **초록불**이었다 — 섞인 쓰기가 전부 첫
읽기 **뒤**에 있어서 그 판정을 그냥 통과한다.

진짜 성질은 **읽기가 한 덩어리인가**(`order.slice(firstRead,lastRead+1).every(x=>x==='read')`)
이고, 그렇게 고치니 양방향으로 물었다. **깨보기가 없었으면 검사가 있다고 믿고 넘어갔을
것이다.**

## 함께 고친 곳

- `serve.py` 의 `STATIC` — 빼면 로컬에서 404 로 앱이 죽는다.
- 스크립트 순서 `normalize → render → print → 인라인`. 인쇄 모듈이 정규화의 `str()` 을
  받으므로 순서가 계약이다(모듈 머리말에 적었다).
- `check-static.mjs` 는 **고칠 것이 없었다** — index.html 에서 보는 이름들과 옮긴 12개가
  겹치지 않는 것을 확인했다(1단계에서 `SET_NAME_MAX` 로 겪은 '조용한 통과' 재발 방지).

## `window` 표면

옮기기 전 12개 **전부** 최상위 `function` 선언 = `window` 속성이었다(git 으로 확인).
다리에서 정확히 그 12개만 되돌렸다. `PRINT_IMG_WAIT_MS`·`MIN_PRINT_SCALE` 은 `const`
였으므로 **올리지 않았고**, 검사가 그 둘이 `window` 에 없는 것까지 본다.

## 검증

`npm run check:fast` **종료코드 0** · 회귀 **154/154** · 계약 **20건**.

새 계약 검사 `print split keeps its surface, group boundaries, and staged shrink` —
**구현 전에 넣어** `PedagogyPrint` 부재로 실패하는 것을 먼저 확인했다(2단계 방식).

**깨보기 넷, 전부 빨간불 확인:**

1. 읽기·쓰기 단계를 섞으면 → 빨간불 *(단, 위에 적은 대로 첫 판정으로는 통과했다 —
   판정을 고친 뒤에야 물었다)*
2. `problemGroups` 가 `page` 를 안 보게 하면(옛 목록↔인쇄 갈라짐 재현) → 빨간불
3. 다리의 `Object.assign(window,{…})` 를 지우면 → 빨간불
4. 모듈 파일을 없애면 → 154건 중 **25건만 돌고 실패**(조용히 통과하지 않는다)

**`file://` 부팅**: `--allow-file-access-from-files` **없이** 열어 오류 0 ·
`PedagogyNormalize`/`PedagogyRender`/`PedagogyPrint` 셋 다 로드 · 라이브러리가 그려지는
것을 확인했다.

`check:rules`(Java emulator) · `test:visual` · `test:cross` 전 엔진은 돌리지 않았다.
운영 push · Firebase/Worker 배포 없음. `.tmp.driveupload/` 는 건드리지 않았다.

## 앞선 인계(`-076`)에 대한 회신

- **`REV-2026-052` 는 맞는 지적이다.** VM 에 `URL` 이 없어 `safeUrl()` 의 허용 경로가 한
  번도 실행되지 않았고, 내가 `HANDOFF-2026-075` 에 쓴 "Node 에서 `window` 하나만 주면
  돈다" 도 틀린 설명이었다. 수정이 진짜인지 두 방향으로 깨서 확인했다 — **허용 호스트를
  막아도, `URL` 주입을 다시 빼도** 042 가 빨간불이다.
- **2단계(`-077`)를 독립 검증했다.** 되돌린 17개가 옮기기 전 전부 `function` 선언이었고
  올리지 않은 `HSMALL`·`condLabel`·`circled` 가 전부 `const` 였음을 git 으로 확인했다.
  `sanitize`→`inlineMarks` 순서를 뒤집으니 회귀 2건이 빨간불 — 계약이 살아 있다.
- **`lxml` 이 없어 건너뛴 파이썬 HWPX 대조를 내 환경에서 돌렸다** — 12개 전부 ✅,
  실물 평가원 틀이 필요해 CI 가 늘 ⏭ 하는 `test_structure`·`test_sections`·
  `test_page_layout`·`test_style_roles` 포함. **그 공백은 닫혔다.**
- ⚠️ **한 가지 되묻는다.** `-076` §3 은 "**현재 단계에서 렌더 추출을 시작할 근거는
  없다**" 고 썼는데 바로 다음 커밋이 렌더 추출이다. `ee81250` 이 그 전제("계약 검사를
  먼저 확장한다")를 만족시킨 것으로 읽었지만, 실제로 늘어난 것은 `URL` 단언 하나다.
  조건으로 내건 "동일한 API 와 오류 처리를 유지한다는 계약 검사" 로는 얇아 보인다.
  결과물은 깨끗해서 이슈로 올리지 않았으나, 조건과 실행이 어긋난 것인지 판단을 듣고 싶다.

## 다음 검토자에게

1. **`buildPrintDoc`·`fitPrintDoc` 을 남긴 경계가 옳은가.** 옮기려면 의존 주입이
   필요하고 그건 별도 단계라고 봤다. 다른 판단이면 근거를 달라.
2. **깨보기 1 이 처음에 통과한 것**을 눈여겨봐 달라. 지금 판정이 충분한지 —
   읽기 사이 쓰기는 잡지만, 예컨대 `getComputedStyle` 같은 다른 읽기 API 를 쓰면 내
   Proxy 가 못 본다. 더 나은 판정이 있으면 알려 달라.
3. 구조 분리는 **세 단계 모두 끝났다.** 전역 42개 상태 객체화는 여전히 별도 작업이고,
   `-076` §2 의 판단대로 이번에도 손대지 않았다.
