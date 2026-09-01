"""범용 문서 JSON 계약과 내부 HWPX 내보내기 회귀 검사."""

from __future__ import annotations

import re
import sys
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from document_schema import DocumentValidationError, validate  # noqa: E402
import document_to_hwpx  # noqa: E402


SAMPLE = {
    "version": 1,
    "title": "미적분 과제 보고서",
    "blocks": [
        {"type": "heading", "level": 1, "text": "1. 함수의 변화"},
        {"type": "paragraph", "text": "함수 $f(x)=x^2$의 도함수는 $f'(x)=2x$이다."},
        {"type": "equation", "text": "$$\\int_0^1 x^2\\,dx=\\frac{1}{3}$$"},
        {"type": "bullets", "items": ["증가·감소 구간을 확인한다.", "극값을 해석한다."]},
        {"type": "numbered", "items": ["계산 과정을 적는다.", "결론을 문장으로 쓴다."]},
        {"type": "quote", "text": "결과는 정의역 안에서 해석해야 한다."},
    ],
}


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


doc = validate(SAMPLE)
check(doc.title == SAMPLE["title"], "정상 문서가 계약을 통과해야 합니다")
try:
    validate({"title": "x", "blocks": [{"type": "rawXml", "text": "<hp:p/>"}]})
except DocumentValidationError:
    pass
else:
    raise AssertionError("지원하지 않는 raw XML 블록은 거절해야 합니다")

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "document.hwpx"
    report = document_to_hwpx.build(SAMPLE, out)
    check(out.exists(), "범용 문서 HWPX가 생성돼야 합니다")
    check(report.equations == 3, "인라인 2개와 별행 수식 1개를 모두 출력해야 합니다")
    with zipfile.ZipFile(out) as archive:
        names = set(archive.namelist())
        text = archive.read("Contents/section0.xml").decode("utf-8")
    check({"mimetype", "Contents/header.xml", "Contents/section0.xml"} <= names,
          "HWPX 기본 패키지가 완성돼야 합니다")
    check("미적분 과제 보고서" in text and "결과는 정의역" in text,
          "문서 글이 section XML에 남아야 합니다")
    check(text.count("equation") >= 3, "수식이 텍스트로 떨어지면 안 됩니다")


# ── 표 블록 ──────────────────────────────────────────────────────────────
TABLE_SAMPLE = {
    "title": "표 검사",
    "blocks": [
        {"type": "paragraph", "text": "표 앞 문단."},
        {"type": "table", "rows": [
            ["번호", "배점", "정답"],
            ["1", "3", "②"],
            ["2", "", "미채점"],
        ]},
        {"type": "paragraph", "text": "표 뒤 문단."},
    ],
}

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "table.hwpx"
    report = document_to_hwpx.build(TABLE_SAMPLE, out)
    text = zipfile.ZipFile(out).read("Contents/section0.xml").decode("utf-8")
    check("<hp:tbl" in text, "표가 hp:tbl 컨트롤로 나와야 합니다")
    check(text.count("<hp:tr") == 3, "행이 3개(머리글 포함) 있어야 합니다")
    check(text.count("<hp:tc") == 9, "칸이 3행×3열=9개 있어야 합니다")
    check("표 앞 문단" in text and "표 뒤 문단" in text,
          "표 앞뒤 문단이 잘리지 않고 함께 나와야 합니다")
    # 표 앞 문단이 표보다 먼저, 표 뒤 문단이 표보다 나중에 나오는지(순서 보존).
    check(text.index("표 앞 문단") < text.index("<hp:tbl") < text.index("표 뒤 문단"),
          "표 앞뒤 문단의 순서가 뒤바뀌면 안 됩니다")

    # ⚠️ 표 칸 문단(hp:p)은 본문 문단과 **전체 문서에서 겹치지 않는 id** 가 필요하다
    #    (pedagogy_hwpx.append_table() 의 docstring 참고 — 겹치면 실물 한글에서 표가
    #    깨지거나 칸이 서로 다른 문단을 가리킬 수 있다). 여기서 실제로 겹치지 않는지 잰다.
    para_ids = re.findall(r'<hp:p\b[^>]*\bid="(\d+)"', text)
    check(len(para_ids) == len(set(para_ids)),
          f"문단 id가 겹칩니다: {[i for i in para_ids if para_ids.count(i) > 1]}")

    # 헤더 행과 본문 행이 다른 글자 모양(char_table_header vs char_table_body)을 쓰는지.
    rows_xml = re.findall(r"<hp:tr>.*?</hp:tr>", text, re.S)
    check(len(rows_xml) == 3, "표 행 3개를 다시 찾을 수 있어야 합니다")
    header_chars = set(re.findall(r'<hp:run charPrIDRef="(\d+)">', rows_xml[0]))
    body_chars = set(re.findall(r'<hp:run charPrIDRef="(\d+)">', rows_xml[1]))
    check(header_chars and body_chars and header_chars.isdisjoint(body_chars),
          f"머리글 행과 본문 행이 같은 글자 모양을 쓰면 안 됩니다 (머리글={header_chars}, 본문={body_chars})")

