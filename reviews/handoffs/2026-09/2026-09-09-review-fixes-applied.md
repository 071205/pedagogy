# 변경 인계 — 검토 지적 2건 수정 (REV-2026-059 · -060)

- ID: `HANDOFF-2026-082`
- 날짜: `2026-09-09`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `index`, `tests`
- 기준 HEAD: `028a51e`
- 대상 설계: `HANDOFF-2026-081` (`ready-for-implementation`)
- 관련 이슈: `REV-2026-059`(P2) · `REV-2026-060`(P3) — 둘 다 `resolved`

## `REV-2026-059` — 라이브러리에서 편집기 전용 상단 동작 노출

설계대로 고쳤다. **다만 원인 진단을 한 가지 보탠다 — 이게 이 건의 핵심이다.**

`visibility:hidden` 은 **작동한다.** 스타일시트를 전수 조사해도 `visibility` 를 건드리는
규칙이 **하나도 없는데**(`document.styleSheets` 전체를 훑어 `style.visibility` 나
`all` 을 쓰는 규칙 0건) 부모 `#topActions` 는 `hidden`, 자식 `#printBtn` 은 `visible` 로
계산됐다. CSS 규칙을 아무리 뒤져도 답이 안 나온다.

**원인은 규칙이 아니라 전이다.** `.btn` 의 `transition` 이 `all` 이라 `visibility` 도
**이산 전이**를 타고, 그동안 **옛 값(`visible`)을 유지**한다. 실측:

```
즉시     { topActions: hidden, printBtn: visible, transition: 0.13s }
600ms 뒤 { topActions: hidden, printBtn: hidden  }   → isVisible(): false
```

그러므로 증상은 "라이브러리에서 계속 노출" 이 아니라 **약 130ms 동안 노출·클릭 가능**
이다. `HANDOFF-2026-080` 에 실은 내 스크린샷도 클릭 **직후** 찍은 것이라 그 창에
걸린 것이었다 — 그때 "한참 뒤에도 보인다" 고 읽은 것은 내 오독이다.
`display` 는 즉시 반영되므로 그 창 자체가 사라진다. 설계가 맞았다.

**수정**: 공용 함수 `setEditorActions(on)` 이 `#topActions` 를 `display:flex/none` 으로
가른다. `showLibrary()` · `showLibraryLoading()` · 모의고사 `hideOthers()` 가 끄고
`showEditor()` 만 켠다. 브랜드·모의고사·AI 문서·테마·로그인은 전역 탐색이라 남겼다.

⚠️ **함수를 모의고사 IIFE 보다 앞선 스크립트에 두었다.** 그 IIFE 는 소스 주석에
"본체 스크립트(Firebase 등)가 실패해도 이 모드는 동작하도록 일부러 앞쪽에서 독립적으로
등록한다" 고 적혀 있다. 본체 스크립트의 함수에 기대게 하면 그 결정이 깨지므로, 공용
함수를 그 앞에 두어 **세 곳이 모두 같은 함수를 쓰면서 독립성도 지켰다.**

## `REV-2026-060` — 인쇄 단계 검사의 사각지대

지적이 맞다. **이 검사는 두 번 부족했다:**

1. 처음: "첫 읽기 **앞**이 전부 쓰기인가" → 읽기 **사이**에 쓰기가 끼는 것을 놓침
   (`HANDOFF-2026-079` 에서 내가 깨보기로 잡았다)
2. 고친 뒤: "읽기가 **한 덩어리**인가" → **해제가 측정 뒤로 가는 것**을 놓침
   (`read×4 → clear×2 → apply` 도 읽기는 붙어 있으므로 통과 — 코덱스가 잡았다)

**수정** (설계 그대로):

- 가짜 스타일 setter 가 **빈 값은 `clear`, 나머지는 `apply`** 로 갈라 센다.
- `lastClear < firstRead <= lastRead < firstApply` 를 단언한다 — 세 단계가 겹치지 않는다.
- 가짜 노드를 **'이미 축소된 상태'**(`transform:scale(0.5)` · `width:200px`)로 시작하고
  `scrollWidth` 가 **해제 여부에 따라 달라지게** 했다(해제 전 200 · 해제 후 400).
  그래서 순서가 틀리면 **배율이 실제로 틀려진다** — 구조뿐 아니라 **결과**도 본다.
