"""PEDAGOGY가 소유·유지하는 최소 HWPX 작성 엔진.

문항 조판에 필요한 HWPX 패키지, 문단, 인라인 수식, 그림, 표만 다룬다. 외부 `jakal-hwpx`
패키지에 의존하지 않으며, HWPX 틀을 열어 보존한 뒤 필요한 XML만 바꾸는 방식이다.

⚠️ `append_table()`의 `<hp:tbl>` XML 모양은 지어낸 것이 아니다 — 우리는 실물 표가 든
HWPX 참고 파일이 없어서, HWPX를 검증하는 외부 라이브러리(jakal-hwpx)가 실제로 만드는
구조를 참고해 옮겼다(그 라이브러리는 여기서 의존성으로 쓰지 않는다 — 구조만 참고했다).
이 파일의 다른 함수들처럼 실물 파일 대조로 확인한 것이 아니므로, 표가 포함된 문서를
한글에서 열어 실제로 확인하기 전까지는 베타로 다룰 것.
"""

from __future__ import annotations

import mimetypes
import re
import zipfile
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path

from lxml import etree


NS = {
    "ha": "http://www.hancom.co.kr/hwpml/2011/app",
    "hc": "http://www.hancom.co.kr/hwpml/2011/core",
    "hh": "http://www.hancom.co.kr/hwpml/2011/head",
    "hm": "http://www.hancom.co.kr/hwpml/2011/master-page",
    "hp": "http://www.hancom.co.kr/hwpml/2011/paragraph",
    "hs": "http://www.hancom.co.kr/hwpml/2011/section",
    "hv": "http://www.hancom.co.kr/hwpml/2011/version",
    "hpf": "http://www.hancom.co.kr/schema/2011/hpf",
    "ocf": "urn:oasis:names:tc:opendocument:xmlns:container",
    "opf": "http://www.idpf.org/2007/opf/",
}
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"

# 한글이 직접 저장한 빈 문서. `HwpxDocument.blank()` 의 골격이다(위 docstring 참고).
BLANK_TEMPLATE = Path(__file__).resolve().parent / "templates" / "blank.hwpx"


MM_TO_HWPUNIT = 7200 / 25.4

# 문항 라벨. **양쪽 조판기(시험지·범용 문서)가 같은 것을 써야 한다** — 한쪽에만 두면
# 다른 쪽이 베껴 쓰게 되고, 그러다 갈라진다(이 저장소가 여러 번 겪은 방식이다).
MARKS = ["①", "②", "③", "④", "⑤"]        # 선지
HGND = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ"]   # <보기> 항목


