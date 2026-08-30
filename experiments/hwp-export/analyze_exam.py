"""실물 시험지 HWP 에서 조판 규격을 뽑아내는 도구 (베타).

`exam_style.py` 의 값이 어디서 나왔는지 다시 확인하거나, 다른 시험지(국어·영어·다른 연도)의
규격을 새로 뽑을 때 쓴다.

    python3 analyze_exam.py "2025학년도 수능 수학 문제.hwp"

⚠️ 레코드 필드 배치는 규격서 통념과 다른 데가 있다. 실물 바이트로 확인한 것만 쓴다.

  CHAR_SHAPE(21)  0  UINT16×7 글꼴 id
                 14  UINT8×7   장평 %
                 21  INT8×7    자간 %
                 28  UINT8×7   상대 크기   ← 규격서 통념(UINT16×7)과 다르다.
                 35  INT8×7    글자 위치      UINT16 으로 읽으면 뒤가 7바이트 밀려
                 42  INT32     글자 크기(1/100pt)   6579pt 같은 값이 나온다.

  PARA_SHAPE(25)  0  UINT32  속성1 (bit0-1 줄간격 종류 · bit2-4 정렬)
                  4  INT32   왼여백 / 8 오른여백 / 12 들여쓰기
                 16  INT32   문단 위 / 20 문단 아래
                 50  UINT32  줄간격 %
"""

from __future__ import annotations

import struct
import sys
from collections import Counter
from pathlib import Path

from jakal_hwpx import HwpBinaryDocument
from jakal_hwpx.hwp_binary import _iter_records
import jakal_hwpx.hwp_binary as hb

ALIGN = {0: "양쪽", 1: "왼쪽", 2: "오른쪽", 3: "가운데", 4: "배분", 5: "나눔"}
SEVEN = ("hangul", "latin", "hanja", "japanese", "other", "symbol", "user")


def mm(v: int) -> float:
    return v / 7200 * 25.4


def hangul_faces(doc: HwpBinaryDocument) -> list[str]:
    """FACE_NAME 은 언어 7칸이 순서대로 온다. 앞 1/7 이 한글 칸이다."""
    names = []
    for rec in doc.docinfo_records():
        if rec.tag_id == hb.TAG_FACE_NAME:
            p = rec.payload
            ln = int.from_bytes(p[1:3], "little")
            names.append(p[3:3 + ln * 2].decode("utf-16-le", errors="replace"))
    return names[:len(names) // 7] if len(names) >= 7 else names


def char_shapes(doc: HwpBinaryDocument, faces: list[str]) -> list[dict]:
    out = []
    for rec in doc.docinfo_records():
        if rec.tag_id == hb.TAG_CHAR_SHAPE and rec.size >= 46:
            p = rec.payload
            fid = struct.unpack("<7H", p[0:14])[0]
            out.append({
                "pt": struct.unpack("<i", p[42:46])[0] / 100,
                "ratio": p[14],
                "spacing": struct.unpack("<b", p[21:22])[0],
                "face": faces[fid] if fid < len(faces) else f"?{fid}",
            })
    return out


def para_shapes(doc: HwpBinaryDocument) -> list[dict]:
    out = []
    for rec in doc.docinfo_records():
        if rec.tag_id == hb.TAG_PARA_SHAPE and rec.size >= 54:
            p = rec.payload
            prop = struct.unpack("<I", p[0:4])[0]
            lm, rm, ind, prev, nxt, _old = struct.unpack("<6i", p[4:28])
            out.append({
                "align": ALIGN.get((prop >> 2) & 0x7, "?"),
                "line": struct.unpack("<I", p[50:54])[0],
                "left": mm(lm), "right": mm(rm), "indent": mm(ind),
                "prev": mm(prev), "next": mm(nxt),
            })
    return out


def usage(doc: HwpBinaryDocument) -> tuple[Counter, Counter]:
    """본문에서 각 글자/문단 모양이 실제로 몇 번 쓰였는지."""
    cs, ps = Counter(), Counter()
    for path in doc.section_stream_paths():
        for rec in _iter_records(doc.read_stream(path)):
            if rec.tag_id == hb.TAG_PARA_CHAR_SHAPE:
                for j in range(rec.size // 8):
                    cs[int.from_bytes(rec.payload[j * 8 + 4:j * 8 + 8], "little")] += 1
            elif rec.tag_id == hb.TAG_PARA_HEADER and len(rec.payload) >= 10:
                ps[int.from_bytes(rec.payload[8:10], "little")] += 1
    return cs, ps


def main(path: Path) -> int:
    if not path.exists():
        print(f"파일이 없습니다: {path}")
        return 1
    doc = HwpBinaryDocument.open(str(path))
    faces = hangul_faces(doc)
    chars = char_shapes(doc, faces)
    paras = para_shapes(doc)
    cs_use, ps_use = usage(doc)

    print(f"■ {path.name}")
    print(f"  한글 글꼴 {len(faces)}종: {', '.join(faces)}")

    for si, p in enumerate(doc.section_stream_paths()):
        for rec in _iter_records(doc.read_stream(p)):
            if rec.tag_id == hb.TAG_PAGE_DEF:
                v = [int.from_bytes(rec.payload[i * 4:i * 4 + 4], "little") for i in range(9)]
                print(f"  구역{si} 용지 {mm(v[0]):.1f}×{mm(v[1]):.1f}mm  "
                      f"여백 좌{mm(v[2]):.1f} 우{mm(v[3]):.1f} 상{mm(v[4]):.1f} 하{mm(v[5]):.1f}")
                break
        for rec in _iter_records(doc.read_stream(p)):
            if rec.tag_id == hb.TAG_CTRL_HEADER and rec.payload[0:4][::-1] == b"cold":
                attr = int.from_bytes(rec.payload[4:6], "little")
                gap = int.from_bytes(rec.payload[6:8], "little") if len(rec.payload) >= 8 else 0
                print(f"  구역{si} 단 {(attr >> 2) & 0xFF}개 · 같은너비 {(attr >> 12) & 1} · "
                      f"간격 {mm(gap):.2f}mm")
                break

    print("\n  ── 많이 쓰인 글자 모양 ──")
    print(f"  {'id':>4} {'쓰임':>6} {'크기pt':>7} {'장평%':>6} {'자간%':>6}  글꼴")
    for cid, n in cs_use.most_common(8):
        if cid < len(chars):
            c = chars[cid]
            print(f"  {cid:>4} {n:>6} {c['pt']:>7.2f} {c['ratio']:>6} {c['spacing']:>6}  {c['face']}")

    print("\n  ── 많이 쓰인 문단 모양 ──")
    print(f"  {'id':>4} {'쓰임':>6} {'정렬':>5} {'줄간격':>6} {'왼여백':>8} {'들여쓰기':>9} {'아래':>8}")
    for pid, n in ps_use.most_common(8):
        if pid < len(paras):
            s = paras[pid]
            print(f"  {pid:>4} {n:>6} {s['align']:>5} {s['line']:>5}% "
                  f"{s['left']:>7.2f}mm {s['indent']:>8.2f}mm {s['next']:>6.2f}mm")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(2)
    raise SystemExit(main(Path(sys.argv[1])))