# ── 보기(ㄱㄴㄷ)·선지(①②③④⑤) 블록 ────────────────────────────────────
EXAM_SAMPLE = {"title": "문제지 검사", "blocks": [
    {"type": "examples", "items": ["$f(x)$는 연속이다.", "최댓값을 갖는다."]},
    {"type": "choices", "items": ["$\\dfrac12$", "$1$", "$\\dfrac32$", "$2$", "$3$"],
     "layout": "1"},
]}

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "exam.hwpx"
    report = document_to_hwpx.build(EXAM_SAMPLE, out)
    text = zipfile.ZipFile(out).read("Contents/section0.xml").decode("utf-8")

    check("ㄱ." in text and "ㄴ." in text, "보기 항목에 ㄱ·ㄴ 라벨이 붙어야 합니다")
    for mark in "①②③④⑤":
        check(mark in text, f"선지 라벨 {mark} 가 있어야 합니다")

    # ⚠️ **탭으로 이어 붙인 선지도 수식 변환을 타야 한다.** 예전에는 첫 선지만
    #    emit_rich 를 타서 분수로 나오고, 둘째부터 `$\dfrac32$` 가 달러 기호째
    #    글자로 찍혔다. 파일은 멀쩡히 열리므로 **눈으로 보기 전엔 모르는** 결함이다.
    check("$" not in text,
          f"선지 안 수식이 원문 그대로 남았습니다: {[w for w in text.split() if '$' in w][:3]}")
    # 보기 중 수식이 든 것 1개 + 선지 5개 = 6개.
    check(report.equations == 6, f"수식 6개가 나와야 합니다 (지금 {report.equations})")

    # 한 줄 배치는 **한 문단**에 탭으로 이어 붙어야 한다. 문단을 나누면 세로로 쌓인다.
    check(text.count("<hp:tab") >= 4, f"선지 사이에 탭이 있어야 합니다 ({text.count('<hp:tab')}개)")

# 배치 세 가지가 문단 수로 구분되는가
for layout, want in (("1", 1), ("2", 2), ("v", 5)):
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / f"{layout}.hwpx"
        document_to_hwpx.build({"title": "x", "blocks": [
            {"type": "choices", "items": list("abcde"), "layout": layout}]}, out)
        body = zipfile.ZipFile(out).read("Contents/section0.xml").decode("utf-8")
        rows = len(re.findall(r"①|④(?![^<]*⑤)", body)) if False else None
        marks_per_para = [len(re.findall(r"[①②③④⑤]", para))
                          for para in re.findall(r"<hp:p\b.*?</hp:p>", body, re.S)
                          if re.search(r"[①②③④⑤]", para)]
        check(len(marks_per_para) == want,
              f"layout={layout} 은 선지 문단이 {want}개여야 합니다 (지금 {len(marks_per_para)})")

# 계약이 거절해야 하는 것
for label, bad in [
    ("보기 7개(라벨은 ㄱ~ㅂ 뿐)", {"type": "examples", "items": ["a"] * 7}),
    ("선지 6개(라벨은 ①~⑤ 뿐)", {"type": "choices", "items": ["a"] * 6}),
    ("모르는 배치", {"type": "choices", "items": ["a"], "layout": "3"}),
]:
    try:
        validate({"title": "x", "blocks": [bad]})
    except DocumentValidationError:
        continue
    raise AssertionError(f"'{label}' 를 거절해야 합니다")


