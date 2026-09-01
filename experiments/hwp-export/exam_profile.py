"""실물 시험지에서 조판 규격을 '읽어' 온다 (베타).

왜 상수로 적어 두지 않는가
--------------------------
처음에는 분석 결과를 손으로 옮겨 상수로 박아 뒀다. 그러다 **발문과 선지의 문단 모양을
서로 바꿔 적는 실수**를 했다 — 쓰인 횟수만 보고 배정했는데, 실제로는 `1.` 로 시작하는
문단과 `①` 로 시작하는 문단이 반대였다. 눈으로 옮겨 적는 한 이런 실수는 또 난다.

그래서 값을 적어 두지 않고 **파일에서 그때그때 읽는다.**

  · 옮겨 적다 틀릴 일이 없다
  · 국어·영어·다른 연도 시험지를 넣으면 그 규격이 그대로 따라온다
  · 규격의 출처가 하나뿐이다 (실물 파일)

역할은 문단의 **실제 내용**으로 가린다. 사람이 id 를 지정하지 않는다.

  stem   `1.` `12.` 처럼 번호로 시작   → 문항 발문
  choice `①` 이 들어 있음              → 선지
  cont   그 밖의 본문 (이어지는 문장·별행 수식)

⚠️ 실물은 별행 수식에 따로 문단 모양을 두지 않고 `cont` 와 같은 것을 쓴다.
   '가운데 정렬 수식' 은 우리가 지어낸 것이었다. 실물을 따른다.
"""

from __future__ import annotations

import re
import struct
from collections import Counter
from pathlib import Path
from typing import Any

# 초기 실험 때만 쓰던 바이너리 HWP 분석기는 HWPX 내보내기 런타임과 분리한다.
# 자칼이 없는 제품 환경에서는 HWPX 틀 또는 아래 FALLBACK으로 정상 조판한다.
try:  # legacy analysis only
    from jakal_hwpx import HwpBinaryDocument
    from jakal_hwpx.hwp_binary import _iter_records
    import jakal_hwpx.hwp_binary as hb
except ImportError:  # HWPX 출력에는 필요 없다
    HwpBinaryDocument = Any
    _iter_records = None
    hb = None

ALIGN_XML = {0: "JUSTIFY", 1: "LEFT", 2: "RIGHT", 3: "CENTER",
             4: "DISTRIBUTE", 5: "DISTRIBUTE_SPACE"}

# 참고 파일이 없을 때 쓰는 최소 기본값. 실물 규격이 아니라 '그럭저럭 읽히는' 값이다.
FALLBACK = {
    "stem":   {"char": {"pt": 11.5, "ratio": 95, "spacing": -5},
               "para": {"align": "LEFT", "line": 165, "left": 0.0,
                        "indent": -8.25, "prev": 0.0, "next": 7.76}},
    "choice": {"char": {"pt": 11.5, "ratio": 95, "spacing": -5},
               "para": {"align": "JUSTIFY", "line": 165, "left": 7.76,
                        "indent": -7.97, "prev": 0.0, "next": 0.0}},
    "cont":   {"char": {"pt": 11.5, "ratio": 95, "spacing": -5},
               "para": {"align": "LEFT", "line": 165, "left": 8.11,
                        "indent": 0.0, "prev": 0.0, "next": 8.11}},
}

_NUM = re.compile(r"^\s*\d{1,2}\s*\.")


def _mm(v: int) -> float:
    return v / 7200 * 25.4


def _visible(text: str) -> str:
    """수식·컨트롤 자리표시 제어문자를 걷어내고 사람이 읽는 글만 남긴다."""
    return "".join(c for c in text.replace("\r", "") if c >= " ").strip()


def _char_table(doc: HwpBinaryDocument) -> list[dict]:
    out = []
    for rec in doc.docinfo_records():
        if rec.tag_id == hb.TAG_CHAR_SHAPE and rec.size >= 46:
            p = rec.payload
            out.append({"pt": struct.unpack("<i", p[42:46])[0] / 100,
                        "ratio": p[14],
                        "spacing": struct.unpack("<b", p[21:22])[0]})
    return out


def _para_table(doc: HwpBinaryDocument) -> list[dict]:
    out = []
    for rec in doc.docinfo_records():
        if rec.tag_id == hb.TAG_PARA_SHAPE and rec.size >= 54:
            p = rec.payload
            prop = struct.unpack("<I", p[0:4])[0]
            lm, rm, ind, prev, nxt, _ = struct.unpack("<6i", p[4:28])
            out.append({"align": ALIGN_XML.get((prop >> 2) & 0x7, "LEFT"),
                        "line": struct.unpack("<I", p[50:54])[0],
                        "left": _mm(lm), "indent": _mm(ind),
                        "prev": _mm(prev), "next": _mm(nxt)})
    return out


def _dominant(runs: list[tuple[int, int]], total: int) -> int | None:
    """문단에서 '가장 넓게 쓰인' 글자 모양.

    ⚠️ 첫 조각을 집으면 안 된다. 발문의 첫 조각은 **문항 번호**라 본문과 크기가 다르다
       (실물에서 번호는 13.5pt, 본문은 11.5pt). 첫 조각을 쓰면 본문 전체가 번호 크기로
       조판된다 — 실제로 그렇게 뽑혔다.
    """
    if not runs:
        return None
    span: Counter = Counter()
    for i, (pos, cid) in enumerate(runs):
        end = runs[i + 1][0] if i + 1 < len(runs) else max(total, pos)
        span[cid] += max(end - pos, 0)
    if not span or max(span.values()) == 0:
        return runs[0][1]
    return span.most_common(1)[0][0]


