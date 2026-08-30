"""한글이 줄 나눔을 다시 계산해 주는지 가려내는 실험 파일 생성기 (베타).

왜 필요한가
-----------
HWP 의 PARA_LINE_SEG 는 '몇 번째 글자에서 줄이 바뀌는가' 를 담은 **조판 캐시**다.
우리가 문단 내용을 새로 쓰면 이 캐시는 반드시 틀어진다 — 정확한 줄 나눔은 조판 엔진만
계산할 수 있기 때문이다. 그래서 남는 질문은 하나다:

    한글은 문서를 열 때 이 캐시를 무시하고 다시 계산하는가?

다시 계산해 준다면 이 방향(한글로 조판 → 사용자가 PDF 로 출력)은 성립하고,
상용 글꼴 라이선스 문제도 함께 풀린다. 캐시를 그대로 믿는다면 글이 잘려 보이므로
접근 자체를 바꿔야 한다. **이 컴퓨터에는 한글이 없어 기계적으로 답할 수 없으므로**,
사람이 한 번 열어 보면 바로 판정되도록 설계한 파일을 만든다.

판정 방법
---------
긴 문단 끝에 '표식' 문장을 둔다.
  · 표식이 보이면      → 한글이 다시 계산함 (성공)
  · 글이 중간에 잘리면 → 캐시를 그대로 믿음 (실패)

두 가지 방식을 각각 파일로 낸다. 한 파일이 깨져도 다른 쪽 결과를 잃지 않게 나눴다.
  A: 줄 캐시를 1줄짜리로 넣어 둔다
  B: 줄 캐시 레코드를 아예 넣지 않는다 (개수 필드도 0)

    python3 make_probe.py [원본.hwp] [내보낼 폴더]
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from jakal_hwpx import HwpBinaryDocument  # noqa: E402

from hwpdoc import (  # noqa: E402
    Para, join_paragraphs, make_para_char_shape, make_para_header,
    make_para_line_seg, make_para_text, split_paragraphs,
)
from selfcheck import DEFAULT_SRC, check_document, harvest_style  # noqa: E402

MARKER = "◆여기까지보이면성공◆"

LONG_BODY = (
    "이 문단은 원본 문단보다 훨씬 길게 만들었습니다. 한글이 문서를 열 때 줄 나눔을 다시 "
    "계산한다면 이 긴 글이 여러 줄에 걸쳐 자연스럽게 흘러야 하고, 문단의 끝에 있는 표식까지 "
    "빠짐없이 보여야 합니다. 반대로 한글이 파일에 저장된 줄 나눔 정보를 그대로 믿는다면 "
    "첫 줄만 남고 뒤쪽이 잘리거나, 글자가 겹쳐 보이거나, 아예 빈 곳이 생길 수 있습니다. "
    "그 차이를 눈으로 바로 구분할 수 있도록 문단 끝에 표식을 두었습니다. 이 문장 다음에 "
    "이어지는 내용까지 모두 읽을 수 있는지 확인해 주세요. 조판이 정상이라면 양끝맞춤이 "
    "적용된 채로 페이지의 단 폭에 맞추어 줄이 나뉘어야 합니다. "
)


def build_paragraphs(style: dict, with_line_seg: bool) -> list[Para]:
    """검사용 문단들을 만든다. with_line_seg 가 False 면 줄 캐시를 넣지 않는다."""

    def para(text: str) -> Para:
        units = len(text.encode("utf-16-le")) // 2
        children = [make_para_text(text), make_para_char_shape(style["char_shape_id"])]
        if with_line_seg:
            children.append(make_para_line_seg())
        return Para(
            header=make_para_header(
                units, style["para_shape_id"], style["style_id"],
                n_char_shapes=1, n_line_segs=1 if with_line_seg else 0,
            ),
            children=children,
        )

    return [
        para("[검사 1] 짧은 문단입니다.\r"),
        para(f"[검사 2] {LONG_BODY}{MARKER}\r"),
        para("\r"),
        para(f"[검사 3] {LONG_BODY}{LONG_BODY}{MARKER}\r"),
        para("\r"),
        para("[검사 4] 마지막 문단입니다. 이 줄이 보이면 문서 끝까지 정상입니다.\r"),
    ]


def make(src: Path, out_dir: Path) -> int:
    if not src.exists():
        print(f"원본 HWP 가 없습니다: {src}")
        return 1
    out_dir.mkdir(parents=True, exist_ok=True)

    base = HwpBinaryDocument.open(str(src))
    section0 = base.section_stream_paths()[0]
    _, paras0 = split_paragraphs(base.read_stream(section0))
    style = harvest_style(paras0)
    print(f"원본에서 빌려 온 조판값: {style}")

    made = []
    for tag, with_seg in (("A-줄캐시있음", True), ("B-줄캐시없음", False)):
        doc = HwpBinaryDocument.open(str(src))
        prefix, paras = split_paragraphs(doc.read_stream(section0))
        # 문단 0 은 용지·단·머리말 틀(secd)을 안고 있어 반드시 남긴다.
        body = build_paragraphs(style, with_seg)
        doc.write_stream(section0, join_paragraphs(prefix, paras[:1] + body), compress=True)

        # 2·3번 구역은 다른 과목 지면이라 이 실험에서는 비운다(빈 본문도 문단 0 은 남긴다).
        for other in base.section_stream_paths()[1:]:
            p2, q2 = split_paragraphs(doc.read_stream(other))
            doc.write_stream(other, join_paragraphs(p2, q2[:1]), compress=True)

        out = out_dir / f"probe-{tag}.hwp"
        doc.save(str(out))

        re = HwpBinaryDocument.open(str(out))
        bad = check_document(re, tag)
        text = re.get_document_text()
        ok = not bad and MARKER in text
        print(f"  {out.name}: {'구조 정상' if ok else '문제 있음'} "
              f"(불변식 위반 {len(bad)}건, 추출 텍스트 {len(text):,}자)")
        if bad:
            for b in bad[:3]:
                print(f"    - {b}")
        made.append(out)

    print()
    print("한글에서 두 파일을 열어 확인해 주세요:")
    print(f"  · '{MARKER}' 가 [검사 2]·[검사 3] 문단 끝에 보이면 → 한글이 다시 계산함(성공)")
    print("  · 글이 잘리거나 겹쳐 보이면 → 캐시를 그대로 믿음(이 방향은 재설계 필요)")
    return 0


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent / "out"
    raise SystemExit(make(src, out))
