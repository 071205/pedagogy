# 구조 — `index.html` 을 어디까지, 어떻게 쪼갤 것인가

작성: Claude · 2026-09-09 · **1단계 완료(HANDOFF-2026-075) · 2·3단계 미착수**

여러 외부 검토가 "`index.html` 이 너무 크다" 고 지적했다. 맞는 말이지만 **원인 진단이
대체로 틀렸다** — 그래서 처방도 틀렸다. 재서 확인한 것만 적는다.

근거 등급: `[실측]` 이 저장소에서 직접 잰 값 · `[코드]` 소스에서 확인 · `[통설]` 재현 안 함

---

## 0. 결론 먼저

- 문제는 **길이가 아니라 전역 가변 상태**다. `[실측]`
- **베낀 코드는 거의 없다** — 외부 검토의 주요 근거 하나가 사실이 아니다. `[실측]`
- **함수 200개 중 93개(JS 의 30%)는 전역을 하나도 안 건드린다** — 지금 위험 없이 뺄 수 있다. `[실측]`
- 방법은 이 저장소가 **이미 증명했다** — `document-editor.html` 은 398줄이다. `[코드]`
- **저장·동기화는 건드리지 않는다.** 바로 오늘 P1 9건을 고친 코드다.

---

## 1. 무엇이 사실인가

| 외부 지적 | 실측 | 판정 |
|---|---|---|
| 파일이 너무 크다 | `index.html` 7,012줄 · 383KB (JS 71% · CSS 20% · 마크업 7%) | **사실** |
| 전송이 무겁다 | gzip **123KB** | 과장 |
| 세 화면이 렌더링 로직을 베꼈다 | 겹치는 함수 이름 **각 5개** | **사실 아님** |
| 수정 비용이 한 파일에 몰린다 | 최근 60커밋 중 **27번**이 `index.html` | **사실 · 핵심** |

`[실측]` 겹치는 이름 — `index ∩ mock` = `blankBlockData` `convertBlock` `renderEditor`
`renderPreview` `toast`(뒤 셋은 **같은 이름 다른 앱**이다) · `index ∩ document` =
`authErrorMessage` `inAppBrowserName` `openOutsideHint` `paintTheme` `showInAppNotice`
(이 다섯은 진짜 사본이고 **이미 `check:static` 이 대조한다**).

⚠️ 즉 "공통 도메인 규칙을 세 파일에서 손으로 맞춰야 한다" 는 지적은 **이 저장소에
해당하지 않는다.** `mock-exam-editor.html` 은 일부러 격리한 별개 앱이다(별도 전역·저장·
문서 — 한쪽이 죽어도 다른 쪽이 살아야 한다).

## 2. 진짜 원인 — 전역 가변 상태

```
index.html         전역 let/var 42개   함수 200개
mock-exam-editor    전역 let/var  9개   함수  79개
```
`[실측]` 파일은 3배 긴데 전역은 **5배**다.

⚠️ **오늘 나온 P1 결함 9건 중 다섯이 전역 상태의 '시점' 문제였다** — 계정 전환 레이스
(`REV-032`) · 거짓 저장 완료(`033`) · dirty 유실(`038`) · 이미지 수명(`034`) ·
동시 변환(`035`). 길이를 줄여도 이 갈래는 줄지 않는다. **쪼개기의 목표는 줄 수가 아니라
전역에 닿는 코드의 양을 줄이는 것**이어야 한다.

`[실측]` 관심사별 JS 크기(222KB 중):
```
렌더 57K │ 저장·동기화 33K │ UI 잡동 23K │ 인쇄 20K │ 정규화 12K
인증 10K │ 이미지 8K │ AI 7K │ 되돌리기 3K │ 기타 49K
```

## 3. 얼마나 뺄 수 있나

`[실측]` **함수 200개 중 93개(68KB · JS 의 30%)가 전역을 하나도 참조하지 않는다.**