def _walk(doc: HwpBinaryDocument):
    """레벨 0 문단마다 (문단모양 id, 대표 글자모양 id, 첫 글자모양 id, 보이는 글)."""
    def flush(cur):
        if not cur or not cur["runs"]:
            return None
        text = cur["t"]
        dom = _dominant(cur["runs"], len(text))
        return cur["ps"], dom, cur["runs"][0][1], _visible(text)

    for path in doc.section_stream_paths():
        cur = None
        for rec in _iter_records(doc.read_stream(path)):
            if rec.tag_id == hb.TAG_PARA_HEADER and rec.level == 0:
                got = flush(cur)
                if got:
                    yield got
                cur = {"ps": int.from_bytes(rec.payload[8:10], "little"),
                       "runs": [], "t": ""}
            elif cur is not None and rec.level == 1:
                if rec.tag_id == hb.TAG_PARA_TEXT:
                    cur["t"] += rec.payload.decode("utf-16-le", errors="ignore")
                elif rec.tag_id == hb.TAG_PARA_CHAR_SHAPE and rec.size >= 8:
                    for j in range(rec.size // 8):
                        cur["runs"].append((
                            int.from_bytes(rec.payload[j * 8:j * 8 + 4], "little"),
                            int.from_bytes(rec.payload[j * 8 + 4:j * 8 + 8], "little")))
        got = flush(cur)
        if got:
            yield got


def classify(text: str) -> str | None:
    if not text:
        return None
    if "①" in text:
        return "choice"
    if _NUM.match(text):
        return "stem"
    return "cont"


def profile_from(path: Path | str) -> dict:
    """참고 시험지에서 역할별 조판 규격을 읽어 온다.

    파일이 없으면 `FALLBACK` 을 돌려주되, 그 사실을 `_source` 에 남긴다 —
    부르는 쪽이 '실물 규격인지 임시값인지' 를 구분할 수 있어야 한다.
    """
    path = Path(path)
    if not path.exists():
        return {**{k: dict(v) for k, v in FALLBACK.items()},
                "_source": None}
    if HwpBinaryDocument is Any or _iter_records is None or hb is None:
        return {**{k: dict(v) for k, v in FALLBACK.items()},
                "_source": None,
                "_note": "바이너리 HWP 분석기는 설치하지 않았습니다"}

    doc = HwpBinaryDocument.open(str(path))
    chars, paras = _char_table(doc), _para_table(doc)

    votes: dict[str, Counter] = {"stem": Counter(), "choice": Counter(), "cont": Counter()}
    num_votes: Counter = Counter()      # 발문 첫 조각 = 문항 번호 서식
    for ps, cs, first_cs, text in _walk(doc):
        role = classify(text)
        if role:
            votes[role][(ps, cs)] += 1
            if role == "stem" and first_cs != cs:
                num_votes[first_cs] += 1

    out: dict = {"_source": path.name, "_votes": {}}
    for role, counter in votes.items():
        if not counter:
            out[role] = dict(FALLBACK[role])
            continue
        (ps, cs), n = counter.most_common(1)[0]
        out["_votes"][role] = {"para_id": ps, "char_id": cs, "count": n}
        out[role] = {
            "char": dict(chars[cs]) if cs < len(chars) else dict(FALLBACK[role]["char"]),
            "para": dict(paras[ps]) if ps < len(paras) else dict(FALLBACK[role]["para"]),
        }

    # 문항 번호는 본문과 다른 서식을 쓴다(실물에서 더 크다). 있으면 따로 둔다.
    if num_votes:
        nid, n = num_votes.most_common(1)[0]
        if nid < len(chars):
            out["num_char"] = dict(chars[nid])
            out["_votes"]["num"] = {"char_id": nid, "count": n}
    return out


def describe(prof: dict) -> str:
    src = prof.get("_source") or "(참고 파일 없음 — 임시 기본값)"
    lines = [f"조판 규격 출처: {src}"]
    if "num_char" in prof:
        c = prof["num_char"]
        v = prof.get("_votes", {}).get("num")
        tag = f" (글자 {v['char_id']}, {v['count']}회)" if v else ""
        lines.append(f"  문항 번호: {c['pt']}pt 장평{c['ratio']}% 자간{c['spacing']}%{tag}")
    for role, label in (("stem", "발문"), ("choice", "선지"), ("cont", "이어지는 줄")):
        c, p = prof[role]["char"], prof[role]["para"]
        v = prof.get("_votes", {}).get(role)
        tag = f" (문단 {v['para_id']}·글자 {v['char_id']}, {v['count']}회)" if v else ""
        lines.append(
            f"  {label}: {c['pt']}pt 장평{c['ratio']}% 자간{c['spacing']}% · "
            f"{p['align']} {p['line']}% 왼{p['left']:.2f} 들여{p['indent']:.2f} "
            f"아래{p['next']:.2f}mm{tag}")
    return "\n".join(lines)


if __name__ == "__main__":
    import sys
    ref = sys.argv[1] if len(sys.argv) > 1 else "2025학년도 수능 수학 문제.hwp"
    print(describe(profile_from(ref)))
