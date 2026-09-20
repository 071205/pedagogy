"""수학 시험지 조판 실험 — 2단 + 수식 (베타).

`2025학년도 수능 수학 문제.hwp` 를 해독해 얻은 값으로 조판한다.

    용지    272 × 394 mm (국배판)
    여백    좌19 우19 상15 하25, 꼬리말 9
    단      2단 · 같은 너비 · 단 사이 11.7mm
    수식    HWP 수식 스크립트 522개 사용

수식 문법은 LaTeX 와 개념이 거의 1:1 이다.

    over            분수            \\frac
    sqrt {3} of {5} 세제곱근        \\sqrt[3]{5}
    left ( … right )  크기 맞춤 괄호  \\left( … \\right)
    leq / geq       ≤ / ≥           \\leq / \\geq
    cases{ A # B }  경우 나눔        \\begin{cases}
                    (# 행 구분, && 열 구분)
    sum_{k=1}^{n}   합              \\sum_{k=1}^{n}
    rarrow, inf     → , ∞
    ` 와 ~          공백

여기서는 실물에서 그대로 뽑은 수식을 넣어 **한글이 우리가 쓴 수식을 제대로 조판하는지**를
확인한다. LaTeX → HWP 수식 변환기는 이 확인이 끝난 뒤에 만든다.

    python3 make_math_probe.py [내보낼 폴더]
"""

from __future__ import annotations

import sys
from pathlib import Path

from exam_layout import apply_layout
from pedagogy_hwpx import HwpxDocument

# 실물에서 그대로 뽑은 수식 (손으로 지어내지 않았다)
EQ_ROOT = " sqrt {3} of {5}  times 25^{{1} over {3}}"
EQ_INEQ = "2 f left(1  right)  leq f left(2  right)  leq f left(3  right)"
EQ_CASES = ("f LEFT ( x RIGHT ) = {cases{eqalign{``5x+a#}&&eqalign{~ LEFT ( x<`-2 RIGHT )#}"
            "#``x ^{2} -a&&~ LEFT ( x GEQ `-2 RIGHT )}}")
EQ_SUM = " lim _{n ``rarrow``  inf }  sum_{k=1}^{2 n} a_{k} >{1} over {700}"


def build(out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = HwpxDocument.blank()
    apply_layout(doc)

    doc.append_paragraph("5지선다형")
    doc.append_paragraph("1. 다음 식의 값은? [2점]")
    doc.append_equation(EQ_ROOT)
    doc.append_paragraph("① 3   ② 4   ③ 5   ④ 6   ⑤ 7")
    doc.append_paragraph("")
    doc.append_paragraph("2. 다음 부등식을 만족시키는 함수 f 에 대하여 옳은 것은? [3점]")
    doc.append_equation(EQ_INEQ)
    doc.append_paragraph("① 1   ② 2   ③ 3   ④ 4   ⑤ 5")
    doc.append_paragraph("")
    doc.append_paragraph("3. 실수 전체의 집합에서 연속인 함수 f 가 다음과 같을 때, "
                         "상수 a 의 값은? [3점]")
    doc.append_equation(EQ_CASES)
    doc.append_paragraph("① -2   ② -1   ③ 0   ④ 1   ⑤ 2")
    doc.append_paragraph("")
    doc.append_paragraph("4. 다음 조건을 만족시키는 수열의 첫째항은? [4점]")
    doc.append_equation(EQ_SUM)
    doc.append_paragraph("① 10   ② 20   ③ 30   ④ 40   ⑤ 50")
    doc.append_paragraph("")
    doc.append_paragraph("◆여기까지보이면성공◆ — 이 줄이 보이면 문서 끝까지 정상입니다. "
                         "본문이 두 단으로 나뉘어 흐르는지, 수식 네 개가 모두 조판됐는지 "
                         "확인해 주세요.")

    print("=== 검증 ===")
    problems = 0
    for name in ["xml_validation_errors", "reference_validation_errors",
                 "stale_paragraph_layout_validation_errors", "validation_errors",
                 "strict_lint_errors"]:
        errs = getattr(doc, name)()
        problems += len(errs)
        print(f"  {name}: {len(errs)}건" + (f" → {errs[:2]}" if errs else ""))
    try:
        doc.strict_validate()
        print("  strict_validate: 통과")
    except Exception as e:  # noqa: BLE001
        problems += 1
        print(f"  strict_validate: 실패 — {e}")

    out = out_dir / "math-probe.hwpx"
    doc.save(str(out))
    re_open = HwpxDocument.open(str(out))
    print(f"\n저장: {out} ({out.stat().st_size:,} bytes)")
    print(f"재열기 문단 {re_open.paragraph_count()}개, 수식 {len(re_open.equations())}개")
    return 0 if problems == 0 else 1


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "out"
    raise SystemExit(build(target))