```
뺄 수 있는 큰 것 : blockHTML(6k) normBlock(5k) buildPrintDoc(4k) fitPrintDoc(3k)
                  awaitPrintImages(2k) normProblem processText normSet tableHTML
얽혀 있는 것     : renderEditor renderLibrary renderQList doPrint openDataModal
                  setActivePane aiGenerateFromImage setTheme
```

## 4. 방법 — 이미 증명된 것을 그대로 쓴다

`[코드]` `document-editor.html` 은 **398줄**이다. `hwpx-engine.js`(685줄) ·
`hwpx-document.js`(320줄) 를 **평범한 `<script src>`** 로 빼 두었기 때문이다.
빌드 단계도 ESM 도 쓰지 않았다.

`[실측]` **외부 고전 스크립트는 `file://` 에서 실행된다** — 헤드리스 크로미움에서
확인했다. "파일을 그대로 열어 쓴다" 는 전제가 깨지지 않는다.

⚠️ `[실측]` **ESM 은 깨끗하게 가르지 못했다.** Playwright 가 기본으로
`--allow-file-access-from-files` 를 넣어 대조가 오염됐고, 그 인자를 빼도 대조군인
`fetch` 가 양쪽 다 막혀 **플래그가 실제로 꺼졌는지 확인할 수 없었다.**
→ **ESM 은 쓰지 않는다.** 기존 결정(`CLAUDE.md`)을 뒤집을 근거를 만들지 못했다.

⚠️ `[실측]` **`fetch()` 는 `file://` 에서 막힌다.** 그러므로 `hwpx-engine.js` 가
`templates/blank.hwpx` 를 fetch 하는 **AI 문서 내보내기는 이미 `file://` 에서 안 된다.**
"파일 그대로 열기" 전제는 **이미 부분적으로 깨져 있다** — 쪼개기가 새로 깨는 것이 아니다.
이 사실은 문서에 적혀 있지 않다(따로 적어야 한다).

## 5. 단계

각 단계는 **독립적으로 되돌릴 수 있어야 하고**, 끝날 때 `npm run check:fast` 가 통과해야
한다. 한 번에 하나만 한다.

### 1단계 — `pedagogy-normalize.js` ✅ **완료** (`HANDOFF-2026-075`)

`index.html` **7,096 → 6,847줄**(`git diff` 36 추가 · 285 삭제), 모듈 327줄.
`check:fast` 종료코드 0 · 회귀 154/154 · 계약 18/18.
실제로 해 보고 알게 된 것 — 다음 단계에서도 그대로 걸린다:

- ⚠️ **`window` 표면이 바뀐다.** 최상위 `function` 은 `window` 속성이지만 `const` 는
  아니다. 옮기면 `window.normSet` 이 사라져 **교차 검사 여덟이 한꺼번에 터졌다**
  (앱은 멀쩡한데 검사가 그것을 부팅 신호로 쓰고 있었다). 옮기기는 관측 표면을 바꾸면
  안 되므로 다리에서 되돌렸다. **옮기기 전에 표면을 먼저 재라:**
  `git show HEAD:index.html | grep '^function 이름('`
- ⚠️ **코덱스가 옳았다 — 순수 함수가 아니다.** `normBlock` 은 `normDropped` 를 바꾸고
  `reportNormDropped` 는 `toast` 를 부른다. 집계는 모듈 내부로, **toast 를 부르는
  함수만 본체에 남겼다.** 그래서 모듈이 Node 에서 그대로 돈다.
- ⚠️ **검사도 함께 옮겨야 한다** — `serve.py` 의 `STATIC`, `check-static.mjs` 의
  `SET_NAME_MAX` 대조 대상. 후자를 안 고치면 상한이 어긋나도 **조용히 통과**한다.

