# 문단 모양 바꾸기가 **머리말·각주 속 글자 모양까지** 덮어쓴다

- ID: `REV-2026-096`
- 날짜: `2026-09-18`
- 보고자: `Claude`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `server`
- 관련 인계: `HANDOFF-2026-144`

## 요약과 영향

`set_paragraph_style()` / `setParagraphStyle()` 이 문단을 **깊이 훑어**(`iter()` ·
`getElementsByTagNameNS`) 그 문단에 매달린 **머리말·꼬리말·각주의 속 문단 run 까지**
`charPrIDRef` 를 덮어썼다. 그것들은 본문이 아니라 **제 스타일을 가진 별도의 글**이다.

실제로 드러난 모습 — 범용 문서 조판기는 골격의 첫 문단에 제목을 이어 쓴다
(`emit_rich(..., into=0)`). 머리말은 바로 그 문단의 `secPr` run 에 매달리므로, **제목을 쓰는
순간 머리말 글자가 제목 모양(19pt)으로 바뀌었다.** 쪽마다 제목만 한 크기의 머리말이 앉는다.

각주도 같은 자리에 있다. 지금은 조판기가 각주를 단 뒤 그 문단을 다시 손대지 않아 **아직
터지지 않았을 뿐**이다.

## 재현 절차

```bash
cd experiments/hwp-export && python3 - <<'PY'
import sys; sys.path.insert(0,'.')
from lxml import etree
from pedagogy_hwpx import HwpxDocument
doc=HwpxDocument.blank(); doc.append_paragraph("본문"); doc.append_footnote("각주 내용")
note=lambda: [r.get('charPrIDRef') for el in doc._section(0).element.iter()
              if etree.QName(el).localname=='footNote' for r in el.iter('{*}run')]
print("전:", note())
doc.set_paragraph_style(doc.paragraph_count()-1, char_pr_id="9")
print("후:", note())
PY
```

머리말 쪽은 `install_styles()` → `set_header()` → `emit_rich(..., into=0)` 순으로 부르고
머리말 속 run 의 `charPrIDRef` 를 보면 된다.

## 기대 결과 / 실제 결과

- 기대: 각주·머리말 속 run 은 제 스타일(각주 `3`, 머리말은 넘긴 값)을 지킨다.
- 실제: `['3','3']` → `['9','9']` 로 바뀌었다. 머리말은 `0` → `7`(제목 19pt).

## 근거

- `pedagogy_hwpx.py` `set_paragraph_style()`: `for run in paragraph.iter(qn("hp","run"))`
  — `iter()` 는 **자손 전부**를 훑는다. `hwpx-engine.js` 의
  `p.getElementsByTagNameNS(NS.hp,"run")` 도 같다.
- 실측(PDF) — 머리말·꼬리말이 본문(11pt)이 아니라 **제목(19pt)** 크기로 인쇄됐다.
- ⚠️ **파리티 검사가 처음에는 이것을 못 잡았다.** 양쪽 사본이 **똑같이** 틀렸기 때문이다.
  `REV-2026-094`(각주가 미주 스타일)와 같은 종류 — 사본 대조는 '둘이 같은가' 만 답하고
  '맞는가' 는 답하지 않는다. **실물 PDF 를 눈으로 본 것이 잡았다.**

## 처리 기록

- `2026-09-18` — `Claude`: 등록과 동시에 수정.
  - **원인**: 문단 스타일 적용이 깊이 훑기라 **하위 문서(머리말·꼬리말·각주)** 까지 닿았다.
  - **수정**: **직계 run 만** 건드린다(파이썬·JS 양쪽). `secPr` 를 안고 있는 run 을
    건너뛰던 기존 보호는 그대로 둔다.
    더해서, 범용 문서 조판기가 머리말·꼬리말에 **그 문서의 본문 글자 모양**을 명시로
    넘긴다 — 골격 기본값으로 두면 문서 글꼴과 따로 노는 줄이 쪽마다 앉는다.
  - **파일**: `experiments/hwp-export/pedagogy_hwpx.py` · `hwpx-engine.js` ·
    `experiments/hwp-export/document_to_hwpx.py` · `hwpx-document.js` ·
    `scripts/check-hwpx-browser.mjs`(`pageNotes` 신호에 `charPrIDRef` 추가).
  - **검증**:
    - 위 재현 절차 재실행 — 각주 `['3','3']` 유지, 머리말 `0` 유지.
    - 한글로 PDF 를 뽑아 **눈으로 확인** — 머리말·꼬리말이 본문 크기로, 제목만 크게.
      세 쪽짜리 문서에서 **세 쪽 모두** 머리말·꼬리말이 되풀이된다.
    - **깨보기**: JS 만 예전처럼 깊이 훑게 되돌리니 `test:hwpx-browser` 가
      `charRefs` 와 `pageNotes` 두 항목에서 빨간불(`"7"` vs `"11"`)을 냈다.
    - `npm run test:hwpx`(12건) · `test:hwpx-exam` · `test:hwpx-browser` ·
      `check:static` 통과.
