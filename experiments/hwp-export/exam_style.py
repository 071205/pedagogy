"""실물 수능 시험지의 조판 규격 (베타).

값은 전부 `2025학년도 수능 수학 문제.hwp` 의 DocInfo 에서 **직접 읽어 온 것**이다.
눈대중이나 추정이 아니다. 뽑는 방법은 `analyze_exam.py` 참고.

  글자 모양(CHAR_SHAPE)  ─ 크기는 offset 42 의 INT32(1/100pt)
  문단 모양(PARA_SHAPE)  ─ 줄간격은 offset 50 의 UINT32(%)

⚠️ 규격서 통념과 달리 CHAR_SHAPE 의 `relSizes` 는 UINT16×7 이 아니라 **UINT8×7** 이다.
   UINT16 으로 읽으면 그 뒤 글자 크기가 7바이트 밀려 6579pt 같은 값이 나온다(실제로 그랬다).
"""

from __future__ import annotations

# ── 실측값 ────────────────────────────────────────────────────────────────
PT = 100                    # HWPX charPr height 단위 = 1/100 pt
MM = 7200 / 25.4            # 1mm = 283.46 HWPUNIT

# 본문 — 가장 많이 쓰인 글자 모양(id 0, 183회)
BODY_PT = 11.5
BODY_RATIO = 95             # 장평 %
BODY_SPACING = -5           # 자간 %

# '5지선다형' 태그 (id 9)
TAG_PT = 10.7
TAG_SPACING = -8

# 문단 모양 (실측)
#   발문 id 12 : 양쪽 · 165% · 왼여백 7.76mm · 들여쓰기 -7.97mm(내어쓰기)
#   선지 id 40 : 왼쪽 · 165% · 들여쓰기 -8.25mm · 문단아래 7.76mm
#   조건 id 13 : 왼쪽 · 165% · 왼여백 8.11mm · 문단아래 8.11mm
#   수식 id 49 : 가운데 · 160%
#
# 발문의 '왼여백 + 음수 들여쓰기' 가 문항 번호를 왼쪽으로 내어 쓰는 조판이다.
# 둘째 줄부터는 번호 폭만큼 들어가 글이 가지런히 선다.
BODY_LEFT_MM = 7.76
BODY_INDENT_MM = -7.97
BODY_LINE = 165

CHOICE_INDENT_MM = -8.25
CHOICE_NEXT_MM = 7.76
CHOICE_LINE = 165

COND_LEFT_MM = 8.11
COND_NEXT_MM = 8.11
COND_LINE = 165

EQ_LINE = 160

# 실물은 신명 중명조를 쓰지만 그 글꼴은 한컴오피스에도 없다(별매 상용).
# 항상 있는 함초롬바탕을 기본으로 두고, 가진 사람은 이 값만 바꾸면 된다.
BODY_FONT = "함초롬바탕"

HH = "http://www.hancom.co.kr/hwpml/2011/head"
HC = "http://www.hancom.co.kr/hwpml/2011/core"


def hwpunit(mm: float) -> int:
    return round(mm * MM)


def _char_pr(cid: int, pt: float, ratio: int, spacing: int, *, bold: bool = False) -> str:
    seven = lambda v: " ".join(f'{k}="{v}"' for k in                       # noqa: E731
        ("hangul", "latin", "hanja", "japanese", "other", "symbol", "user"))
    return (
        f'<hh:charPr xmlns:hh="{HH}" id="{cid}" height="{round(pt * PT)}"'
        f' textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE">'
        f'<hh:fontRef {seven(0)}/>'
        f'<hh:ratio {seven(ratio)}/>'
        f'<hh:spacing {seven(spacing)}/>'
        f'<hh:relSz {seven(100)}/>'
        f'<hh:offset {seven(0)}/>'
        + ('<hh:bold/>' if bold else '')
        + '<hh:underline type="NONE" shape="SOLID" color="#000000"/>'
        '<hh:strikeout shape="NONE" color="#000000"/>'
        '<hh:outline type="NONE"/>'
        '<hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>'
        '</hh:charPr>'
    )


def _para_pr(pid: int, align: str, line: int, *, left_mm: float = 0.0,
             indent_mm: float = 0.0, next_mm: float = 0.0, prev_mm: float = 0.0) -> str:
    return (
        f'<hh:paraPr xmlns:hh="{HH}" xmlns:hc="{HC}" id="{pid}" tabPrIDRef="0" condense="0"'
        f' fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">'
        f'<hh:align horizontal="{align}" vertical="BASELINE"/>'
        '<hh:heading type="NONE" idRef="0" level="0"/>'
        '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD"'
        ' widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>'
        '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
        '<hh:margin>'
        f'<hc:intent value="{hwpunit(indent_mm)}" unit="HWPUNIT"/>'
        f'<hc:left value="{hwpunit(left_mm)}" unit="HWPUNIT"/>'
        '<hc:right value="0" unit="HWPUNIT"/>'
        f'<hc:prev value="{hwpunit(prev_mm)}" unit="HWPUNIT"/>'
        f'<hc:next value="{hwpunit(next_mm)}" unit="HWPUNIT"/>'
        '</hh:margin>'
        f'<hh:lineSpacing type="PERCENT" value="{line}" unit="HWPUNIT"/>'
        '</hh:paraPr>'
    )


def install(doc) -> dict[str, str]:
    """시험지 서식을 header.xml 에 심고, 쓸 id 들을 돌려준다.

    빈 문서에 이미 있는 id 0 은 건드리지 않고 뒤에 이어 붙인다.
    """
    head = doc.get_part("Contents/header.xml")
    chars = head.root.find(".//hh:charProperties")
    paras = head.root.find(".//hh:paraProperties")
    if chars is None or paras is None:
        raise RuntimeError("header.xml 에 charProperties/paraProperties 가 없습니다")

    c0 = int(chars.get_attr("itemCnt") or 1)
    p0 = int(paras.get_attr("itemCnt") or 1)

    body_c, tag_c = c0, c0 + 1
    chars.append_xml(_char_pr(body_c, BODY_PT, BODY_RATIO, BODY_SPACING))
    chars.append_xml(_char_pr(tag_c, TAG_PT, BODY_RATIO, TAG_SPACING, bold=True))
    chars.set_attr("itemCnt", str(c0 + 2))

    body_p, choice_p, cond_p, eq_p = p0, p0 + 1, p0 + 2, p0 + 3
    paras.append_xml(_para_pr(body_p, "JUSTIFY", BODY_LINE,
                              left_mm=BODY_LEFT_MM, indent_mm=BODY_INDENT_MM))
    paras.append_xml(_para_pr(choice_p, "LEFT", CHOICE_LINE,
                              indent_mm=CHOICE_INDENT_MM, next_mm=CHOICE_NEXT_MM))
    paras.append_xml(_para_pr(cond_p, "LEFT", COND_LINE,
                              left_mm=COND_LEFT_MM, next_mm=COND_NEXT_MM))
    paras.append_xml(_para_pr(eq_p, "CENTER", EQ_LINE))
    paras.set_attr("itemCnt", str(p0 + 4))

    head.mark_modified()
    return {"char_body": str(body_c), "char_tag": str(tag_c),
            "para_body": str(body_p), "para_choice": str(choice_p),
            "para_cond": str(cond_p), "para_eq": str(eq_p)}