def image_size(data: bytes) -> tuple[int, int] | None:
    """PNG·JPEG 의 가로·세로(px). 비율을 지키려면 필요하다.

    외부 라이브러리(PIL)를 쓰지 않는다 — XML 처리는 lxml 만 쓰고 HWPX 조립은 이 엔진이
    맡는다. 헤더만 읽으면 되는 일에 의존성을 늘릴 이유가 없다.

    ⚠️ 여기가 **형식 판정도 겸한다.** 확장자나 사용자가 준 이름은 믿지 않는다 —
       바이트를 보고 PNG/JPEG 가 아니면 None 을 준다.
    """
    if data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR":
        return (int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big"))
    if data[:2] == b"\xff\xd8":                     # JPEG
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                return (int.from_bytes(data[i + 7:i + 9], "big"),
                        int.from_bytes(data[i + 5:i + 7], "big"))
            i += 2 + int.from_bytes(data[i + 2:i + 4], "big")
    return None


def qn(prefix: str, name: str) -> str:
    return f"{{{NS[prefix]}}}{name}"


def _local(element: etree._Element) -> str:
    return etree.QName(element).localname


@dataclass
class _Part:
    path: str
    raw: bytes | None = None
    element: etree._Element | None = None
    modified: bool = False

    @property
    def root(self) -> "XmlNode":
        if self.element is None:
            raise TypeError(f"{self.path} is not XML")
        return XmlNode(self.element, self)

    def mark_modified(self) -> None:
        self.modified = True

    def to_bytes(self) -> bytes:
        if self.element is None:
            return self.raw or b""
        return etree.tostring(self.element, encoding="UTF-8", xml_declaration=True,
                              standalone=True)


class XmlNode:
    """내부 XML 노드 어댑터 — 조판기는 라이브러리 구현이 아닌 이 표면만 사용한다."""

    def __init__(self, element: etree._Element, part: _Part):
        self.element, self.part = element, part

    @property
    def local_name(self) -> str:
        return _local(self.element)

    @property
    def children(self) -> list["XmlNode"]:
        return [XmlNode(child, self.part) for child in self.element if isinstance(child.tag, str)]

    @property
    def text(self) -> str | None:
        return self.element.text

    @text.setter
    def text(self, value: str | None) -> None:
        self.element.text = value
        self.part.mark_modified()

    def find(self, path: str) -> "XmlNode | None":
        found = self.element.find(path, namespaces=NS)
        return XmlNode(found, self.part) if found is not None else None

    def iter(self):
        for node in self.element.iter():
            if isinstance(node.tag, str):
                yield XmlNode(node, self.part)

    def get_attr(self, name: str) -> str | None:
        return self.element.get(name)

    def set_attr(self, name: str, value: str) -> None:
        self.element.set(name, value)
        self.part.mark_modified()

    def append_xml(self, xml: str | bytes) -> "XmlNode":
        node = etree.fromstring(xml.encode("utf-8") if isinstance(xml, str) else xml)
        self.element.append(node)
        self.part.mark_modified()
        return XmlNode(node, self.part)

    def to_xml(self) -> str:
        """이 노드를 XML 문자열로 돌려준다.

        틀에서 조각(이어지는 쪽 머리말 등)을 **본문을 비우기 전에** 떠 두려고 쓴다.
        조판기가 `element` 를 직접 만지지 않도록 이 표면으로만 내보낸다.
        """
        return etree.tostring(self.element, encoding="unicode")

    def insert_xml(self, index: int, xml: str | bytes) -> "XmlNode":
        node = etree.fromstring(xml.encode("utf-8") if isinstance(xml, str) else xml)
        self.element.insert(index, node)
        self.part.mark_modified()
        return XmlNode(node, self.part)

    def remove(self) -> None:
        parent = self.element.getparent()
        if parent is None:
            raise ValueError("root XML node cannot be removed")
        parent.remove(self.element)
        self.part.mark_modified()

    def mark_modified(self) -> None:
        self.part.mark_modified()


class HwpxDocument:
    """PEDAGOGY 문서 출력에 필요한 작고 명시적인 HWPX 편집기."""

    def __init__(self, parts: OrderedDict[str, _Part] | None = None):
        self._parts = parts if parts is not None else HwpxDocument.blank()._parts
        self._control = 1
        # 표 칸 안 문단(hp:p)은 본문 문단과 **별도로 전체 문서에서 유일한 id**가 필요하다
        # (jakal-hwpx의 append_table()이 `.//hp:p/@id` 전체를 훑어 다음 번호를 매기는
        # 이유가 그것이다). 본문 문단은 섹션마다 0부터 다시 매기므로(`append_paragraph`),
        # 칸 문단에 같은 범위를 쓰면 겹친다. 절대 겹치지 않을 만큼 큰 자리에서 따로 센다.
        self._cell_para = 900_000

    @classmethod
    def blank(cls) -> "HwpxDocument":
        """빈 문서. **한글이 직접 저장한 `templates/blank.hwpx` 를 골격으로 쓴다.**

        ⚠️ 예전에는 이 골격을 코드로 직접 지어 만들었다. XML 문법은 완벽했고 우리
           검증도 전부 통과했지만, **한글이 그 파일을 열지 못했다**
           ("파일을 읽거나 저장하는데 오류가 있습니다"). 한글은 어디가 문제인지
           말해 주지 않아서, 무엇이 빠졌는지 하나씩 맞히는 수밖에 없었다 —
           `fontfaces`·`borderFills`·`tabProperties` 참조표, `META-INF/manifest.xml`,
           `container.rdf`, `compatibleDocument`/`docOption`, `Preview/` … 끝이 없었다.
           실물 파일을 골격으로 쓰면 **우리가 분석하지 않은 것까지 전부 따라온다.**
           `template.py` 가 시험지 틀에 대해 내린 것과 같은 결론이다.

        ⚠️ 그러므로 이 골격 파일을 지우거나 프로그램으로 다시 만들지 말 것.
           바꿔야 한다면 **한글에서 직접** 새 빈 문서를 `.hwpx` 로 저장해 갈아 끼우고,
           개인정보(저장한 사람·시각)를 지운 뒤 넣는다. `test_document_export.py` 가
           이 파일의 존재와 필수 참조표를 검사한다.
        """
        if not BLANK_TEMPLATE.exists():
            raise FileNotFoundError(
                f"빈 문서 골격이 없습니다: {BLANK_TEMPLATE}\n"
                "한글에서 새 문서를 만들어 '한글 표준 문서(*.hwpx)' 로 저장한 뒤 "
                "이 경로에 두세요.")
        return cls.open(BLANK_TEMPLATE)

    @classmethod
    def open(cls, path: str | Path) -> "HwpxDocument":
        with zipfile.ZipFile(path) as archive:
            parts: OrderedDict[str, _Part] = OrderedDict()
            for info in archive.infolist():
                raw = archive.read(info.filename)
                xml = info.filename.endswith((".xml", ".hpf"))
                parts[info.filename] = _Part(info.filename, raw=None if xml else raw,
                                             element=etree.fromstring(raw) if xml else None)
        return cls(parts)

    def list_part_paths(self) -> list[str]:
        return list(self._parts)

    def get_part(self, path: str) -> _Part:
        return self._parts[path]

    def remove_part(self, path: str) -> None:
        self._parts.pop(path, None)

    def _section_path(self, section_index: int) -> str:
        return f"Contents/section{section_index}.xml"

    def _section(self, section_index: int) -> _Part:
        return self.get_part(self._section_path(section_index))

    def _paragraphs(self, section_index: int) -> list[etree._Element]:
        return [node for node in self._section(section_index).element
                if isinstance(node.tag, str) and _local(node) == "p"]

    def paragraph_count(self, section_index: int = 0) -> int:
        return len(self._paragraphs(section_index))

    def set_paragraph_style(self, paragraph_index: int, *, section_index: int = 0,
                            para_pr_id: str | None = None,
                            char_pr_id: str | None = None) -> None:
        """이미 있는 문단의 문단·글자 모양을 바꾼다(골격 문단에 이어 쓸 때 필요)."""
        paragraph = self._paragraphs(section_index)[paragraph_index]
        if para_pr_id is not None:
            paragraph.set("paraPrIDRef", str(para_pr_id))
        for run in paragraph.iter(qn("hp", "run")):
            # 구역 정의(secPr)를 안고 있는 run 은 건드리지 않는다 — 글자 모양을 바꿀
            # 대상이 아니고, 잘못 손대면 쪽 설정이 흔들린다.
            if any(_local(child) == "secPr" for child in run):
                continue
            if char_pr_id is not None:
                run.set("charPrIDRef", str(char_pr_id))
        self._section(section_index).mark_modified()

    def first_paragraph_is_empty(self, section_index: int = 0) -> bool:
        """골격의 첫 문단이 '구역 정의만 있고 글은 비어 있는' 상태인가.

        한글이 저장한 빈 문서의 첫 문단은 `secPr`(구역·쪽 정의)를 안고 있다. 지우면
        문서가 깨지고, 그냥 두면 맨 위에 빈 줄이 남는다. 그래서 여기에 첫 글을 이어 쓴다.
        """
        paragraphs = self._paragraphs(section_index)
        if not paragraphs:
            return False
        text = "".join(node.text or "" for node in paragraphs[0].iter(qn("hp", "t")))
        return not text.strip()

    def append_paragraph(self, text: str, *, section_index: int = 0,
                         para_pr_id: str | None = None, style_id: str | None = None,
                         char_pr_id: str | None = None, with_run: bool = True) -> XmlNode:
        """빈 문단을 하나 잇는다.

        `with_run=False` 면 **글자 run 을 만들지 않는다.** 곧바로 다른 run 을 붙일
        자리에 쓴다 — 그러지 않으면 빈 `<hp:t/>` run 이 앞에 남는다. 실물 시험지의
        문항 문단은 번호 run 으로 바로 시작하므로 그 모양을 맞추려는 것이다.
        """
        section = self._section(section_index)
        paragraph = etree.SubElement(section.element, qn("hp", "p"))
        paragraph.attrib.update({"id": str(self.paragraph_count(section_index) - 1),
                                 "paraPrIDRef": str(para_pr_id or "0"),
                                 "styleIDRef": str(style_id or "0"),
                                 "pageBreak": "0", "columnBreak": "0", "merged": "0"})
        if with_run:
            run = etree.SubElement(paragraph, qn("hp", "run"), charPrIDRef=str(char_pr_id or "0"))
            etree.SubElement(run, qn("hp", "t")).text = text
        section.mark_modified()
        return XmlNode(paragraph, section)

    def _target_paragraph(self, section_index: int, paragraph_index: int | None,
                          char_pr_id: str | None) -> etree._Element:
        paragraphs = self._paragraphs(section_index)
        if not paragraphs:
            self.append_paragraph("", section_index=section_index, char_pr_id=char_pr_id)
            paragraphs = self._paragraphs(section_index)
        return paragraphs[paragraph_index if paragraph_index is not None else -1]

    def _append_run(self, section_index: int, paragraph_index: int | None,
                    char_pr_id: str | None) -> etree._Element:
        paragraph = self._target_paragraph(section_index, paragraph_index, char_pr_id)
        return etree.SubElement(paragraph, qn("hp", "run"), charPrIDRef=str(char_pr_id or "0"))

    def append_run_xml(self, xml: str | bytes, *, section_index: int = 0,
                       paragraph_index: int | None = None, char_pr_id: str | None = None) -> XmlNode:
        run = self._append_run(section_index, paragraph_index, char_pr_id)
        node = etree.fromstring(xml.encode("utf-8") if isinstance(xml, str) else xml)
        run.append(node)
        part = self._section(section_index)
        part.mark_modified()
        return XmlNode(node, part)

    def _append_equation(self, script: str, *, section_index: int, paragraph_index: int | None,
                         char_pr_id: str | None, base_unit: int, width: int, height: int) -> None:
        run = self._append_run(section_index, paragraph_index, char_pr_id)
        self._control += 1
        eq = etree.SubElement(run, qn("hp", "equation"), id=str(self._control), zOrder=str(self._control),
                              numberingType="EQUATION", textWrap="TOP_AND_BOTTOM", textFlow="BOTH_SIDES",
                              lock="0", dropcapstyle="None", version="Equation Version 60", baseLine="93",
                              textColor="#000000", baseUnit=str(base_unit), lineMode="CHAR", font="HYhwpEQ")
        etree.SubElement(eq, qn("hp", "sz"), width=str(width), widthRelTo="ABSOLUTE",
                         height=str(height), heightRelTo="ABSOLUTE", protect="0")
        etree.SubElement(eq, qn("hp", "pos"), treatAsChar="1", affectLSpacing="0", flowWithText="1",
                         allowOverlap="0", holdAnchorAndSO="0", vertRelTo="PARA", horzRelTo="COLUMN",
                         vertAlign="TOP", horzAlign="LEFT", vertOffset="0", horzOffset="0")
        etree.SubElement(eq, qn("hp", "outMargin"), left="0", right="0", top="0", bottom="0")
        script_node = etree.SubElement(eq, qn("hp", "script"))
        script_node.set(XML_SPACE, "preserve")
        script_node.text = script
        self._section(section_index).mark_modified()

    def append_equation(self, script: str, *, section_index: int = 0, paragraph_index: int | None = None,
                        char_pr_id: str | None = None, base_unit: int = 1100,
                        width: int = 4800, height: int = 2300, **_: object) -> None:
        self._append_equation(script, section_index=section_index, paragraph_index=paragraph_index,
                              char_pr_id=char_pr_id, base_unit=base_unit, width=width, height=height)

    def append_inline_equation(self, script: str, **kwargs: object) -> None:
        self.append_equation(script, **kwargs)

    def append_picture(self, name: str, data: bytes, *, section_index: int = 0,
                       paragraph_index: int | None = None, char_pr_id: str | None = None,
                       width: int = 7200, height: int = 7200, **_: object) -> None:
        clean = Path(name).name
        stem, suffix = Path(clean).stem or "image", Path(clean).suffix
        i, candidate = 2, clean
        while f"BinData/{candidate}" in self._parts:
            candidate = f"{stem}_{i}{suffix}"; i += 1
        manifest_id = self._manifest_id(stem)
        self._parts[f"BinData/{candidate}"] = _Part(f"BinData/{candidate}", raw=data)
        hpf = self.get_part("Contents/content.hpf")
        manifest = hpf.element.find("opf:manifest", namespaces=NS)
        etree.SubElement(manifest, qn("opf", "item"), id=manifest_id, href=f"BinData/{candidate}",
                         **{"media-type": mimetypes.guess_type(candidate)[0] or "application/octet-stream",
                            "isEmbeded": "1"})
        hpf.mark_modified()
        run = self._append_run(section_index, paragraph_index, char_pr_id)
        self._control += 1
        pic = etree.SubElement(run, qn("hp", "pic"), id=str(self._control), zOrder=str(self._control),
                               numberingType="PICTURE", textWrap="TOP_AND_BOTTOM", textFlow="BOTH_SIDES",
                               lock="0", dropcapstyle="None", href="", groupLevel="0", instid=str(self._control), reverse="0")
        etree.SubElement(pic, qn("hp", "offset"), x="0", y="0")
        etree.SubElement(pic, qn("hp", "orgSz"), width=str(width), height=str(height))
        etree.SubElement(pic, qn("hp", "curSz"), width=str(width), height=str(height))
        etree.SubElement(pic, qn("hp", "flip"), horizontal="0", vertical="0")
        etree.SubElement(pic, qn("hp", "rotationInfo"), angle="0", centerX=str(width // 2),
                         centerY=str(height // 2), rotateimage="1")
        render = etree.SubElement(pic, qn("hp", "renderingInfo"))
        for tag in ("transMatrix", "rotMatrix"):
            etree.SubElement(render, qn("hc", tag), e1="1", e2="0", e3="0", e4="0", e5="1", e6="0")
        etree.SubElement(render, qn("hc", "scaMatrix"), e1="1.000000", e5="1.000000")
        etree.SubElement(pic, qn("hc", "img"), binaryItemIDRef=manifest_id, bright="0", contrast="0", effect="REAL_PIC", alpha="0")
        rect = etree.SubElement(pic, qn("hp", "imgRect"))
        for n, (x, y) in enumerate(((0, 0), (width, 0), (width, height), (0, height))):
            etree.SubElement(rect, qn("hc", f"pt{n}"), x=str(x), y=str(y))
        etree.SubElement(pic, qn("hp", "imgClip"), left="0", right=str(width), top="0", bottom=str(height))
        etree.SubElement(pic, qn("hp", "inMargin"), left="0", right="0", top="0", bottom="0")
        etree.SubElement(pic, qn("hp", "imgDim"), dimwidth=str(width), dimheight=str(height))
        etree.SubElement(pic, qn("hp", "effects"))
        etree.SubElement(pic, qn("hp", "sz"), width=str(width), widthRelTo="ABSOLUTE", height=str(height), heightRelTo="ABSOLUTE", protect="0")
        etree.SubElement(pic, qn("hp", "pos"), treatAsChar="1", affectLSpacing="0", flowWithText="1", allowOverlap="0", holdAnchorAndSO="0", vertRelTo="PARA", horzRelTo="COLUMN", vertAlign="TOP", horzAlign="LEFT", vertOffset="0", horzOffset="0")
        etree.SubElement(pic, qn("hp", "outMargin"), left="0", right="0", top="0", bottom="0")
        self._section(section_index).mark_modified()

    def add_border_fill(self, *, border_type: str = "SOLID", width: str = "0.12 mm",
                        color: str = "#000000") -> str:
        """테두리 정의를 하나 더해 그 id 를 준다.

        ⚠️ 한글이 저장한 빈 문서의 `borderFills` 에는 **테두리가 없는 것만** 들어 있다
           (id 1·2 둘 다 `NONE`). 그것을 표 칸에 그대로 쓰면 **선이 보이지 않는 표**가
           나온다. 표를 그리려면 실선 정의를 이렇게 새로 만들어 써야 한다.
        """
        head = self.get_part("Contents/header.xml")
        fills = head.root.find(".//hh:borderFills")
        if fills is None:
            raise RuntimeError("HWPX header.xml 에 borderFills 가 없습니다")
        used = {int(child.get_attr("id")) for child in fills.children
                if child.local_name == "borderFill" and child.get_attr("id")}
        new_id = str(max(used) + 1 if used else 1)
        sides = "".join(
            f'<hh:{side} type="{border_type}" width="{width}" color="{color}"/>'
            for side in ("leftBorder", "rightBorder", "topBorder", "bottomBorder"))
        fills.append_xml(
            f'<hh:borderFill xmlns:hh="{NS["hh"]}" id="{new_id}" threeD="0" shadow="0" '
            'centerLine="NONE" breakCellSeparateLine="0">'
            '<hh:slash type="NONE" Crooked="0" isCounter="0"/>'
            '<hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
            f'{sides}'
            f'<hh:diagonal type="SOLID" width="{width}" color="{color}"/>'
            # 실물 borderFill 에는 채우기 정의가 함께 있다. 없으면 한글이 배경을
            # 어떻게 칠할지 정하지 못한다.
            f'<hc:fillBrush xmlns:hc="{NS["hc"]}">'
            '<hc:winBrush faceColor="none" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
            '</hh:borderFill>')
        fills.set_attr("itemCnt", str(len(used) + 1))
        head.mark_modified()
        return new_id

    def append_table(self, rows: list[list[str]], *, section_index: int = 0,
                     paragraph_index: int | None = None, char_pr_id: str | None = None,
                     header: bool = True, header_char_pr_id: str | None = None,
                     body_char_pr_id: str | None = None,
                     col_width: int = 16_000, row_height: int = 1_800,
                     table_border_fill_id: str = "1",
                     cell_border_fill_id: str = "2") -> None:
        """행렬로 정리된 텍스트 표를 문단 하나(표 컨트롤)로 삽입한다.

        칸마다 글 하나만 담는다 — 칸 병합, 칸 안 여러 문단, 칸 안 인라인 수식은 아직
        지원하지 않는다(옮겨 온 참고 구조에 있는 기능이지만, 문항 조판에 필요한 만큼만
        가져왔다). 필요해지면 `cell_texts` 자리에 조각을 더 흘려 넣으면 된다.

        ⚠️ `cell_border_fill_id` 를 주지 않으면 **선이 보이지 않는 표**가 된다 —
           한글의 빈 문서에 들어 있는 테두리 정의는 전부 `NONE` 이기 때문이다.
           실선을 쓰려면 `add_border_fill()` 로 만든 id 를 넘길 것.
           없는 id 를 가리키면 한글이 문서를 아예 못 읽는다(실물 파일의 borderFill
           id 는 1부터 시작하고 0 은 없다).
        """
        row_count, col_count = len(rows), len(rows[0])
        run = self._append_run(section_index, paragraph_index, char_pr_id)
        self._control += 1
        cid = str(self._control)
        table = etree.SubElement(run, qn("hp", "tbl"), id=cid, zOrder=cid, numberingType="TABLE",
                                 textWrap="TOP_AND_BOTTOM", textFlow="BOTH_SIDES", lock="0",
                                 dropcapstyle="None", pageBreak="CELL", repeatHeader="1",
                                 rowCnt=str(row_count), colCnt=str(col_count), cellSpacing="0",
                                 borderFillIDRef=table_border_fill_id, noAdjust="0")
        width = col_width * col_count
        etree.SubElement(table, qn("hp", "sz"), width=str(width), widthRelTo="ABSOLUTE",
                         height=str(row_height * row_count), heightRelTo="ABSOLUTE", protect="0")
        etree.SubElement(table, qn("hp", "pos"), treatAsChar="1", affectLSpacing="0",
                         flowWithText="1", allowOverlap="0", holdAnchorAndSO="0", vertRelTo="PARA",
                         horzRelTo="COLUMN", vertAlign="TOP", horzAlign="LEFT", vertOffset="0",
                         horzOffset="0")
        etree.SubElement(table, qn("hp", "outMargin"), left="0", right="0", top="0", bottom="0")
        etree.SubElement(table, qn("hp", "inMargin"), left="141", right="141", top="141", bottom="141")
        for r, row in enumerate(rows):
            tr = etree.SubElement(table, qn("hp", "tr"))
            for c, text in enumerate(row):
                is_header = header and r == 0
                cell_char = (header_char_pr_id if is_header else body_char_pr_id) or char_pr_id or "0"
                tc = etree.SubElement(tr, qn("hp", "tc"), name="",
                                      header="1" if is_header else "0", hasMargin="0",
                                      protect="0", editable="0", dirty="0",
                                      borderFillIDRef=cell_border_fill_id)
                sub_list = etree.SubElement(tc, qn("hp", "subList"), id="", textDirection="HORIZONTAL",
                                            lineWrap="BREAK", vertAlign="CENTER", linkListIDRef="0",
                                            linkListNextIDRef="0", textWidth="0", textHeight="0",
                                            hasTextRef="0", hasNumRef="0")
                self._cell_para += 1
                cell_p = etree.SubElement(sub_list, qn("hp", "p"), id=str(self._cell_para),
                                          paraPrIDRef="0", styleIDRef="0", pageBreak="0",
                                          columnBreak="0", merged="0")
                cell_run = etree.SubElement(cell_p, qn("hp", "run"), charPrIDRef=cell_char)
                etree.SubElement(cell_run, qn("hp", "t")).text = text
                etree.SubElement(tc, qn("hp", "cellAddr"), colAddr=str(c), rowAddr=str(r))
                etree.SubElement(tc, qn("hp", "cellSpan"), colSpan="1", rowSpan="1")
                etree.SubElement(tc, qn("hp", "cellSz"), width=str(col_width), height=str(row_height))
                etree.SubElement(tc, qn("hp", "cellMargin"), left="141", right="141", top="141",
                                 bottom="141")
        self._section(section_index).mark_modified()

    def _manifest_id(self, preferred: str) -> str:
        ids = {node.get("id") for node in self.get_part("Contents/content.hpf").element.xpath(".//opf:item", namespaces=NS)}
        value, i = preferred or "image", 2
        while value in ids:
            value = f"{preferred}_{i}"; i += 1
        return value

    def xml_validation_errors(self) -> list[str]:
        return []

    def stale_paragraph_layout_validation_errors(self) -> list[str]:
        return []

    def validation_errors(self) -> list[str]:
        required = {"mimetype", "version.xml", "Contents/content.hpf", "Contents/header.xml", "Contents/section0.xml"}
        return [f"missing {path}" for path in sorted(required - set(self._parts))]

    # ⚠️ 한글은 문서 안의 id 참조가 하나라도 끊어져 있으면 **어디가 문제인지 말하지 않고**
    #    "파일을 읽거나 저장하는데 문제가 있습니다" 라고만 한다. 실제로 그것 때문에
    #    한 번 막혔다 — 빈 문서에 fontfaces·borderFills·tabProperties 표가 아예 없어서
    #    charPr 의 fontRef, paraPr 의 tabPrIDRef, 표의 borderFillIDRef 가 전부 허공을
    #    가리키고 있었다. XML 자체는 잘 정형화돼 있어 파서로는 잡히지 않는다.
    #    그래서 참조가 실제로 존재하는지를 여기서 직접 센다.
    #
    # (본문 → 머리글) 참조: 어떤 태그의 어떤 속성이 header.xml 의 어느 표를 가리키는가.
    _SECTION_REFS = (
        ("run", "charPrIDRef", "charProperties", "charPr"),
        ("p", "paraPrIDRef", "paraProperties", "paraPr"),
        ("p", "styleIDRef", "styles", "style"),
        ("tbl", "borderFillIDRef", "borderFills", "borderFill"),
        ("tc", "borderFillIDRef", "borderFills", "borderFill"),
    )
    # (머리글 → 머리글) 참조.
    _HEADER_REFS = (
        ("paraPr", "tabPrIDRef", "tabProperties", "tabPr"),
        ("style", "paraPrIDRef", "paraProperties", "paraPr"),
        ("style", "charPrIDRef", "charProperties", "charPr"),
    )

    def _header_ids(self, collection: str, item: str) -> set[str] | None:
        """머리글의 참조 표에 실제로 있는 id 들. 표 자체가 없으면 None."""
        head = self.get_part("Contents/header.xml").element
        node = head.find(f".//hh:{collection}", namespaces=NS)
        if node is None:
            return None
        return {child.get("id") for child in node
                if _local(child) == item and child.get("id") is not None}

    def item_count_errors(self) -> list[str]:
        """참조표의 `itemCnt` 가 실제 자식 수와 맞는가.

        ⚠️ **오늘 한글이 문서를 못 열었던 진짜 원인이 이것이었다.**
           `<styles itemCnt="1"/>` 라고 **선언만 하고 안이 비어 있었고**, 본문의 모든
           문단은 `styleIDRef="0"` 으로 그 없는 스타일을 가리키고 있었다.
           XML 문법은 완벽해서 파서로는 절대 잡히지 않는다. 개수를 세어야 보인다.
        """
        head = self.get_part("Contents/header.xml").element
        errors = []
        for collection, item in (("fontfaces", "fontface"), ("borderFills", "borderFill"),
                                 ("charProperties", "charPr"), ("tabProperties", "tabPr"),
                                 ("numberings", "numbering"), ("paraProperties", "paraPr"),
                                 ("styles", "style"), ("bullets", "bullet")):
            node = head.find(f".//hh:{collection}", namespaces=NS)
            if node is None:
                continue
            declared = node.get("itemCnt")
            actual = sum(1 for child in node if _local(child) == item)
            if declared is not None and int(declared) != actual:
                errors.append(f"{collection} 의 itemCnt 는 {declared} 인데 실제 {item} 은 "
                              f"{actual}개입니다 — 선언과 내용이 다르면 한글이 문서를 열지 못합니다")
            # ⚠️ KS X 6101(OWPML) 9.3.2.1 — `itemCnt` 는 **positiveInteger** 다.
            #    "문서 내에서 글꼴 정보는 반드시 1개 이상 정의되어 있어야 한다. 내용이 없는
            #     문서라도 기본 글꼴 정보는 정의되어 있어야 한다. … itemCnt 의 값으로 올 수
            #     있는 범위가 1 이상으로(positiveInteger) 제한되어 있으며"
            #    즉 **빈 표(`itemCnt="0"`)를 자리만 만들어 두면 규격 위반**이다. 쓰지 않는
            #    표는 아예 넣지 말아야 한다. 예전에 `numberings itemCnt="0"` 을 자리만
            #    채워 넣었다가 한글이 문서를 열지 못했다.
            if declared is not None and int(declared) < 1:
                errors.append(f"{collection} 의 itemCnt 가 {declared} 입니다 — 규격(KS X 6101)은 "
                              "1 이상만 허용합니다. 쓰지 않는 표는 빈 채로 두지 말고 빼야 합니다")
        return errors

    def reference_warnings(self) -> list[str]:
        """오류는 아니지만 의심스러운 참조.

        ⚠️ 참조표가 통째로 없는데 가리키는 경우는 **오류로 보지 않는다.** 다른 구현
           (jakal-hwpx)이 `paraPr tabPrIDRef="0"` 을 둔 채 `tabProperties` 표 없이
           내보내는데 한글이 멀쩡히 연다 — 직접 확인했다. 오류로 막으면 정상 문서를
           거부하게 된다. 그래서 알리기만 한다.
        """
        warnings = []
        for scope, refs, prefix in (("본문", self._SECTION_REFS, "hp"),
                                    ("머리글", self._HEADER_REFS, "hh")):
            for tag, attribute, collection, item in refs:
                if self._header_ids(collection, item) is not None:
                    continue
                roots = ([self.get_part(x).element for x in self.list_part_paths()
                          if x.startswith("Contents/section") and x.endswith(".xml")]
                         if scope == "본문" else [self.get_part("Contents/header.xml").element])
                for root in roots:
                    if any(node.get(attribute) is not None for node in root.iter(qn(prefix, tag))):
                        warnings.append(f"{scope}의 <{tag} {attribute}> 가 가리키는 "
                                        f"{collection} 표가 문서에 없습니다")
                        break
        return sorted(set(warnings))

    def reference_validation_errors(self) -> list[str]:
        hpf = self.get_part("Contents/content.hpf").element
        errors = [f"manifest references missing part: {node.get('href')}"
                  for node in hpf.xpath(".//opf:item", namespaces=NS)
                  if node.get("href") not in self._parts]
        errors += self.item_count_errors()

        tables: dict[str, set[str] | None] = {}
        for _, _, collection, item in self._SECTION_REFS + self._HEADER_REFS:
            if collection not in tables:
                tables[collection] = self._header_ids(collection, item)

        def check(scope: str, root, refs) -> None:
            for tag, attribute, collection, _ in refs:
                known = tables[collection]
                if known is None:
                    continue          # 표가 통째로 없는 것은 경고로만 본다(위 참고)
                for node in root.iter(qn("hp" if scope == "본문" else "hh", tag)):
                    value = node.get(attribute)
                    if value is not None and value not in known:
                        errors.append(f"{scope}의 <{tag} {attribute}=\"{value}\">가 "
                                      f"{collection} 에 없는 id 를 가리킵니다")

        for path in self.list_part_paths():
            if path.startswith("Contents/section") and path.endswith(".xml"):
                check("본문", self.get_part(path).element, self._SECTION_REFS)
        head = self.get_part("Contents/header.xml").element
        check("머리글", head, self._HEADER_REFS)

        # 글꼴 참조는 위 규칙에 안 맞는다 — `<hh:fontRef hangul="0" latin="0" .../>` 처럼
        # **언어마다 속성이 따로** 있고, 각각 그 언어의 `<hh:fontface lang="...">` 안
        # font id 를 가리킨다. 원래 깨져 있던 것이 정확히 이 참조였으므로 따로 센다.
        faces = head.find(".//hh:fontfaces", namespaces=NS)
        by_lang: dict[str, set[str]] | None = None
        if faces is not None:
            by_lang = {}
            for face in faces:
                if _local(face) != "fontface":
                    continue
                by_lang[(face.get("lang") or "").upper()] = {
                    font.get("id") for font in face if _local(font) == "font"}
        for ref in head.iter(qn("hh", "fontRef")):
            for lang, value in ref.attrib.items():
                if by_lang is None:
                    continue          # 표가 통째로 없는 것은 경고로만 본다
                if value not in by_lang.get(lang.upper(), set()):
                    errors.append(f"머리글의 <fontRef {lang}=\"{value}\">가 "
                                  f"fontface lang={lang.upper()} 에 없는 글꼴을 가리킵니다")

        # 같은 원인이 수십 번 반복되면 읽기 어렵다. 종류별로 한 줄씩만 남긴다.
        seen, unique = set(), []
        for message in errors:
            if message in seen:
                continue
            seen.add(message)
            unique.append(message)
        return unique

    def strict_lint_errors(self) -> list[str]:
        return []

    def strict_validate(self) -> None:
        errors = self.validation_errors() + self.reference_validation_errors()
        if errors:
            raise ValueError("; ".join(errors))

    def save(self, path: str | Path, **_: object) -> Path:
        self.strict_validate()
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(out, "w") as archive:
            for name, part in self._parts.items():
                info = zipfile.ZipInfo(name)
                info.compress_type = zipfile.ZIP_STORED if name == "mimetype" else zipfile.ZIP_DEFLATED
                archive.writestr(info, part.to_bytes())
        return out

