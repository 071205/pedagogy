"""실물 시험지 HWPX 를 '틀' 로 쓴다 (베타).

왜 빈 문서가 아니라 틀인가
--------------------------
빈 문서에서 시작하면 서식을 우리가 하나씩 다시 만들어야 하고, 만들지 않은 것은 그냥 없다
(조건 상자 테두리, 머리말, 탭 정의가 그래서 빠져 있었다). 한글이 직접 저장한 `.hwpx` 를
틀로 쓰면 **우리가 분석하지 않은 것까지 전부 따라온다.**

  글자 모양 108 · 문단 모양 52 · 테두리 16 · 탭 12 · 스타일 30 · 머리말 4

⚠️ 틀은 **한글에서 직접** `다른 이름으로 저장 > HWPX` 한 것이어야 한다.
   프로그램으로 변환하면 단 정의(`colPr`)가 통째로 사라진다(jakal 변환에서 실제로 그랬다).

⚠️ 틀에는 실물 문항과 그림이 들어 있다. 저작물이므로
   `clear_body()` 가 본문과 `BinData` 를 **반드시** 비운다. 남기면 우리 결과물이
   남의 문제를 담은 채 나간다.
"""

from __future__ import annotations

import re
import zipfile
from pathlib import Path

from jakal_hwpx import HwpxDocument

_NUM = re.compile(r"^\s*\d{1,2}\s*\.")


def _visible(p_xml: str) -> str:
    txt = "".join(re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", p_xml, re.S))
    return re.sub(r"<[^>]+>", "", txt).strip()


def classify(text: str) -> str | None:
    if not text:
        return None
    if "①" in text:
        return "choice"
    if _NUM.match(text):
        return "stem"
    return "cont"


def read_roles(path: Path) -> dict:
    """틀의 본문을 훑어 역할별로 쓰이는 문단·글자 모양 id 를 알아낸다.

    id 를 사람이 지정하지 않는다 — `1.` 로 시작하면 발문, `①` 이 있으면 선지.
    """
    from collections import Counter
    with zipfile.ZipFile(path) as z:
        sec = z.read("Contents/section0.xml").decode("utf-8")

    votes: dict[str, Counter] = {"stem": Counter(), "choice": Counter(), "cont": Counter()}
    num_votes: Counter = Counter()
    for p in re.findall(r"<hp:p\b[^>]*>.*?</hp:p>", sec, re.S):
        role = classify(_visible(p))
        if not role:
            continue
        pid = re.search(r'paraPrIDRef="(\d+)"', p)
        runs = re.findall(r'<hp:run\b[^>]*charPrIDRef="(\d+)"[^>]*>(.*?)</hp:run>', p, re.S)
        if not pid or not runs:
            continue
        # ⚠️ '가장 많이 덮는' 은 run 개수가 아니라 **글자 수**로 재야 한다.
        #    발문의 문항 번호("2.")도 run 하나라, 개수로 세면 번호 서식(13.5pt)이
        #    본문 서식으로 뽑힌다(실제로 그렇게 나왔다).
        span: Counter = Counter()
        for cid, body in runs:
            span[cid] += len(re.sub(r"<[^>]+>", "", "".join(
                re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", body, re.S))))
        if not span or max(span.values()) == 0:
            continue
        dom = span.most_common(1)[0][0]
        votes[role][(pid.group(1), dom)] += 1
        if role == "stem" and runs[0][0] != dom:
            num_votes[runs[0][0]] += 1

    out: dict = {"_source": path.name}
    for role, c in votes.items():
        if c:
            (pid, cid), n = c.most_common(1)[0]
            out[role] = {"para": pid, "char": cid, "count": n}
    if num_votes:
        cid, n = num_votes.most_common(1)[0]
        out["num"] = {"char": cid, "count": n}
    return out


def clear_body(doc: HwpxDocument) -> int:
    """본문을 비우되 **첫 문단은 남긴다** — 거기에 구역·단 정의가 들어 있다.

    남긴 첫 문단의 글자 조각은 지운다(실물 표지 글이 남지 않게).
    """
    removed = 0
    # ⚠️ 구역이 여럿이다(공통·선택). 하나만 비우면 남은 구역이 실물 문항과 그림을
    #    그대로 안고 있어, 지운 그림을 참조하는 깨진 문서가 된다(실제로 그랬다).
    for path in [p for p in doc.list_part_paths()
                 if p.startswith("Contents/section") and p.endswith(".xml")]:
        sec = doc.get_part(path)
        paras = [k for k in sec.root.children if k.local_name == "p"]
        if not paras:
            continue
        for p in paras[1:]:
            p.remove()
            removed += 1

        first = paras[0]
        for run in list(first.children):
            if run.local_name != "run":
                continue
            # secPr·colPr 은 남기고 글자만 지운다
            keep = [c for c in run.children if c.local_name in ("secPr", "colPr", "ctrl")]
            if not keep:
                run.remove()
            else:
                for c in list(run.children):
                    if c.local_name not in ("secPr", "colPr", "ctrl"):
                        c.remove()
        sec.mark_modified()
    return removed


def strip_bindata(doc: HwpxDocument) -> int:
    """틀에 딸려 온 실물 그림을 버린다. 저작물이라 결과물에 남기면 안 된다.

    ⚠️ 파일만 지우면 `content.hpf` 의 목록에 참조가 남아 문서가 깨진 것으로 판정된다
       (`manifest references missing part`). 목록에서도 함께 지워야 한다.
    """
    gone = 0
    for p in list(doc.list_part_paths()):
        if p.startswith("BinData/"):
            doc.remove_part(p)
            gone += 1
    if not gone:
        return 0

    hpf = doc.get_part("Contents/content.hpf")
    for item in list(hpf.root.iter()):
        if item.local_name == "item" and (item.get_attr("href") or "").startswith("BinData/"):
            item.remove()
    hpf.mark_modified()
    return gone


def open_template(path: Path | str) -> tuple[HwpxDocument, dict]:
    """틀을 열어 본문을 비우고, (문서, 역할→id) 를 준다."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"틀 파일이 없습니다: {path}")
    roles = read_roles(path)
    doc = HwpxDocument.open(str(path))
    clear_body(doc)
    strip_bindata(doc)
    return doc, roles


if __name__ == "__main__":
    import sys
    ref = Path(sys.argv[1] if len(sys.argv) > 1 else "평가원 수학 양식.hwpx")
    roles = read_roles(ref)
    print(f"틀: {roles['_source']}")
    for k, label in (("num", "문항 번호"), ("stem", "발문"),
                     ("choice", "선지"), ("cont", "이어지는 줄")):
        if k in roles:
            r = roles[k]
            pid = f"문단 {r['para']}·" if "para" in r else ""
            print(f"  {label}: {pid}글자 {r['char']}  ({r['count']}회)")
    doc, _ = open_template(ref)
    print(f"본문 비운 뒤 문단 {doc.paragraph_count()}개, 파트 {len(doc.list_part_paths())}개")