# ── 상자 블록 ────────────────────────────────────────────────────────────
BOX_SAMPLE = {"title": "상자 검사", "blocks": [
    {"type": "paragraph", "text": "상자 앞 문단."},
    {"type": "box", "label": "<보기>", "text": "첫째 줄.\n둘째 줄에 $x^2$ 수식.\n셋째 줄."},
    {"type": "paragraph", "text": "상자 뒤 문단."},
]}

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "box.hwpx"
    document_to_hwpx.build(BOX_SAMPLE, out)
    text = zipfile.ZipFile(out).read("Contents/section0.xml").decode("utf-8")
    head_text = zipfile.ZipFile(out).read("Contents/header.xml").decode("utf-8")

    check("<보기>" in text or "&lt;보기&gt;" in text, "상자 라벨이 나와야 합니다")
    check("첫째 줄" in text and "셋째 줄" in text, "상자의 모든 줄이 나와야 합니다")
    check(text.index("상자 앞 문단") < text.index("첫째 줄") < text.index("상자 뒤 문단"),
          "상자 앞뒤 문단의 순서가 뒤바뀌면 안 됩니다")

    # ⚠️ 상자 줄들은 **모두 같은 문단 모양**을 써야 한다. 줄마다 다르면 `connect="1"` 이
    #    작동하지 않아 **줄 수만큼 상자가 그려진다**(눈으로 보기 전엔 모르는 결함).
    box_paras = re.findall(r'<hp:p[^>]*paraPrIDRef="(\d+)"[^>]*>(?:(?!</hp:p>).)*?'
                           r'(?:첫째 줄|셋째 줄|보기)', text, re.S)
    check(box_paras and len(set(box_paras)) == 1,
          f"상자 줄들이 같은 문단 모양을 써야 합니다: {set(box_paras)}")

    # 그 문단 모양에 테두리가 실제로 붙어 있는가.
    box_pr = box_paras[0]
    m = re.search(rf'<hh:paraPr[^>]*\bid="{box_pr}"[^>]*>(?:(?!</hh:paraPr>).)*?'
                  r'<hh:border[^>]*borderFillIDRef="(\d+)"[^>]*connect="1"', head_text, re.S)
    check(m is not None,
          f"상자 문단(paraPr {box_pr})에 connect=\"1\" 인 테두리가 있어야 합니다")

    # 그 테두리가 '없음' 이 아니라 실선인가 — 선이 안 보이는 상자는 상자가 아니다.
    fill = re.search(rf'<hh:borderFill[^>]*\bid="{m.group(1)}"[^>]*>(?:(?!</hh:borderFill>).)*?'
                     r'<hh:leftBorder type="(\w+)"', head_text, re.S)
    check(fill is not None and fill.group(1) == "SOLID",
          f"상자 테두리가 실선이어야 합니다 (지금 {fill.group(1) if fill else '없음'})")

# 라벨은 선택이다.
no_label = validate({"title": "x", "blocks": [{"type": "box", "text": "내용"}]})
check(no_label.blocks[0]["label"] is None, "라벨 없는 상자도 되어야 합니다")


# ── 그림 블록 ────────────────────────────────────────────────────────────
# ⚠️ 그림은 **base64 로만** 받는다. `/document-hwpx` 는 "파일 경로도 임의 XML 도 받지
#    않는다" 를 보안 전제로 명시하고 있어, 경로를 받기 시작하면 그 전제가 깨진다.
import base64  # noqa: E402

