"""범용 문서 JSON → HWPX (베타).

지원 블록은 제목·제목글·문단·별행 수식·글머리표·번호 목록·인용문·표·그림·상자다. 문서 구조는
`document_schema.py`에서 먼저 검증한다. 수식 변환 실패는 절대 조용히 넘기지 않고 결과
문서와 반환 경고에 함께 남긴다.

⚠️ 표는 아직 실물 HWPX 파일로 대조하지 못했다 — `pedagogy_hwpx.append_table()`의
docstring 참고. 표가 든 문서를 만들면 실제로 한글에서 열어 확인할 것.
"""

from __future__ import annotations

import base64
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from document_schema import DocumentValidationError, validate  # noqa: E402
from pedagogy_hwpx import HwpxDocument, MM_TO_HWPUNIT  # noqa: E402
from tex_to_hwp import UnsupportedTex, convert  # noqa: E402


HP = "http://www.hancom.co.kr/hwpml/2011/paragraph"
HH = "http://www.hancom.co.kr/hwpml/2011/head"
HC = "http://www.hancom.co.kr/hwpml/2011/core"
MM = 7200 / 25.4


@dataclass
class Report:
    blocks: int = 0
    equations: int = 0
    warnings: list[str] = field(default_factory=list)


def xml_escape(value: str) -> str:
    return (value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&apos;"))


def split_inline(text: str) -> list[tuple[str, str]]:
    """문단 안의 `$...$`만 수식으로 처리한다. `$$...$$`는 equation 블록을 쓴다."""
    parts: list[tuple[str, str]] = []
    for chunk in re.split(r"(\$[^$\n]*\$)", text):
        if not chunk:
            continue
        parts.append(("equation", chunk[1:-1]) if chunk.startswith("$") and chunk.endswith("$")
                     else ("text", chunk))
    return parts


def _char_pr(id_: int, size: int, *, bold: bool = False, color: str = "#000000") -> str:
    bold_xml = '<hh:bold/>' if bold else ''
    langs = 'hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"'
    return (
        f'<hh:charPr xmlns:hh="{HH}" id="{id_}" height="{size}" textColor="{color}" '
        'shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE">'
        f'<hh:fontRef {langs}/><hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>'
        '<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>'
        '<hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>'
        '<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>'
        '<hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/>'
        f'{bold_xml}<hh:outline type="NONE"/><hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>'
        '</hh:charPr>'
    )


def _para_pr(id_: int, *, align: str = "LEFT", left_mm: float = 0, right_mm: float = 0,
             first_mm: float = 0, before_mm: float = 0, after_mm: float = 1.7,
             line: int = 160, border_fill: str | None = None) -> str:
    """문단 모양 하나.

    `border_fill` 을 주면 **테두리 있는 문단**이 된다.
    ⚠️ `connect="1"` 이 핵심이다 — 이게 있어야 **연속된 문단이 상자 하나로 합쳐진다.**
       없으면 줄마다 따로 상자가 그려진다. 실물 시험지의 `21 박스(테두리)` 문단이
       그렇게 돼 있어 그대로 따랐다(offset 은 상자 안쪽 여백).
    """
    unit = lambda value: str(round(value * MM))
    border = ""
    if border_fill is not None:
        border = (f'<hh:border borderFillIDRef="{border_fill}" offsetLeft="1133" '
                  'offsetRight="1133" offsetTop="850" offsetBottom="850" '
                  'connect="1" ignoreMargin="1"/>')
    return (
        f'<hh:paraPr xmlns:hh="{HH}" xmlns:hc="{HC}" id="{id_}" tabPrIDRef="0" condense="0" '
        'fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">'
        f'<hh:align horizontal="{align}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/>'
        '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="1" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>'
        '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hh:margin>'
        f'<hc:intent value="{unit(first_mm)}" unit="HWPUNIT"/><hc:left value="{unit(left_mm)}" unit="HWPUNIT"/>'
        f'<hc:right value="{unit(right_mm)}" unit="HWPUNIT"/><hc:prev value="{unit(before_mm)}" unit="HWPUNIT"/>'
        f'<hc:next value="{unit(after_mm)}" unit="HWPUNIT"/></hh:margin>'
        f'<hh:lineSpacing type="PERCENT" value="{line}" unit="HWPUNIT"/>{border}</hh:paraPr>'
    )


def install_styles(doc: HwpxDocument) -> dict[str, str]:
    """빈 내부 HWPX에 학술 문서용 최소 글자·문단 역할을 추가한다."""
    head = doc.get_part("Contents/header.xml")
    chars = head.root.find(".//hh:charProperties")
    paras = head.root.find(".//hh:paraProperties")
    if chars is None or paras is None:
        raise RuntimeError("HWPX header.xml에 글자/문단 서식이 없습니다")
    c, p = int(chars.get_attr("itemCnt") or 1), int(paras.get_attr("itemCnt") or 1)
    roles: dict[str, str] = {}
    # ⚠️ 테두리 정의를 **문단 모양보다 먼저** 만든다 — 상자 문단이 그 id 를 참조한다.
    #    한글 빈 문서의 테두리는 전부 '없음' 이라 그대로 쓰면 선이 안 보인다.
    roles["border_cell"] = doc.add_border_fill()
    roles["border_box"] = doc.add_border_fill(width="0.15 mm")
    for name, size, bold in (("title", 1900, True), ("heading1", 1500, True),
                             ("heading2", 1300, True), ("heading3", 1150, True),
                             ("body", 1100, False), ("quote", 1050, False),
                             ("table_header", 1050, True), ("table_body", 1050, False)):
        chars.append_xml(_char_pr(c, size, bold=bold, color="#333333" if name == "quote" else "#000000"))
        roles[f"char_{name}"] = str(c)
        c += 1
    for name, values in {
        "title": dict(align="CENTER", before_mm=0, after_mm=6.0, line=140),
        "heading1": dict(before_mm=6.0, after_mm=2.5, line=145),
        "heading2": dict(before_mm=4.5, after_mm=2.0, line=150),
        "heading3": dict(before_mm=3.5, after_mm=1.5, line=155),
        "body": dict(before_mm=0, after_mm=1.7, line=165),
        "equation": dict(align="CENTER", before_mm=1.0, after_mm=2.0, line=140),
        "list": dict(left_mm=7.0, first_mm=-4.5, before_mm=0, after_mm=1.2, line=160),
        "quote": dict(left_mm=8.0, right_mm=5.0, before_mm=1.5, after_mm=1.5, line=160),
        "table": dict(align="CENTER", before_mm=2.0, after_mm=3.0, line=140),
        "image": dict(align="CENTER", before_mm=2.0, after_mm=2.0, line=140),
        "box": dict(left_mm=3.0, right_mm=3.0, before_mm=0, after_mm=0, line=165),
        "boxtop": dict(before_mm=2.5, after_mm=0, line=40),
        "boxbottom": dict(before_mm=0, after_mm=2.5, line=40),
    }.items():
        # 상자 문단만 테두리를 단다.
        paras.append_xml(_para_pr(p, border_fill=roles["border_box"] if name == "box" else None,
                                  **values))
        roles[f"para_{name}"] = str(p)
        p += 1
    chars.set_attr("itemCnt", str(c)); paras.set_attr("itemCnt", str(p)); head.mark_modified()
    return roles


def _append_text(doc: HwpxDocument, paragraph: int, text: str, char: str) -> None:
    if text:
        doc.append_run_xml(f'<hp:t xmlns:hp="{HP}">{xml_escape(text)}</hp:t>',
                           paragraph_index=paragraph, char_pr_id=char)


def emit_rich(doc: HwpxDocument, text: str, report: Report, styles: dict[str, str],
              *, para: str = "body", char: str = "body", where: str,
              into: int | None = None) -> None:
    """문단 하나. `into` 를 주면 새 문단을 만들지 않고 그 문단에 이어 쓴다.

    골격의 첫 문단은 구역 정의를 안고 있어 지울 수 없으므로, 문서의 첫 글은 거기에
    이어 써야 맨 위에 빈 줄이 남지 않는다.
    """
    parts = split_inline(text)
    if into is not None:
        paragraph = into
        doc.set_paragraph_style(into, para_pr_id=styles[f"para_{para}"],
                                char_pr_id=styles[f"char_{char}"])
        remaining = parts
    else:
        lead = parts[0][1] if parts and parts[0][0] == "text" else ""
        doc.append_paragraph(lead, para_pr_id=styles[f"para_{para}"], char_pr_id=styles[f"char_{char}"])
        paragraph = doc.paragraph_count() - 1
        remaining = parts[1:] if lead else parts
    for kind, value in remaining:
        if kind == "text":
            _append_text(doc, paragraph, value, styles[f"char_{char}"])
            continue
        try:
            doc.append_inline_equation(convert(value), paragraph_index=paragraph,
                                       char_pr_id=styles["char_body"], base_unit=1050)
            report.equations += 1
        except UnsupportedTex as exc:
            report.warnings.append(f"{where}: 인라인 수식 변환 실패 — {exc} ({value})")
            _append_text(doc, paragraph, f"[수식 변환 실패: {value}]", styles[f"char_{char}"])


def emit_display_equation(doc: HwpxDocument, tex: str, report: Report, styles: dict[str, str], *, where: str) -> None:
    body = tex[2:-2].strip() if tex.startswith("$$") and tex.endswith("$$") else tex.strip("$").strip()
    doc.append_paragraph("", para_pr_id=styles["para_equation"], char_pr_id=styles["char_body"])
    paragraph = doc.paragraph_count() - 1
    try:
        doc.append_equation(convert(body), paragraph_index=paragraph, char_pr_id=styles["char_body"], base_unit=1100,
                            width=11000, height=2800)
        report.equations += 1
    except UnsupportedTex as exc:
        report.warnings.append(f"{where}: 별행 수식 변환 실패 — {exc} ({body})")
        _append_text(doc, paragraph, f"[수식 변환 실패: {body}]", styles["char_body"])


def emit_table(doc: HwpxDocument, rows: list[list[str]], header: bool, styles: dict[str, str]) -> None:
    """표 하나. `pedagogy_hwpx.append_table()`이 실제 `<hp:tbl>` 을 만든다.

    빈 문단을 하나 먼저 만들고 거기에 붙인다 — `emit_display_equation()` 과 같은
    이유다. 표 앞뒤 여백은 그 빈 문단의 문단 모양(`para_table`)이 낸다.
    """
    doc.append_paragraph("", para_pr_id=styles["para_table"], char_pr_id=styles["char_body"])
    paragraph = doc.paragraph_count() - 1
    doc.append_table(rows, paragraph_index=paragraph, header=header,
                     header_char_pr_id=styles["char_table_header"],
                     body_char_pr_id=styles["char_table_body"],
                     cell_border_fill_id=styles["border_cell"])


def emit_image(doc: HwpxDocument, encoded: str, width_mm: float,
               pixels: tuple[int, int], styles: dict[str, str], *, where: str) -> None:
    """그림 한 장. 가운데 정렬 문단을 만들고 거기에 붙인다.

    ⚠️ 높이는 **원본 비율로 계산한다.** 폭만 지정하고 높이를 아무 값이나 주면 그림이
       늘어나거나 눌린다. 계약(`document_schema`)이 이미 바이트를 보고 PNG/JPEG 인지와
       원본 픽셀 크기를 확인했으므로 여기서는 그 값을 믿고 쓴다.
    """
    data = base64.b64decode(encoded)
    px_w, px_h = pixels
    w = round(width_mm * MM_TO_HWPUNIT)
    h = round(w * px_h / px_w)
    doc.append_paragraph("", para_pr_id=styles["para_image"], char_pr_id=styles["char_body"])
    paragraph = doc.paragraph_count() - 1
    # 확장자는 바이트로 판정한 형식을 따른다 — 사용자가 준 이름을 쓰지 않는다.
    name = f"image{doc.paragraph_count()}." + ("png" if data[:8] == b"\x89PNG\r\n\x1a\n" else "jpg")
    doc.append_picture(name, data, paragraph_index=paragraph,
                       char_pr_id=styles["char_body"], width=w, height=h)


def emit_box(doc: HwpxDocument, text: str, label: str | None, report: Report,
             styles: dict[str, str], *, where: str) -> None:
    """테두리 상자. 줄바꿈마다 문단을 만들되 **모두 같은 상자 문단 모양**을 쓴다.

    ⚠️ 그래야 `connect="1"` 이 작동해 하나의 상자로 합쳐진다. 줄마다 다른 문단 모양을
       주면 줄 수만큼 상자가 그려진다.
    ⚠️ 상자 앞뒤에 여백 문단을 하나씩 둔다 — 없으면 앞 문단이 상자에 딱 붙는다
       (`mock_to_hwpx` 가 시험지 조건 상자에서 겪은 것과 같은 문제다).
    """
    doc.append_paragraph("", para_pr_id=styles["para_boxtop"], char_pr_id=styles["char_body"])
    lines = [line for line in text.split("\n") if line.strip()]
    if label:
        lines.insert(0, label)
    for line in lines:
        emit_rich(doc, line, report, styles, para="box", char="body", where=where)
    doc.append_paragraph("", para_pr_id=styles["para_boxbottom"], char_pr_id=styles["char_body"])


def build(raw: object, output: str | Path) -> Report:
    document = validate(raw)
    doc = HwpxDocument.blank()
    styles = install_styles(doc)
    report = Report()
    # ⚠️ 골격의 첫 문단은 지우면 안 된다 — 구역·쪽 정의(`secPr`)가 그 안에 들어 있다.
    #    그렇다고 그냥 두면 문서 맨 위에 빈 줄이 하나 남는다. 제목을 그 문단에 이어 쓴다.
    #    (`mock_to_hwpx` 가 시험지 틀에 첫 문항을 이어 쓰는 것과 같은 이유다.)
    frame = doc.first_paragraph_is_empty()
    emit_rich(doc, document.title, report, styles, para="title", char="title", where="제목",
              into=0 if frame else None)
    for index, block in enumerate(document.blocks, 1):
        kind, where = block["type"], f"{index}번째 {block['type']}"
        if kind == "heading":
            emit_rich(doc, block["text"], report, styles, para=f"heading{block['level']}",
                      char=f"heading{block['level']}", where=where)
        elif kind == "paragraph":
            emit_rich(doc, block["text"], report, styles, where=where)
        elif kind == "quote":
            emit_rich(doc, block["text"], report, styles, para="quote", char="quote", where=where)
        elif kind == "equation":
            emit_display_equation(doc, block["text"], report, styles, where=where)
        elif kind == "table":
            emit_table(doc, block["rows"], block["header"], styles)
        elif kind == "image":
            emit_image(doc, block["data"], block["width"], tuple(block["pixels"]),
                       styles, where=where)
        elif kind == "box":
            emit_box(doc, block["text"], block["label"], report, styles, where=where)
        else:
            mark = "•" if kind == "bullets" else None
            for item_no, item in enumerate(block["items"], 1):
                prefix = f"{item_no}. " if mark is None else f"{mark} "
                emit_rich(doc, prefix + item, report, styles, para="list", where=where)
        report.blocks += 1
    doc.save(output)
    return report


if __name__ == "__main__":
    import json
    if len(sys.argv) != 3:
        raise SystemExit("사용법: python3 document_to_hwpx.py 문서.json 출력.hwpx")
    try:
        report = build(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")), sys.argv[2])
    except DocumentValidationError as exc:
        raise SystemExit(f"문서 JSON 오류: {exc}") from exc
    print(f"문서 {report.blocks}블록 · 수식 {report.equations}개 · 경고 {len(report.warnings)}개")
