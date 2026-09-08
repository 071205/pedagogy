# 변경 인계 — 구조 1단계: 정규화(신뢰 경계)를 별도 파일로

- ID: `HANDOFF-2026-075`
- 날짜: `2026-09-08`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `index`, `server`, `tests`, `docs`
- 기준 HEAD: `e11b1b1` (+ 커밋하지 않은 `HANDOFF-2026-074` 작업 위에 쌓임)
- 설계: [`docs/STRUCTURE-DESIGN.md`](../../../docs/STRUCTURE-DESIGN.md) 1단계
- 승인 조건: `HANDOFF-2026-073` §1·§2·§3

## 무엇을 했나

`index.html` 의 **신뢰 경계 전체**를 [`pedagogy-normalize.js`](../../../pedagogy-normalize.js)
(327줄)로 옮겼다. 가져온 `.json` · AI 응답 · 클라우드 데이터가 전부 지나는 곳이다.

`index.html` **7,096 → 6,847줄** (`git diff` 36 추가 · 285 삭제).
**동작은 하나도 바꾸지 않았다** — 순수한 이동이다.

| 모듈로 | 본체에 남김 |
|---|---|
| `uid` `sanitize` `str` `normOrder` `safeUrl` `normSubject` `normSheetColor` `normBlock` `normProblem` `normSet` `normLibMeta` `resetNormDropped` | `reportNormDropped`(**`toast` 를 부른다**) · `allowedBlockTypes`(`activeSet` 을 본다) · `sheetHex` |
| 의존 상수 `BLOCK_TYPES` `SUBJECTS` `SHEET_COLORS` `LIB_SORTS` `PASSAGE_KINDS` `NOTICE_KINDS` `CHOICE_LAYOUTS` `IMG_SIZES` `SET_NAME_MAX` | — |
| `IMG_HOSTS` · `normDropped` 는 **모듈 내부**(밖에서 안 쓴다). 집계는 `droppedImages()` 로만 | — |

## 코덱스 조건(`HANDOFF-2026-073`)을 어떻게 지켰나

1. **"전부 순수 함수" 는 틀렸다 — 맞다.** `normBlock` 이 `normDropped` 를 바꾸고
   `reportNormDropped` 가 `toast` 를 부르며 `normProblem/normSet/normLibMeta` 가 `uid()` 와
   화이트리스트 상수에 기댄다. 그래서 **상수·ID 발급·진단 집계는 모듈 내부 책임**으로
   정의하고, **UI 를 건드리는 `reportNormDropped` 만 본체에 남겼다.** 그 덕에 모듈이
   Node 에서 `window` 하나만 주면 그대로 돈다.
2. **문자열 추출을 전부 없애지는 않았다.** `check-audit-safety.mjs` 의 **042 검사만**
   진짜 모듈 로딩으로 바꿨다 — 예전에는 index.html 에서 세 함수를 떼어 내고
   `safeUrl`·`BLOCK_TYPES`·`SET_NAME_MAX` 를 **가짜로** 넣었다(`REV-2026-040` 이 바로 그
   방식 때문이었다). 이제 진짜 상수·진짜 `safeUrl` 로 돈다.
   **`loadSets`·`onAuth`·`writeCloudSnapshot` 등 저장·세대 경계 검사는 그대로 두었다.**
3. **전역 42개 객체화는 하지 않았다**(뒤로 미룬다는 합의).
4. **§7 의 틀린 주장을 고쳤다.** "`const`/`let` 은 파일 밖에서 안 보인다" 는 거짓이다 —
   고전 스크립트는 global lexical environment 를 공유한다. namespace 는 접근 문제가
   아니라 **의존성이 보이게** 하는 선택이라고 다시 썼다.

## ⚠️ 실제로 밟은 함정 — 다음 단계에서도 그대로 걸린다

**`window` 표면이 바뀐다.** 최상위 `function` 선언은 `window` 속성이지만 `const` 는
아니다. `function normSet(){}` 을 `const {normSet}=…` 로 바꾸는 순간 **`window.normSet` 이
사라졌고**, 그것을 부팅 신호로 쓰던 **교차 검사 여덟이 한꺼번에 터졌다.**
앱 자체는 멀쩡했다(브라우저 콘솔 오류 0). `tests/regression-test.html` 은 `win.normBlock(…)`
같은 호출이 **80여 곳**이라 검사를 고치는 쪽은 답이 아니었다 — **옮기기는 관측 표면을
바꾸면 안 된다.**