FIGURE = HERE / "samples" / "images" / "fig14.png"
if FIGURE.exists():
    png = FIGURE.read_bytes()
    encoded = base64.b64encode(png).decode()
    IMAGE_SAMPLE = {"title": "그림 검사", "blocks": [
        {"type": "paragraph", "text": "그림 앞 문단."},
        {"type": "image", "data": encoded, "width": 60},
        {"type": "paragraph", "text": "그림 뒤 문단."},
    ]}
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "image.hwpx"
        document_to_hwpx.build(IMAGE_SAMPLE, out)
        with zipfile.ZipFile(out) as archive:
            names = archive.namelist()
            text = archive.read("Contents/section0.xml").decode("utf-8")
        check(any(n.startswith("BinData/") for n in names),
              f"그림이 BinData 에 들어가야 합니다: {names}")
        check("<hp:pic" in text, "그림이 hp:pic 컨트롤로 나와야 합니다")
        check(text.index("그림 앞 문단") < text.index("<hp:pic") < text.index("그림 뒤 문단"),
              "그림 앞뒤 문단의 순서가 뒤바뀌면 안 됩니다")

        # ⚠️ 높이를 원본 비율로 계산하지 않으면 그림이 늘어나거나 눌린다.
        #    눈으로 보기 전엔 모르는 종류라 값으로 확인한다(원본 400×300).
        m = re.search(r'<hp:sz width="(\d+)"[^>]*height="(\d+)"', text[text.index("<hp:pic"):])
        check(m is not None, "그림 크기를 찾을 수 없습니다")
        ratio = int(m.group(2)) / int(m.group(1))
        check(abs(ratio - 300 / 400) < 0.01,
              f"그림 비율이 원본과 다릅니다: {ratio:.3f} (원본 {300/400:.3f})")

    # 계약이 실제로 거절하는지 — 그림은 조용히 잘못 들어가면 문서가 아예 안 열린다.
    expect_rejected_image = [
        ("파일 경로", {"type": "image", "path": "/etc/passwd", "width": 60}),
        ("base64 아님", {"type": "image", "data": "이건 base64 가 아니다", "width": 60}),
        ("PNG/JPEG 아님", {"type": "image",
                           "data": base64.b64encode(b"MZ\x90\x00 not an image").decode(), "width": 60}),
        ("너무 넓음", {"type": "image", "data": encoded, "width": 500}),
        ("너무 좁음", {"type": "image", "data": encoded, "width": 1}),
        ("width 가 숫자 아님", {"type": "image", "data": encoded, "width": "60mm"}),
    ]
    for label, bad in expect_rejected_image:
        try:
            validate({"title": "x", "blocks": [bad]})
        except DocumentValidationError:
            continue
        raise AssertionError(f"그림 계약이 '{label}' 를 거절해야 합니다")

    # width 를 안 주면 기본값이 들어가야 한다(필수로 만들면 쓰기 번거롭다).
    defaulted = validate({"title": "x", "blocks": [{"type": "image", "data": encoded}]})
    check(defaulted.blocks[0]["width"] > 0, "width 기본값이 있어야 합니다")


# ── 빈 문서 골격 ─────────────────────────────────────────────────────────
# ⚠️ 한글은 문서 안의 무언가가 어긋나면 **어디가 문제인지 말하지 않고**
#    "파일을 읽거나 저장하는데 오류가 있습니다" 라고만 한다. 실제로 그것 때문에 막혔다 —
#    골격을 코드로 지어 만들었더니 XML 문법은 완벽하고 우리 검증도 전부 통과하는데
#    한글이 열지 못했다. 빠진 것을 하나씩 맞히다 끝이 없어서, **한글이 직접 저장한 빈
#    문서**를 골격으로 쓰는 쪽으로 바꿨다(`pedagogy_hwpx.blank()` 의 설명 참고).
#    그 골격 파일이 사라지거나 프로그램으로 다시 만들어지면 같은 일이 반복된다.
from pedagogy_hwpx import BLANK_TEMPLATE, HwpxDocument, NS  # noqa: E402

check(BLANK_TEMPLATE.exists(),
      f"빈 문서 골격이 있어야 합니다: {BLANK_TEMPLATE} — 한글에서 새 문서를 "
      "'한글 표준 문서(*.hwpx)'로 저장해 넣으세요")

blank = HwpxDocument.blank()
# 한글이 만든 골격에만 있고 우리가 지어 만들 때 빠뜨렸던 것들. 이게 없으면 안 열린다.
for required in ("META-INF/manifest.xml", "META-INF/container.rdf",
                 "Contents/header.xml", "Contents/section0.xml", "Contents/content.hpf"):
    check(required in blank.list_part_paths(),
          f"골격에 {required} 가 있어야 합니다 (한글이 저장한 파일을 쓰고 있는지 확인)")