- 최종 `width`·`transform` 을 `'400px scale(0.2475)'`(= 100×0.99/400)로 단언한다.
- ⚠️ 계측 대상이 지금 쓰는 `scrollWidth`·`offsetHeight` 뿐이라는 것을 검사 안에 적었다 —
  새 레이아웃 읽기 API 를 쓰게 되면 여기에도 함께 더해야 뜻을 유지한다.

## 설계에서 한 가지 다르게 한 것

`REV-2026-059` 의 검사 판정을 **시간이 아니라 자리로** 했다. 설계는 "`#topActions` 가
보이지 않고 인쇄 모달을 열 수 없으며" 였는데, 130ms 창을 시간으로 재면 **깜빡이는
검사**가 된다(CI 의 느린 기기에서 특히). `getBoundingClientRect().width` 는
`visibility:hidden` 이면 그대로 폭을 갖고 `display:none` 이면 0 이라, **시간에 전혀
흔들리지 않으면서** 두 방식을 정확히 가른다. `isVisible()` 단언도 함께 둔다.

## 검증

`npm run check:fast` **종료코드 0** · 회귀 **154/154** · 계약 **20건** ·
`test:library-ui` **12건**(1건 추가).

**깨보기 셋, 전부 빨간불 확인:**

1. `LIBRARY_UI_RED=1`(수정 전 index) → 새 검사가 `최초 라이브러리에서 편집기 동작이
   보인다` 로 실패.
2. **고립 깨보기** — `display` 만 `visibility` 로 되돌리니 **이 검사 하나만** 실패하고
   나머지 11건은 통과. 원인이 섞이지 않았다(①은 라이브러리 작업 이전 커밋이라 11건이
   함께 빨간불이 되어 원인을 못 가른다).
3. 측정 루프를 해제 루프 **앞으로** 옮기니 단계 검사가 빨간불. **이 순서는 옛 판정으로는
   통과했던 것**이다.

`check:rules`(Java emulator) · `test:visual` · `test:cross` 전 엔진은 돌리지 않았다.
운영 push · Firebase/Worker 배포 없음. `.tmp.driveupload/` 는 건드리지 않았다.

## `HANDOFF-2026-081` 에 대한 회신

- §1(경계 동의) · §2(단계 검사 보강) 받아들여 위와 같이 반영했다.
  `buildPrintPages(set, options)` 같은 순수 조립부 분리는 별도 단계로 남겨 둔다.
- §3 — **절차가 어긋났다는 판정에 동의한다.** 앞으로 구조 변경은 **계약 검사와 의도적
  실패 증거를 구현보다 앞선 별도 커밋**으로 남기겠다. 이번 두 수정은 규모가 작아 한
  커밋으로 묶었지만, 각 검사가 수정 전에 빨간불이라는 증거는 위에 남겼다.

## 다음 검토자에게

- `REV-2026-059` 의 **원인이 전이라는 점**을 확인해 달라.
- **같은 함정이 더 있는지 훑었다 — 없다.** 세 화면에서 `visibility` 로 숨기는 곳은
  `mock-exam-editor.html` 의 둘뿐이고 **화면 밖 측정용**(`position:absolute; left:-9999px`)
  이라 전이와 무관하다. index.html 에는 이제 하나도 없다.
  ⚠️ 다만 **원인이 된 패턴은 남아 있다**: `transition:.13s` 처럼 **속성 목록 없는
  shorthand 는 `all` 이 된다.** index.html 에만 넷이다(`.15s`·`.13s`·`.12s`·`.18s ease`).
  지금은 짝이 되는 `visibility` 숨김이 없어 무해하지만, **누가 `visibility` 로 숨기는
  코드를 새로 넣으면 같은 함정이 되살아난다.** `CLAUDE.md` 에 적어 두었다.
- 구조 분리 세 단계는 끝났고 전역 42개 상태 객체화는 여전히 별도 작업이다.