옮기기 전 표면을 git 으로 재어(`git show HEAD:index.html | grep '^function 이름('`)
**정확히 여덟만** 다리에서 되돌렸다. `uid`·`sanitize`·`str`·`normOrder`·상수들은 예전에도
`window` 에 없었으므로 **올리지 않았다** — 표면을 넓히는 것도 회귀다.

## 함께 고친 곳 (한 곳만 고치면 죽는다)

- `serve.py` 의 `STATIC` — 빼면 로컬에서 404 로 앱이 통째로 죽는다.
- `scripts/check-static.mjs` — `SET_NAME_MAX` ↔ `firestore.rules` 대조 대상을 새 파일로.
  **안 고치면 상한이 어긋나도 조용히 통과한다**(index.html 에 그 상수가 더는 없으므로).
- `scripts/check-audit-safety.mjs` 042 — 위 §2.
- `CLAUDE.md`, `docs/STRUCTURE-DESIGN.md`.

`tests/regression-test.html` 의 `installHooks` 는 **고치지 않아도 됐다** — 다리의
`const {…}` 가 global lexical environment 에 남아 주입 스크립트가 그대로 읽는다.

## 새 검사 둘 (`test:review-contracts` 16 → 18)

- `index.html boots from file:// with the split normalization module` —
  **ESM 을 안 쓴 이유가 이것**이므로 검사로 못 박았다. `--allow-file-access-from-files` 를
  **끄고** 띄워 실제 제약을 잰다.
- `moving normalization keeps the exact window surface` — 여덟은 `window` 에 있고,
  `uid`·`sanitize`·`str`·`normOrder`·상수들은 **없어야** 한다.

## 검증

`npm run check:fast` **종료코드 0** · 회귀 **154/154** · 계약 **18/18** · `check:static` 0.

**깨보기 다섯, 전부 빨간불 확인:**

1. 모듈의 `safeUrl` 이 아무 주소나 통과시키면 → 회귀 **5건** 실패.
2. 모듈의 `normBlock` 이 모르는 블록 종류를 통과시키면 → 회귀 **1건** 실패.
3. 모듈 파일을 아예 없애면(= `STATIC` 누락과 같은 상황) → 154건 중 **25건만 돌고 실패**.
   조용히 통과하지 않는다.
4. `file://` 에서 모듈을 못 읽게 하면 → 새 `file://` 검사가 빨간불.
5. 다리의 `Object.assign(window,{…})` 를 지우면 → 새 표면 검사 + `file://` 검사 빨간불.

**`file://` 눈으로 확인**(설계 §8): `--allow-file-access-from-files` **없이** 헤드리스
크로미움으로 `file://…/index.html` 을 열어 오류 0 · `PedagogyNormalize` 로드 ·
라이브러리 카드 2장이 그려지는 것을 스크린샷으로 확인했다.

**중복 없음 확인**: 옮긴 함수 선언이 `index.html` 에 0회, 다리·모듈 표지가 각 1회,
세 인라인 스크립트 블록 모두 `new Function()` 구문 검사 통과.

`npm run check:rules`(Java emulator)와 `test:visual`, `test:cross`(전 엔진)는 돌리지 않았다.
운영 push·배포 없음.

## 다음 검토자에게 (코덱스)

1. **`window` 표면을 되돌린 판단이 맞는가.** 대안은 회귀 80여 곳을
   `win.PedagogyNormalize.normBlock(…)` 으로 고치는 것이었는데, 그러면 "옮기기" 가
   아니라 "옮기기 + 검사 대수술" 이 되어 회귀가 났을 때 원인을 못 가른다고 봤다.
   표면을 좁히려면 **별도 단계**로 하는 것이 맞다고 본다.
2. **모듈 경계가 옳은가.** `sheetHex`(SHEET_COLORS 를 쓰지만 표시용)와
   `allowedBlockTypes`(`activeSet` 을 본다)를 본체에 남겼다. 전자는 모듈로 가도 되는데,
   '값을 고르는 것' 과 '고른 값을 색으로 바꾸는 것' 이 다르다고 보고 남겼다.
3. **2단계(렌더) 전에 볼 것.** `blockHTML` 은 `ctx.subject`·`ctx.range` 계약과
   `sanitize`→`inlineMarks` **순서**가 걸려 있다(순서를 바꾸면 주입이 뚫린다).
   1단계처럼 순수 이동이 될지, 아니면 전역(`activeSet` 등)에 닿아 더 어려운지 판단을
   듣고 싶다.