head_element = blank.get_part("Contents/header.xml").element
for collection in ("fontfaces", "borderFills", "charProperties", "tabProperties",
                   "numberings", "paraProperties", "styles"):
    check(head_element.find(f".//hh:{collection}", namespaces=NS) is not None,
          f"골격 머리글에 {collection} 참조표가 있어야 합니다")

# 골격에 개인정보(저장한 사람·시각)가 남아 있으면 안 된다 — 저장소에 올리는 파일이다.
hpf_text = blank.get_part("Contents/content.hpf").to_bytes().decode("utf-8")
for leaked in ("huryul", "2026-08-31T"):
    check(leaked not in hpf_text, f"골격에 개인정보가 남아 있습니다: {leaked!r}")

# ── 참조 무결성 ──────────────────────────────────────────────────────────
blank.append_paragraph("본문")
blank.append_table([["a", "b"], ["1", "2"]], cell_border_fill_id=blank.add_border_fill())
check(not blank.reference_validation_errors(),
      f"골격의 참조가 끊겨 있습니다: {blank.reference_validation_errors()[:3]}")

# ── itemCnt 가 실제 개수와 맞는가 ────────────────────────────────────────
# ⚠️ **오늘 한글이 문서를 못 열었던 진짜 원인이 이것이다.** `<styles itemCnt="1"/>` 라고
#    선언만 하고 안이 비어 있었고, 본문은 `styleIDRef="0"` 으로 그 없는 스타일을
#    가리켰다. XML 문법은 완벽해서 파서로는 절대 안 잡힌다 — 개수를 세어야 보인다.
for collection, item in (("styles", "style"), ("charProperties", "charPr"),
                         ("paraProperties", "paraPr"), ("borderFills", "borderFill")):
    probe = HwpxDocument.blank()
    node = probe.get_part("Contents/header.xml").element.find(f".//hh:{collection}", namespaces=NS)
    for child in [c for c in node if c.tag is not None]:
        node.remove(child)                      # itemCnt 는 그대로 두고 내용만 비운다
    messages = probe.item_count_errors()
    check(any(collection in m for m in messages),
          f"{collection} 를 비웠는데 itemCnt 불일치를 잡지 못했습니다: {messages}")

# ── 빈 표(itemCnt="0")는 규격 위반이다 ───────────────────────────────────
# KS X 6101(OWPML) 9.3.2.1: itemCnt 는 positiveInteger — 1 이상만 허용한다.
# "내용이 없는 문서라도 기본 글꼴 정보는 정의되어 있어야 한다."
# 예전에 쓰지도 않는 numberings 를 itemCnt="0" 으로 자리만 만들어 넣었다가
# 한글이 문서를 열지 못했다. 안 쓰는 표는 빼야 한다.
zero = HwpxDocument.blank()
zero_head = zero.get_part("Contents/header.xml").element
node = zero_head.find(".//hh:numberings", namespaces=NS)
if node is None:
    node = zero_head.find(".//hh:styles", namespaces=NS)
node.set("itemCnt", "0")
for child in [c for c in node if c.tag is not None]:
    node.remove(child)
check(any("1 이상" in m for m in zero.item_count_errors()),
      f"itemCnt=0 을 규격 위반으로 잡아야 합니다: {zero.item_count_errors()}")

# ── 참조표가 통째로 없는 것은 '오류' 가 아니라 '경고' 다 ─────────────────
# ⚠️ 다른 구현(jakal-hwpx)은 `tabProperties`·`fontfaces` 표 없이 `tabPrIDRef="0"` 을
#    둔 채 파일을 내보내는데 **한글이 멀쩡히 연다**(직접 확인했다). 이것을 오류로
#    막으면 정상 문서를 거부하게 된다. 알리되 막지는 않는다.
lenient = HwpxDocument.blank()
lenient_head = lenient.get_part("Contents/header.xml").element
for collection in ("fontfaces", "tabProperties"):
    node = lenient_head.find(f".//hh:{collection}", namespaces=NS)
    node.getparent().remove(node)
