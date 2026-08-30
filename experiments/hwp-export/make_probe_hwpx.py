"""HWPX 실험 파일 생성기 (베타).

왜 HWP 가 아니라 HWPX 인가
--------------------------
HWP(바이너리)는 레코드마다 크기·개수 필드가 있어 하나만 어긋나도 문서 전체가 깨진다.
HWPX 는 ZIP + XML 이라 그런 카운터가 없고, jakal-hwpx 의 검증기도 HWPX 쪽이 훨씬 두껍다
(`strict_validate`, `xml_validation_errors`, `stale_paragraph_layout_validation_errors` …).

줄 나눔 캐시에 대해 알아낸 것
-----------------------------
jakal-hwpx 는 이 문제를 이미 알고 있고, 진단 문구가 답을 알려 준다:

    "Plain-text paragraph carries linesegarray text positions beyond the text length;
     Hancom may drop following content."

즉 **한글은 낡은 `linesegarray` 가 남아 있으면 뒤 내용을 버린다.** 해결책은 캐시를
'맞게 고치는' 것이 아니라 **아예 빼는 것**이다(`repair_stale_paragraph_layout` 이 그렇게 한다).
그래서 여기서는 처음부터 `linesegarray` 를 만들지 않고, 저장 전에 검증기로 남은 것이
없는지 확인한다.

    python3 make_probe_hwpx.py [내보낼 폴더]
"""

from __future__ import annotations

import sys

from pathlib import Path

from jakal_hwpx import HwpxDocument

HH = "http://www.hancom.co.kr/hwpml/2011/head"
HP = "http://www.hancom.co.kr/hwpml/2011/paragraph"

MARKER = "◆여기까지보이면성공◆"

# 글꼴은 '이름' 으로만 참조한다 — 파일에 담지 않으므로(isEmbedded="0")
# 우리가 글꼴을 배포하는 일이 없다.
#
# ⚠️ 실물 시험지가 쓰는 `신명 중명조`·`한양신명조` 는 **한컴오피스에도 없다**
#    (번들 110종을 뽑아 확인함 — 신명시스템즈의 별매 상용 글꼴이다).
#    이름만 적어 두면 한글이 조용히 다른 글꼴로 대체하고, 글꼴 이름 칸이 비어 보인다.
#    그래서 기본값은 한컴에 반드시 들어 있는 `함초롬바탕` 으로 둔다.
#    (mock-exam-editor.html 도 이미 같은 이유로 함초롬을 폴백으로 쓴다.)
#    신명 글꼴을 산 사용자는 이 값만 바꾸면 그대로 적용된다.
EXAM_FONT = "함초롬바탕"
PAGE_MM = (297.0, 420.0)
MARGIN_MM = {"left": 31.0, "right": 31.0, "top": 56.0, "bottom": 30.0,
             "header": 0.0, "footer": 13.5}

LONG = (
    "이 문단은 원본보다 훨씬 길게 만들었습니다. 한글이 문서를 열 때 줄 나눔을 다시 계산한다면 "
    "이 긴 글이 여러 줄에 걸쳐 자연스럽게 흘러야 하고 문단 끝의 표식까지 빠짐없이 보여야 합니다. "
    "반대로 저장된 줄 나눔 정보를 그대로 믿는다면 뒤쪽이 잘리거나 글자가 겹쳐 보일 수 있습니다. "
    "조판이 정상이라면 양끝맞춤이 적용된 채로 단 폭에 맞추어 줄이 나뉘어야 합니다. "
)


def mm_to_hwpunit(mm: float) -> int:
    """HWPUNIT 은 1/7200 인치다."""
    return round(mm / 25.4 * 7200)


