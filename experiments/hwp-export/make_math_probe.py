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

from jakal_hwpx import HwpxDocument

HH = "http://www.hancom.co.kr/hwpml/2011/head"
HP = "http://www.hancom.co.kr/hwpml/2011/paragraph"

# 실물 수학 시험지에서 읽어 온 값
PAGE_MM = (272.0, 394.0)
MARGIN_MM = {"left": 19.0, "right": 19.0, "top": 15.0, "bottom": 25.0,
             "header": 0.0, "footer": 9.0}
COL_COUNT = 2
COL_GAP_HWPUNIT = 3316          # 11.7mm — 실물 값 그대로

# 실물 시험지가 쓰는 신명·한양 계열은 한컴에도 없는 별매 글꼴이라
# 항상 있는 함초롬바탕을 기본으로 둔다(자세한 내용은 README).
BODY_FONT = "함초롬바탕"

# 실물에서 그대로 뽑은 수식 (손으로 지어내지 않았다)
EQ_ROOT = " sqrt {3} of {5}  times 25^{{1} over {3}}"
EQ_INEQ = "2 f left(1  right)  leq f left(2  right)  leq f left(3  right)"
EQ_CASES = ("f LEFT ( x RIGHT ) = {cases{eqalign{``5x+a#}&&eqalign{~ LEFT ( x<`-2 RIGHT )#}"
            "#``x ^{2} -a&&~ LEFT ( x GEQ `-2 RIGHT )}}")
EQ_SUM = " lim _{n ``rarrow``  inf }  sum_{k=1}^{2 n} a_{k} >{1} over {700}"


def mm_to_hwpunit(mm: float) -> int:
    return round(mm / 25.4 * 7200)


def font_faces_xml(face: str) -> str:
    langs = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"]
    body = "".join(
        f'<hh:fontface xmlns:hh="{HH}" lang="{lang}" fontCnt="1">'
        f'<hh:font id="0" face="{face}" type="TTF" isEmbedded="0">'
        f'<hh:typeInfo familyType="FCAT_MYUNGJO" weight="5" proportion="4" contrast="0"'
        f' strokeVariation="1" armStyle="0" letterform="0" midline="0" xHeight="0"/>'
        f"</hh:font></hh:fontface>"
        for lang in langs
    )
    return f'<hh:fontfaces xmlns:hh="{HH}" itemCnt="{len(langs)}">{body}</hh:fontfaces>'


def col_pr_xml() -> str:
    """단 정의. 실물처럼 '같은 너비 2단' 이다.

    바이너리에서는 문단에 붙는 'cold' 컨트롤이었으므로, HWPX 에서도 구역 속성이 아니라
    문단 안 `<hp:ctrl>` 로 넣는다.
    """
    return (
        f'<hp:ctrl xmlns:hp="{HP}">'
        f'<hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="{COL_COUNT}"'
        f' sameSz="1" sameGap="{COL_GAP_HWPUNIT}"/>'
        f"</hp:ctrl>"
    )


def apply_layout(doc: HwpxDocument) -> None:
    head = doc.get_part("Contents/header.xml")
    ref_list = head.root.find("hh:refList")
    if ref_list.find("hh:fontfaces") is None:
        ref_list.insert_xml(0, font_faces_xml(BODY_FONT))
        head.mark_modified()

    sec = doc.get_part("Contents/section0.xml")
    page_pr = sec.root.find(".//hp:pagePr")
    page_pr.set_attr("width", str(mm_to_hwpunit(PAGE_MM[0])))
    page_pr.set_attr("height", str(mm_to_hwpunit(PAGE_MM[1])))
    page_pr.set_attr("landscape", "NARROWLY")
    margin = page_pr.find("hp:margin")
    for key, mm in MARGIN_MM.items():
        margin.set_attr(key, str(mm_to_hwpunit(mm)))

    # 단 정의는 첫 문단 안에 둔다 — 그래야 문서 처음부터 2단으로 흐른다.
    # ⚠️ 반드시 `hp:secPr` **뒤**에 와야 한다. 앞에 넣으면 스키마 순서가 어긋나
    #    한글이 조용히 무시하고 1단으로 조판한다(실제로 그랬다).
    run = sec.root.find(".//hp:run")
    if run is None:
        raise RuntimeError("section0.xml 에 run 이 없습니다")
    kids = run.children
    after_sec = next((i for i, c in enumerate(kids) if c.local_name == "secPr"), -1)
    if after_sec < 0:
        raise RuntimeError("첫 run 에 secPr 이 없습니다 — 단 정의 위치를 정할 수 없습니다")
    run.insert_xml(after_sec + 1, col_pr_xml())
    sec.mark_modified()


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