lenient.append_paragraph("본문")
check(not lenient.reference_validation_errors(),
      f"표가 없는 것만으로 거부하면 안 됩니다: {lenient.reference_validation_errors()}")
check(lenient.reference_warnings(), "표가 없으면 경고는 남겨야 합니다")

# 없는 id 를 가리키는 것도 잡아야 한다(표가 있기만 하면 통과하는 검사면 의미가 없다).
dangling = HwpxDocument.blank()
dangling.append_table([["a"]], cell_border_fill_id="99")
check(any("99" in message for message in dangling.reference_validation_errors()),
      "borderFills 에 없는 id 를 가리키는데 잡지 못했습니다")

# save() 가 깨진 문서를 아예 못 쓰게 막는지 — 검증이 있어도 저장 경로가 안 부르면 소용없다.
# 오늘 실제로 한글이 거부했던 그 모양(선언과 내용 불일치)으로 시험한다.
with tempfile.TemporaryDirectory() as tmp:
    broken = HwpxDocument.blank()
    node = broken.get_part("Contents/header.xml").element.find(".//hh:styles", namespaces=NS)
    for child in [c for c in node if c.tag is not None]:
        node.remove(child)
    try:
        broken.save(Path(tmp) / "broken.hwpx")
    except ValueError:
        pass
    else:
        raise AssertionError("선언과 내용이 다른 문서를 save() 가 그대로 써 버립니다")

# ── 표 테두리가 실제로 보이는가 ───────────────────────────────────────────
# 한글 빈 문서의 테두리 정의는 전부 '없음' 이라, 그것을 그대로 쓰면 **선이 안 보이는 표**가
# 나온다. 눈으로 보기 전엔 모르는 종류의 결함이라 여기서 값을 직접 확인한다.
bordered = HwpxDocument.blank()
fill_id = bordered.add_border_fill()
fills = bordered.get_part("Contents/header.xml").element.find(".//hh:borderFills", namespaces=NS)
made = [f for f in fills if f.get("id") == fill_id]
check(made, f"add_border_fill() 이 만든 id {fill_id} 를 찾을 수 없습니다")
left = made[0].find("hh:leftBorder", namespaces=NS)
check(left is not None and left.get("type") == "SOLID",
      f"표 칸 테두리가 실선이어야 합니다 (지금: {left.get('type') if left is not None else '없음'})")


# ── 표 계약이 실제로 무언가를 거절하는가(일부러 깨뜨려 확인) ────────────────
def expect_rejected(label: str, bad_doc: dict) -> None:
    try:
        validate(bad_doc)
    except DocumentValidationError:
        return
    raise AssertionError(f"{label}: 거절해야 하는데 통과했습니다")


expect_rejected("들쭉날쭉한 열", {"title": "x", "blocks": [
    {"type": "table", "rows": [["a", "b"], ["c"]]}]})
expect_rejected("표 칸 안 수식", {"title": "x", "blocks": [
    {"type": "table", "rows": [["$x$", "b"]]}]})
expect_rejected("빈 rows", {"title": "x", "blocks": [{"type": "table", "rows": []}]})
expect_rejected("열 초과", {"title": "x", "blocks": [{"type": "table", "rows": [["c"] * 13]}]})
expect_rejected("행 초과", {"title": "x", "blocks": [{"type": "table", "rows": [["a"]] * 41}]})

# 빈 칸은 표에서 정상이다 — paragraph/heading의 _text()는 빈 문자열을 거절하지만
# 표 칸은 _cell_text()를 써서 허용해야 한다. 여기서 반대로 확인한다: 이 문서가
# *통과해야* 이 계약이 표 칸을 문단과 다르게 다루고 있다는 뜻이다.
empty_cell_doc = validate({"title": "x", "blocks": [{"type": "table", "rows": [["a", ""], ["", "b"]]}]})
check(empty_cell_doc.blocks[0]["rows"] == [["a", ""], ["", "b"]],
      "표의 빈 칸은 허용돼야 합니다(문단의 빈 글과는 다른 규칙)")

print("범용 문서 HWPX 검사 통과")