def font_faces_xml(face: str) -> str:
    """7개 언어 칸 모두 같은 글꼴을 가리키게 한다.

    isEmbedded="0" 가 핵심 — 글꼴 파일을 문서에 담지 않고 이름으로만 참조한다.
    실물 시험지도 정확히 이 방식이라(글꼴 스트림이 아예 없다) 라이선스 문제가 생기지 않는다.
    """
    langs = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"]
    body = "".join(
        f'<hh:fontface xmlns:hh="{HH}" lang="{lang}" fontCnt="1">'
        f'<hh:font id="0" face="{face}" type="TTF" isEmbedded="0">'
        f'<hh:typeInfo familyType="FCAT_MYUNGJO" weight="5" proportion="4" contrast="0"'
        f' strokeVariation="1" armStyle="0" letterform="0" midline="0" xHeight="0"/>'
        f"</hh:font></hh:fontface>"
        for lang in langs
    )
    return (f'<hh:fontfaces xmlns:hh="{HH}" itemCnt="{len(langs)}">'
            f"{body}</hh:fontfaces>")


def apply_template(doc: HwpxDocument) -> None:
    """빈 문서에 실물 시험지의 글꼴과 용지 설정을 입힌다.

    파트는 문자열이 아니라 XML 트리로 고친다 — 문자열 치환은 속성 순서나 공백이
    조금만 달라도 조용히 빗나가고, 그러면 '고쳤다고 생각했는데 안 고쳐진' 파일이 나온다.
    """
    head = doc.get_part("Contents/header.xml")
    ref_list = head.root.find("hh:refList")
    if ref_list is None:
        raise RuntimeError("header.xml 에 refList 가 없습니다")
    if ref_list.find("hh:fontfaces") is None:
        # 스키마 순서상 refList 의 첫 자식이어야 한다(fontfaces → borderFills → charProperties …)
        ref_list.insert_xml(0, font_faces_xml(EXAM_FONT))
        head.mark_modified()

    sec = doc.get_part("Contents/section0.xml")
    page_pr = sec.root.find(".//hp:pagePr")
    if page_pr is None:
        raise RuntimeError("section0.xml 에 pagePr 이 없습니다")
    page_pr.set_attr("width", str(mm_to_hwpunit(PAGE_MM[0])))
    page_pr.set_attr("height", str(mm_to_hwpunit(PAGE_MM[1])))
    page_pr.set_attr("landscape", "NARROWLY")
    margin = page_pr.find("hp:margin")
    if margin is None:
        raise RuntimeError("pagePr 에 margin 이 없습니다")
    for key, mm in MARGIN_MM.items():
        margin.set_attr(key, str(mm_to_hwpunit(mm)))
    sec.mark_modified()


def build(out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = HwpxDocument.blank()
    apply_template(doc)

    doc.append_paragraph(f"[검사 1] 짧은 문단입니다. 글꼴은 '{EXAM_FONT}' 로 지정했습니다.")
    doc.append_paragraph(f"[검사 2] {LONG}{MARKER}")
    doc.append_paragraph("")
    doc.append_paragraph(f"[검사 3] {LONG * 3}{MARKER}")
    doc.append_paragraph("")
    doc.append_paragraph("[검사 4] 마지막 문단입니다. 이 줄이 보이면 문서 끝까지 정상입니다.")

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

    out = out_dir / "probe.hwpx"
    doc.save(str(out))

    re_open = HwpxDocument.open(str(out))
    text = re_open.get_document_text()
    print()
    print(f"저장: {out} ({out.stat().st_size:,} bytes)")
    print(f"재열기 문단 수: {re_open.paragraph_count()}, 표식 {text.count(MARKER)}개 발견")
    print()
    print("한글에서 열어 확인:")
    print(f"  · [검사 2]·[검사 3] 문단 끝에 '{MARKER}' 가 보이면 → 재조판 성공")
    print(f"  · 글꼴이 '{EXAM_FONT}' 로 보이면 → 이름 참조만으로 서체 적용 성공")
    return 0 if problems == 0 else 1


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "out"
    raise SystemExit(build(target))