**얻은 것**: `check-audit-safety.mjs` 의 042 검사가 index.html 에서 함수를 문자열로
떼어 내고 `safeUrl`·`BLOCK_TYPES`·`SET_NAME_MAX` 를 가짜로 넣던 것을 **진짜 모듈
로딩**으로 바꿨다(`REV-2026-040` 이 바로 그 방식 때문이었다). 나머지 저장·인증 검사의
문자열 추출은 코덱스 조언대로 **그대로 두었다**.

<details><summary>원래 계획</summary>

### 1단계 — `pedagogy-normalize.js` (~12KB) · 값이 가장 크다

`normSet` `normProblem` `normBlock` `normSubject` `normSheetColor` `normOrder`
`normLibMeta` `sanitize` `safeUrl` `str` `reportNormDropped` `resetNormDropped`

왜 먼저인가:
- **신뢰 경계 전체**다. 가져온 `.json`·AI 응답·클라우드 데이터가 전부 여기를 지난다.
- 순수 함수라 전역이 필요 없다.
- 지금 검사들은 이걸 건드리려고 **브라우저를 띄우고 iframe 에 훅을 심는다**
  (`installHooks`). 빼면 **Node 에서 직접** 부를 수 있어 검사가 빨라지고 정직해진다.
  ⚠️ `check-audit-safety.mjs` 가 소스에서 함수를 **문자열로 떼어 내** vm 에 넣는 방식도
  이때 없앨 수 있다 — `REV-2026-040`(검사가 자기 사본을 본다)이 바로 그 방식 때문이었다.

</details>

### 2단계 — `pedagogy-render.js` (~15KB)

`blockHTML` `processText` `proseHTML` `verseHTML` `splitParagraphs` `splitRanges`
`inlineMarks` `autoDisplayStyle` `tableHTML` `blockExcerpt` `setHasContent`

⚠️ `blockHTML(blk, ctx)` 의 `ctx.subject`·`ctx.range` 계약을 그대로 유지한다 — 미리보기와
인쇄 **두 곳이 모두** 넘겨야 한다는 규칙이 여기 걸려 있다.

### 3단계 — `pedagogy-print.js` (~20KB)

`buildPrintDoc` `fitPrintDoc` `awaitPrintImages` `shrinkWideMath*` `problemGroups`
`groupAt` `pairEveryN` `computeNums`

⚠️ `fitPrintDoc` 의 **읽기·쓰기 분리 순서**를 깨지 말 것(레이아웃 스래싱 — 1616ms → 265ms).
⚠️ `problemGroups()` 는 묶음 경계를 아는 **유일한 곳**이다. 사본을 만들지 말 것.

여기까지면 `index.html` 이 **7,012 → 약 5,200줄**이 된다.

## 6. 하지 않을 것 (이유 포함)

- ⚠️ **저장·동기화(33KB)는 옮기지 않는다.** 전역 42개가 사는 곳이고 **바로 오늘 P1 9건을
  고친 코드**다(`HANDOFF-2026-067`). 지금 옮기면 그 수정들이 다시 위험해진다. 옮길 거면
  전역을 먼저 상태 객체로 모으는 별도 작업이 앞서야 하고, 그건 이 문서의 범위가 아니다.
- ⚠️ **TypeScript 를 넣지 않는다.** 빌드 단계를 들이는 결정이 먼저이고, 그 결정은
  "파일 그대로 열기" 를 **포기한다**는 뜻이다. 지금 그 값의 상당 부분을 `check:static` 과
  회귀 148개가 하고 있다.
- ⚠️ **CSS(64KB)는 마지막이다.** `<link>` 로 빼면 두 화면의 토큰 대조(`check-shared-design`)
  를 다시 짜야 한다. 이득 대비 비용이 나쁘다.
- ⚠️ **`mock-exam-editor.html` 과 합치지 않는다.** 격리가 의도다.

## 7. 옮길 때 반드시 지킬 것

