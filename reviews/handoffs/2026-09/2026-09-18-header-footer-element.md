# 변경 인계 — 머리말·꼬리말을 조판하고, 그 과정에서 미리보기 결함 둘을 잡았다

- ID: `HANDOFF-2026-144`
- 날짜: `2026-09-18`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `client`, `server`, `tests`, `docs`
- 관련 이슈: `REV-2026-095`(P1) · `REV-2026-096`(P2)

## 변경 내용

`docs/HWPX-ELEMENT-SPECS.md` 의 ①~④ 절차대로 **머리말·꼬리말**을 구현했다. 남은 미구현
요소 셋 중 첫째다.

1. **엔진** — `set_header()`/`set_footer()`(파이썬) · `setHeader()`/`setFooter()`(JS).
   본문 첫 문단에서 `secPr` 를 안고 있는 run 에 `<hp:ctrl>` 로 매단다. 같은 갈래가 있으면
   갈아 끼운다(구역당 하나).
2. **계약** — 블록이 아니라 **문서 수준 값**이다. 최상위 `header`·`footer`(각 120자).
   글의 흐름에 끼는 것이 아니라 구역 전체에 걸리기 때문이고, 한글도 그렇게 모델링한다.
3. **경계 다섯 곳** — 계약(`document_schema.py`) · 두 조판기 · 브라우저 `validate()` ·
   브라우저 `render()` · Worker(프롬프트 + `validateDocumentResponse`).
4. **검사** — 파리티에 `page-notes` 표본을 더하고, `signals()` 가 머리말 상자를
   **자리·크기·글자 모양까지** 뽑는다.
5. **`scripts/hwp-to-pdf.mjs`** — 절차 ④('눈으로 본다')를 손으로 하던 것을 스크립트로 만들었다.

## 알아낸 것 — **여는 것만 보고 근거로 삼았으면 틀렸다**

표본 생성기(`python-hwpx`)는 머리말을 **두 자리에 모두** 쓴다 — `secPr` 안의 사본 +
`<hp:headerApply>`, 그리고 본문 `run/ctrl`. 어느 쪽이 일하는지 가르려고 변종 둘을 만들어
각각 한글로 열고 PDF 로 뽑았다:

| 변종 | 한글이 여는가 | 실제로 찍히는가 |
|---|---|---|
| 본문 `run/ctrl` 만 | ✅ | ✅ 머리말·꼬리말 둘 다 |
| `secPr` 사본 + `headerApply` 만 | ✅ | ❌ **아무것도 안 나온다** |

한글이 제 손으로 저장한 시험지 틀도 본문 `run/ctrl` 형태다. 지식은
[`docs/HWPX-ELEMENT-SPECS.md`](../../../docs/HWPX-ELEMENT-SPECS.md) 로 옮겼다(XML·함정 포함).

## 그 과정에서 찾은 결함 둘 — **둘 다 기존 코드의 것이다**

- **`REV-2026-095`(P1)** — `pagebreak`·`footnote` 가 든 문서에서 **미리보기가 통째로 죽었다**
  (`b.items is not iterable`). `69525df`(어제 각주·쪽나눔 도입)가 다섯 경계 중 `render()`
  하나를 빠뜨린 것이다. ⚠️ **검사는 초록불이었다** — `check-document-blocks.mjs` 가
  브라우저 쪽에서 `validate()` 만 읽고 `render()` 는 안 봤다. 이제 다섯 번째 경계로 본다.
- **`REV-2026-096`(P2)** — 문단 모양 바꾸기가 **머리말·각주 속 run 까지** 덮어썼다.
  머리말이 제목 모양(19pt)으로 인쇄됐다. 이제 **직계 run 만** 건드린다.

## 위험과 검토 요청

⚠️ **`set_paragraph_style()` 의 범위를 좁혔다.** 이것이 제일 위험하다 — 기존 호출자가
'깊이 훑기' 에 기대고 있었다면 조용히 모양이 달라진다. 확인한 것: `test:hwpx`(12건) ·
`test:hwpx-exam`(시험지 한 부 포함) · `test:hwpx-browser`(문서 셋) 전부 통과이고, 시험지
경로의 문단 대조가 **바이트까지** 같다. 그래도 **특히 봐 주었으면 하는 것**이 이 부분이다.

⚠️ **머리말 글자 모양은 '정한 값' 이지 잰 값이 아니다.** 실물에서 잰 '머리말 전용 모양' 은
없어서 **그 문서의 본문 모양**을 따르게 했다. 근거가 생기면 다시 잴 것.

⚠️ **미리보기의 쪽나눔·각주 모양도 정한 값이다.** 종이와 같지 않다 — 화면에서 구조를
알아보게 하는 것이 목적이다.

## 검증

- 실행한 명령:
  - `npm run test:hwpx-browser`(표본 3 + 고장 주입 5) · `npm run test:hwpx-exam` ·
    `npm run test:hwpx`(12건) · `npm run check:static` · `npm run test:review-contracts` ·
    `npm run test:worker`
  - `npm run test:hwpx-opens` — 표본·변종·양쪽 조판기 결과물
  - `node scripts/hwp-to-pdf.mjs` + **PDF 눈검사**
- 결과: 전부 통과. PDF 에서 확인한 것 — 머리말이 쪽 위, 꼬리말이 쪽 아래,
  **세 쪽짜리 문서의 세 쪽 모두**에 되풀이, 머리말이 본문 크기(제목만 크게), 각주 번호·
  구분선 정상.
- **깨보기 셋**(전부 실제로 빨간불을 확인했다):
  - 미리보기에서 `pagebreak` 가지 제거 → `check-document-blocks` ❌
  - JS 상자 크기를 골격에서 재지 않고 박음 → `test:hwpx-browser` `pageNotes` ❌
  - JS 를 예전처럼 깊이 훑게 되돌림 → `test:hwpx-browser` `charRefs`·`pageNotes` ❌
- 아직 실행하지 못한 검증: 없음(`check:fast` 전체는 길어 관련 묶음만 돌렸다).

## 다음 검토자에게

diff 범위: `experiments/hwp-export/{pedagogy_hwpx,document_schema,document_to_hwpx}.py` ·
`hwpx-engine.js` · `hwpx-document.js` · `document-editor.html` · `worker/index.js` ·
`scripts/{check-document-blocks,check-hwpx-browser,hwp-to-pdf}.mjs` ·
`docs/HWPX-ELEMENT-SPECS.md` · `CLAUDE.md`.

⚠️ **이 작업 폴더에는 B 갈래(Codex) 변경이 함께 있다.** `git add -A` 를 쓰지 말 것.

**다음 할 일**: 남은 미구현 요소는 **상자 안의 표·그림**(계약이 재귀 구조가 되어야 한다)과
**지문(passage)**(일반 문서 계약에 넣을지부터 결정이 필요하다)이다.

## 검토 기록
