---
name: hwpx-element
description: HWPX 조판 엔진에 **새 요소**(머리말·각주·쪽나눔 같은 것)를 들일 때 쓴다. 한글이 받아 주는 XML 을 추측하지 않고 알아내는 ①~④ 절차와, 그 과정에서 반드시 밟아야 하는 판정(한글이 여는가 → 실제로 찍히는가)을 이끈다. 트리거 — "HWPX 에 ○○ 넣어줘", "각주/머리말/표/상자 조판", "한글에서 안 나온다", "이 요소 XML 어떻게 쓰지", 또는 document_schema·pedagogy_hwpx·hwpx-engine 에 새 블록·기능을 더하는 모든 작업.
---

# 새 HWPX 요소 들이기

⚠️ **추측으로 XML 을 짓지 않는다.** 규격서(KS X 6101)는 *무엇이 무엇을 뜻하는가* 만 알려 주고
**한글이 받아 주는가**는 답하지 않는다. 문법이 완벽해도 한글은 거부하거나 — 더 나쁘게 —
**조용히 빈 것으로 조판하고 이유를 말하지 않는다.**

근거와 이미 알아낸 요소는 [`docs/HWPX-ELEMENT-SPECS.md`](../../../docs/HWPX-ELEMENT-SPECS.md) 에 있다.
**그 문서를 먼저 읽는다.** 아래는 새 요소를 알아내는 절차다.

## ① 그 요소가 든 `.hwpx` 를 손에 넣는다

한글 UI 로 직접 만들거나, 근거 생성기를 쓴다. **우리 골격에서 출발하면 참조 번호가 그대로
쓸 수 있는 근거가 된다.**

```bash
python3 -m venv /tmp/probe-venv && /tmp/probe-venv/bin/pip install -q python-hwpx
/tmp/probe-venv/bin/python - <<'PY'
from hwpx.document import HwpxDocument
d = HwpxDocument.open("experiments/hwp-export/templates/blank.hwpx")
d.add_paragraph("본문")
# ← 알아내려는 요소를 여기서 넣는다
d.save_to_path("/tmp/probe.hwpx")
PY
```

⚠️ **외부 라이브러리는 근거 생성기다 — 코드를 가져오는 곳이 아니다.** 파이썬 55,000줄은
브라우저로 갈 수 없고, 옮겨 오면 파이썬↔JS 대조가 영구히 죽는다.
⚠️ **생성기가 두 자리에 모두 쓰는 경우가 있다.** 머리말이 그랬다 — `secPr` 안 사본과 본문
`ctrl` 양쪽. 어느 쪽이 일하는지는 ③이 아니라 **④가 가른다**.

## ② 한글이 받아 주는지 본다 — 받지 않으면 근거가 아니다

```bash
npm run test:hwpx-opens -- /tmp/probe.hwpx
```

⚠️ **한글이 자고 있으면 첫 판정이 거짓 실패로 나온다.** 한 건만 ❌ 이고 뒤 파일은 ✅ 라면
파일이 아니라 콜드 스타트를 의심하고 다시 돌린다.
⚠️ **창 개수로 판정하지 않는다** — 오류 대화상자도 창이다. 검사가 대화상자 글을 읽는다.

## ③ XML 을 근거로 삼는다 — 차집합이면 금방 찾힌다

```bash
python3 -c "
import zipfile,re
els=lambda p:set(re.findall(r'<(h[pc]:[a-zA-Z]+)', zipfile.ZipFile(p).read('Contents/section0.xml').decode()))
print(sorted(els('/tmp/probe.hwpx') - els('experiments/hwp-export/templates/blank.hwpx')))"
```

**어디에 매달렸는지**까지 본다 — 요소 이름만으로는 부족하다. `lxml` 로 부모 경로를 찍어
실물(`templates/exam-math.hwpx`, 한글이 제 손으로 저장한 파일)과 **같은 자리**인지 견준다.

⚠️ **크기·좌표를 고정값으로 베끼지 말 것.** 표본의 숫자는 대개 **계산된 값**이다 —
머리말 상자의 `42520`·`4252` 는 '쪽 폭 − 좌우 여백' 과 '머리말 여백' 이었다. 골격에서 재어 쓴다.

## ④ 우리 엔진으로 같은 것을 낸 뒤 **PDF 를 뽑아 눈으로 본다**

```bash
npm run test:hwpx-opens -- 결과.hwpx        # 열리는가
node scripts/hwp-to-pdf.mjs 결과.hwpx        # 찍히는가 ← 이 단계를 건너뛰지 말 것
```

⚠️ **여는 것과 찍히는 것은 다른 문제다.** 이 단계에서만 드러난 결함이 둘 있다 —
조합 기호 `₆C₂` 가 **열리는데 발문이 빈칸**으로 인쇄되던 것, 머리말을 `secPr` 에 넣으면
**열리는데 아무것도 안 찍히던** 것. 둘 다 검사는 전부 초록불이었다.
⚠️ PDF **텍스트 추출**로는 수식이 빈칸으로 보인다(수식 글꼴에 ToUnicode 가 없다). **그림으로 본다.**
여러 쪽에 걸리는 요소면 **모든 쪽**을 본다(머리말은 되풀이되는 것이 핵심이었다).

## 구현 — 고쳐야 하는 자리

⚠️ **한 곳만 고치면 사용자에게 도달하지 못한다.** 블록 하나는 **다섯 경계**다.

| | 파이썬 | 자바스크립트(사본) |
|---|---|---|
| 엔진 원시 기능 | `pedagogy_hwpx.py` | `hwpx-engine.js` |
| 블록 → 문단 | `document_to_hwpx.py` | `hwpx-document.js` |
| 계약 | `document_schema.py` | `document-editor.html` 의 `validate()` |
| **미리보기** | — | `document-editor.html` 의 **`render()`** |
| AI 경계 | — | `worker/index.js` 프롬프트 + `validateDocumentResponse` |

⚠️ `validate()` 와 `render()` 를 한 칸으로 세지 말 것 — 통과하는 것과 그려지는 것은 다른
경계다(`REV-2026-095` 에서 미리보기가 아무것도 표시하지 못했다).
⚠️ **블록이 아닌 것도 있다.** 머리말·꼬리말은 구역 전체에 걸리므로 `blocks` 가 아니라
최상위 값이다. 흐름에 끼는 것인지 문서에 걸리는 것인지 먼저 가른다.

## 마무리 — 이것까지가 한 벌이다

```bash
npm run test:hwpx-browser       # 파이썬↔JS 대조 (표본에 새 것을 더한다)
HWPX_PYTHON=<lxml 있는 파이썬> npm run test:hwpx
npm run check:static            # 다섯 경계 대조
```

- **파리티 표본에 새 요소를 더한다.** 안 더하면 사본이 갈라져도 초록불이다.
- **신호를 함께 본다** — 개수만 세지 말고 자리·크기·`charPrIDRef` 까지. 각주가 미주
  스타일로 나가던 것(`REV-2026-094`)과 머리말이 제목 크기로 나가던 것(`REV-2026-096`)을
  둘 다 놓쳤던 이유가 신호 부족이었다.
- **깨보기**: 새로 넣은 신호를 일부러 틀리게 만들어 빨간불이 나는지 본다.
- 근거를 [`docs/HWPX-ELEMENT-SPECS.md`](../../../docs/HWPX-ELEMENT-SPECS.md) 로 옮기고,
  인계와 이슈는 [`reviews/README.md`](../../../reviews/README.md) 양식을 따른다.