⚠️ ~~**`const`/`let` 은 파일 밖에서 안 보인다.**~~ **이건 틀렸다**(코덱스가 짚었고
1단계에서 실증했다). 같은 문서의 **고전 스크립트끼리는 global lexical environment 를
공유하므로** 다른 파일의 최상위 `const` 도 그냥 보인다. namespace 를 거치는 이유는
접근이 안 돼서가 아니라 **무엇에 기대는지 보이게** 하려는 것이다(`test:review-contracts`
의 `classic scripts share lexical bindings without window properties` 가 이 사실을 지킨다).
⚠️ **진짜 함정은 `window` 표면이다.** 최상위 `function` 선언은 `window` 속성이 되지만
`const` 는 되지 않는다. 옮기면서 `function normSet(){}` 을 `const {normSet}=…` 로 바꾸면
**`window.normSet` 이 사라진다** — 1단계에서 이걸 놓쳐 교차 검사 여덟이 한꺼번에 터졌다
(앱은 멀쩡한데 검사가 그것을 부팅 신호로 쓰고 있었다). **옮기기 전에 표면을 먼저 재고**
(`git show HEAD:index.html | grep '^function 이름('`) 다리에서 `Object.assign(window,{…})`
로 되돌릴 것. 반대로 예전에 `const` 였던 것을 `window` 에 올리는 것도 회귀다.
⚠️ **`serve.py` 의 `STATIC` 목록에 새 파일을 함께 넣는다** — 빼먹으면 로컬에서 404 로 죽는다.
⚠️ **`tests/regression-test.html` 의 `installHooks` 대상도 함께 옮긴다** — 빠진 이름은
'훅 설치 실패' 로 터진다.
⚠️ **CDN 라이브러리가 아니라 자기 출처 파일이므로 CSP 는 이미 허용된다.** SRI 는 자기 출처
파일에 붙이지 않는다(배포마다 해시가 바뀌어 관리 비용만 는다).
⚠️ **한 단계 = 한 커밋.** 옮기면서 동시에 고치지 않는다 — 회귀가 나면 원인을 못 가른다.

## 8. 완료 판단

각 단계마다:
- `npm run check:fast` 전부 통과 (회귀 148개 포함)
- `file://` 로 `index.html` 을 직접 열어 라이브러리가 그려지는지 **눈으로** 확인
- 옮긴 함수 하나를 일부러 깨서 회귀가 빨간불이 되는지 확인 (옮기며 검사가 헛돌게 되는 일이
  실제로 잦다 — `REV-2026-040` 이 그랬다)

## 9. 코덱스에게 묻고 싶은 것

1. **1단계 순서에 동의하는가.** 정규화를 먼저 빼면 `check-audit-safety.mjs` 의 문자열
   추출 방식을 없앨 수 있다고 봤는데, 그 파일을 만든 쪽에서 보기에 맞는가.
2. **전역 42개를 상태 객체로 모으는 작업**을 이 쪼개기보다 **먼저** 해야 한다고 보는가.
   나는 뒤로 미루자는 쪽이다(방금 고친 코드를 다시 흔들기 때문). 다른 판단이면 근거를
   달라.
3. **`fetch` 가 `file://` 에서 막히는 것**을 어디에 적어야 하는가 — `CLAUDE.md` 의
   "파일 그대로 열어 쓴다" 전제가 이미 부분적으로 거짓이다. 그 전제를 고칠지, 아니면
   AI 문서 내보내기만 예외로 적을지 판단이 필요하다.


## 10. 독립 검토 반영 조건

[HANDOFF-2026-073](../reviews/handoffs/2026-09/2026-09-08-library-hwpx-independent-review.md)의
세 질문 답변을 우선한다. 정규화에는 `normDropped`, `uid`, 상수 및 toast 의존성이 있으므로
모든 함수를 순수 함수라고 가정하지 않는다. 전역 상태 객체화는 별도 작업이며, 고전
스크립트 사이의 lexical binding 접근은 가능하다. 실행 방식별 지원 범위는 CLAUDE.md에
추가했다. 이 설계의 줄 수·함수 수는 작성 당시 값이며 현재 수치로 취급하지 않는다.
