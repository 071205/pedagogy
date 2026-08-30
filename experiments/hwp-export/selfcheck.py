"""hwpdoc 자체 검사 (베타 실험).

한글이 설치돼 있지 않아도 **구조적 온전성**은 기계적으로 확인할 수 있다.
실물 시험지 749개 문단 전부에서 성립함을 확인한 불변식을 검사에 쓴다:

    PARA_HEADER 의 글자수  == 직계 PARA_TEXT 의 코드유닛 수
    PARA_HEADER b[12:14]  == 직계 PARA_CHAR_SHAPE 구간 수
    PARA_HEADER b[16:18]  == 직계 PARA_LINE_SEG 줄 수

이 검사는 "한글에서 예쁘게 보이는가"를 대신하지 못한다(그건 사람이 열어 봐야 한다).
대신 **깨진 파일을 만들어 놓고 모르는 상황**을 막는다.

    python3 selfcheck.py [원본.hwp]

원본 파일은 저작물이라 저장소에 넣지 않는다. 없으면 건너뛴다.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from jakal_hwpx import HwpBinaryDocument  # noqa: E402
import jakal_hwpx.hwp_binary as hb  # noqa: E402

from hwpdoc import (  # noqa: E402
    Para, count_direct, join_paragraphs, make_text_para, roundtrip_ok,
    set_para_text, split_paragraphs,
    TAG_PARA_CHAR_SHAPE, TAG_PARA_LINE_SEG, TAG_PARA_TEXT,
)

DEFAULT_SRC = Path(__file__).resolve().parents[2] / "평가원 국어 양식.hwp"

_failures: list[str] = []
_passes = 0


def check(label: str, ok: bool, detail: str = "") -> bool:
    global _passes
    if ok:
        _passes += 1
        print(f"  ✅ {label}" + (f" — {detail}" if detail else ""))
    else:
        _failures.append(label)
        print(f"  ❌ {label}" + (f" — {detail}" if detail else ""))
    return ok


def para_problems(paras: list[Para], where: str) -> list[str]:
    """문단 불변식을 어긴 곳을 모두 모은다."""
    bad = []
    for i, p in enumerate(paras):
        hp = p.header.payload
        if len(hp) < 24:
            bad.append(f"{where}[{i}] PARA_HEADER 가 {len(hp)}B (24B 여야 함)")
            continue
        direct = p.header.level + 1
        want_chars = int.from_bytes(hp[0:4], "little") & 0x7FFFFFFF
        text_units = sum(r.size // 2 for r in p.children
                         if r.tag_id == TAG_PARA_TEXT and r.level == direct)
        n_cs = int.from_bytes(hp[12:14], "little")
        n_ls = int.from_bytes(hp[16:18], "little")
        got_cs = count_direct(p, TAG_PARA_CHAR_SHAPE, 8)
        got_ls = count_direct(p, TAG_PARA_LINE_SEG, 36)
        # 글이 없는 문단(표·그림만)은 PARA_TEXT 자체가 없으므로 글자수 검사를 건너뛴다.
        if text_units and want_chars != text_units:
            bad.append(f"{where}[{i}] 글자수 {want_chars} != 본문 {text_units}")
        if n_cs != got_cs:
            bad.append(f"{where}[{i}] 글자모양 구간 {n_cs} != 실제 {got_cs}")
        if n_ls != got_ls:
            bad.append(f"{where}[{i}] 줄 개수 {n_ls} != 실제 {got_ls}")
    return bad


def check_document(doc: HwpBinaryDocument, where: str) -> list[str]:
    bad = []
    for si, path in enumerate(doc.section_stream_paths()):
        _, paras = split_paragraphs(doc.read_stream(path))
        bad += para_problems(paras, f"{where} section{si}")
    return bad


def harvest_style(paras: list[Para]) -> dict:
    """실물 본문 문단에서 문단모양·스타일·글자모양 id 를 빌려 온다.

    새 글꼴을 정의하지 않고 원본이 이미 쓰는 조판값을 그대로 재사용하는 것이
    핵심이다 — 그래야 글꼴 파일을 우리가 배포하지 않고도 같은 서체로 조판된다.
    """
    for p in paras:
        if p.ctrl_ids:
            continue
        text = p.text.strip("\r")
        if len(text) < 40:
            continue
        hp = p.header.payload
        cs = next((r for r in p.children
                   if r.tag_id == TAG_PARA_CHAR_SHAPE and r.level == p.header.level + 1), None)
        if cs is None or cs.size < 8:
            continue
        return {
            "para_shape_id": int.from_bytes(hp[8:10], "little"),
            "style_id": hp[10],
            "char_shape_id": int.from_bytes(cs.payload[4:8], "little"),
        }
    raise RuntimeError("본문 문단을 찾지 못했습니다")


def main(src: Path) -> int:
    if not src.exists():
        print(f"원본 HWP 가 없어 검사를 건너뜁니다: {src}")
        print("(저작물이라 저장소에 넣지 않습니다. 경로를 인자로 넘겨 주세요.)")
        return 0

    print(f"원본: {src.name}")
    doc = HwpBinaryDocument.open(str(src))
    sections = doc.section_stream_paths()

    print("\n[1] 분해 → 재조립이 원본과 바이트까지 같은가")
    for si, path in enumerate(sections):
        raw = doc.read_stream(path)
        check(f"section{si} 왕복 동일", roundtrip_ok(raw), f"{len(raw):,}B")

    print("\n[2] 원본이 불변식을 지키는가 (검사 자체가 옳은지 확인)")
    bad = check_document(doc, "원본")
    check("원본 문단 불변식", not bad, "위반 없음" if not bad else f"{len(bad)}건: {bad[:3]}")

    _, paras0 = split_paragraphs(doc.read_stream(sections[0]))
    style = harvest_style(paras0)
    print(f"      빌려 온 조판값: {style}")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)

        print("\n[3] 길이가 다른 글로 바꿔 쓰기")
        doc3 = HwpBinaryDocument.open(str(src))
        raw = doc3.read_stream(sections[0])
        prefix, paras = split_paragraphs(raw)
        target = next(i for i, p in enumerate(paras)
                      if not p.ctrl_ids and len(p.text.strip("\r")) > 100)
        marker = "길이가 완전히 다른 새 문단으로 교체한 검사용 문장입니다.\r"
        before_n = len(paras)
        set_para_text(paras[target], marker)
        doc3.write_stream(sections[0], join_paragraphs(prefix, paras), compress=True)
        out3 = tmp / "edited.hwp"
        doc3.save(str(out3))

        re3 = HwpBinaryDocument.open(str(out3))
        _, after = split_paragraphs(re3.read_stream(sections[0]))
        check("문단 개수 보존", len(after) == before_n, f"{before_n} → {len(after)}")
        check("바뀐 글이 그대로 읽힘", after[target].text == marker)
        check("앞뒤 문단이 그대로", after[target - 1].text == paras0[target - 1].text
              and after[target + 1].text == paras0[target + 1].text)
        b3 = check_document(re3, "교체본")
        check("교체본 불변식", not b3, "위반 없음" if not b3 else f"{len(b3)}건: {b3[:3]}")

        print("\n[4] 본문을 통째로 새로 조판하기 (문항 개수가 다른 시험지)")
        doc4 = HwpBinaryDocument.open(str(src))
        prefix, paras = split_paragraphs(doc4.read_stream(sections[0]))
        # 문단 0 은 구역 정의(용지·단·머리말 틀)를 안고 있으므로 반드시 남긴다.
        kept = paras[:1]
        made = [make_text_para(f"새로 만든 {i + 1}번 문단입니다. 실제 문항이 들어갈 자리.\r",
                               **style) for i in range(12)]
        doc4.write_stream(sections[0], join_paragraphs(prefix, kept + made), compress=True)
        out4 = tmp / "rebuilt.hwp"
        doc4.save(str(out4))

        re4 = HwpBinaryDocument.open(str(out4))
        _, rebuilt = split_paragraphs(re4.read_stream(sections[0]))
        check("문단 수가 의도대로", len(rebuilt) == 1 + 12, f"{len(rebuilt)}개")
        check("새 문단 글이 읽힘", rebuilt[1].text.startswith("새로 만든 1번"))
        check("구역 정의(secd) 보존", "secd" in rebuilt[0].ctrl_ids, str(rebuilt[0].ctrl_ids))
        b4 = check_document(re4, "재조판본")
        check("재조판본 불변식", not b4, "위반 없음" if not b4 else f"{len(b4)}건: {b4[:3]}")
        text4 = re4.get_document_text()
        check("문서 텍스트 추출 정상", "새로 만든 12번 문단" in text4, f"{len(text4):,}자")

        print("\n[5] 검사가 실제로 실패하는지 (일부러 깨뜨려 확인)")
        prefix, paras = split_paragraphs(doc.read_stream(sections[0]))
        victim = paras[target]
        broken_units = len(victim.text.encode("utf-16-le")) // 2
        hp = bytearray(victim.header.payload)
        hp[0:4] = (broken_units + 7).to_bytes(4, "little")  # 글자수만 일부러 틀리게
        from jakal_hwpx import HwpRecord
        victim.header = HwpRecord(tag_id=victim.header.tag_id, level=victim.header.level,
                                  size=len(hp), header_size=victim.header.header_size,
                                  offset=-1, payload=bytes(hp))
        found = para_problems(paras, "고의파손")
        check("고의로 어긋낸 글자수를 잡아냄", bool(found),
              found[0] if found else "못 잡음 — 검사가 무의미함")

    print()
    if _failures:
        print(f"실패 {len(_failures)}건 / 통과 {_passes}건")
        for f in _failures:
            print(f"  - {f}")
        return 1
    print(f"전부 통과 ({_passes}건)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC))
