"""Runtime page and column layout shared by the HWPX exam converter."""

from __future__ import annotations

from pedagogy_hwpx import HwpxDocument

HH = "http://www.hancom.co.kr/hwpml/2011/head"
HP = "http://www.hancom.co.kr/hwpml/2011/paragraph"

PAGE_MM = (272.0, 394.0)
MARGIN_MM = {"left": 19.0, "right": 19.0, "top": 15.0, "bottom": 25.0,
             "header": 0.0, "footer": 9.0}
COL_COUNT = 2
COL_GAP_HWPUNIT = 3316
BODY_FONT = "함초롬바탕"


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
    """Return the real exam's equal-width, two-column definition."""
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

    # HWPX schema order requires colPr immediately after secPr.
    run = sec.root.find(".//hp:run")
    if run is None:
        raise RuntimeError("section0.xml 에 run 이 없습니다")
    kids = run.children
    after_sec = next((i for i, child in enumerate(kids) if child.local_name == "secPr"), -1)
    if after_sec < 0:
        raise RuntimeError("첫 run 에 secPr 이 없습니다 — 단 정의 위치를 정할 수 없습니다")
    run.insert_xml(after_sec + 1, col_pr_xml())
    sec.mark_modified()
