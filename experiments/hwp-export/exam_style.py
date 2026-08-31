"""읽어 온 조판 규격을 HWPX 문서에 심는다 (베타).

값은 여기 적혀 있지 않다. `exam_profile.profile_from()` 이 **실물 시험지에서 읽어 온 것**을
그대로 받아 `header.xml` 의 글자·문단 서식으로 옮길 뿐이다.

예전에는 이 파일에 11.5pt·165%·7.76mm 같은 숫자를 손으로 적어 뒀는데, 그러다 발문과 선지의
문단 모양을 서로 바꿔 적었다. 숫자를 사람이 옮기는 한 그런 실수는 또 난다.
"""

from __future__ import annotations

MM = 7200 / 25.4            # 1mm 의 HWPUNIT
HH = "http://www.hancom.co.kr/hwpml/2011/head"
HC = "http://www.hancom.co.kr/hwpml/2011/core"

# 실물이 쓰는 신명 계열은 한컴오피스에도 없는 별매 상용 글꼴이라, 늘 있는 것을 기본으로 둔다.
# 글꼴을 가진 사람은 이 값만 바꾸면 그대로 적용된다(파일에는 이름만 들어간다).
BODY_FONT = "함초롬바탕"

_LANGS = ("hangul", "latin", "hanja", "japanese", "other", "symbol", "user")


def hwpunit(mm: float) -> int:
    return round(mm * MM)


def _seven(v) -> str:
    return " ".join(f'{k}="{v}"' for k in _LANGS)


def _char_pr(cid: int, c: dict) -> str:
    return (
        f'<hh:charPr xmlns:hh="{HH}" id="{cid}" height="{round(c["pt"] * 100)}"'
        ' textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE">'
        f'<hh:fontRef {_seven(0)}/>'
        f'<hh:ratio {_seven(c["ratio"])}/>'
        f'<hh:spacing {_seven(c["spacing"])}/>'
        f'<hh:relSz {_seven(100)}/>'
        f'<hh:offset {_seven(0)}/>'
        '<hh:underline type="NONE" shape="SOLID" color="#000000"/>'
        '<hh:strikeout shape="NONE" color="#000000"/>'
        '<hh:outline type="NONE"/>'
        '<hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>'
        '</hh:charPr>'
    )


def _para_pr(pid: int, p: dict) -> str:
    return (
        f'<hh:paraPr xmlns:hh="{HH}" xmlns:hc="{HC}" id="{pid}" tabPrIDRef="0" condense="0"'
        ' fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">'
        f'<hh:align horizontal="{p["align"]}" vertical="BASELINE"/>'
        '<hh:heading type="NONE" idRef="0" level="0"/>'
        '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD"'
        ' widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>'
        '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
        '<hh:margin>'
        f'<hc:intent value="{hwpunit(p["indent"])}" unit="HWPUNIT"/>'
        f'<hc:left value="{hwpunit(p["left"])}" unit="HWPUNIT"/>'
        '<hc:right value="0" unit="HWPUNIT"/>'
        f'<hc:prev value="{hwpunit(p.get("prev", 0.0))}" unit="HWPUNIT"/>'
        f'<hc:next value="{hwpunit(p["next"])}" unit="HWPUNIT"/>'
        '</hh:margin>'
        f'<hh:lineSpacing type="PERCENT" value="{p["line"]}" unit="HWPUNIT"/>'
        '</hh:paraPr>'
    )


ROLES = ("stem", "choice", "cont")


def install(doc, profile: dict) -> dict[str, str]:
    """프로파일의 서식을 header.xml 에 심고, 역할 → id 표를 돌려준다.

    빈 문서에 이미 있는 id 0 은 건드리지 않고 뒤에 이어 붙인다.
    """
    head = doc.get_part("Contents/header.xml")
    chars = head.root.find(".//hh:charProperties")
    paras = head.root.find(".//hh:paraProperties")
    if chars is None or paras is None:
        raise RuntimeError("header.xml 에 charProperties/paraProperties 가 없습니다")

    c_next = int(chars.get_attr("itemCnt") or 1)
    p_next = int(paras.get_attr("itemCnt") or 1)
    ids: dict[str, str] = {}

    for role in ROLES:
        chars.append_xml(_char_pr(c_next, profile[role]["char"]))
        ids[f"char_{role}"] = str(c_next)
        c_next += 1
        paras.append_xml(_para_pr(p_next, profile[role]["para"]))
        ids[f"para_{role}"] = str(p_next)
        p_next += 1

    # 문항 번호는 본문과 다른 크기를 쓴다(실물에서 더 크다). 없으면 발문 서식을 그대로 쓴다.
    if "num_char" in profile:
        chars.append_xml(_char_pr(c_next, profile["num_char"]))
        ids["char_num"] = str(c_next)
        c_next += 1
    else:
        ids["char_num"] = ids["char_stem"]

    chars.set_attr("itemCnt", str(c_next))
    paras.set_attr("itemCnt", str(p_next))
    head.mark_modified()
    return ids
