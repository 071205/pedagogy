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


# 틀에 이미 역할별로 **이름 붙은 스타일**이 있다. 추측할 필요가 없다.
#   01-문제 / 21 1행 / 21 문제다음 / 21 박스(테두리) …
# 왼쪽이 우리 역할, 오른쪽이 틀의 스타일 이름(앞에 있는 것부터 찾는다).
STYLE_NAMES = {
    "stem":   ["01-문제"],
    "choice": ["21 1행", "1행"],
    # 선지 한 줄에 몇 칸이 들어가는지로 고른다(이름이 아니라 탭 개수가 기준이다).
    #   21 1행 = 탭 4개 → 5칸 · 2행 = 탭 2개 → 3칸 · 3행 = 탭 1개 → 2칸
    "row5":   ["21 1행", "1행"],
    "row3":   ["2행"],
    "row2":   ["3행"],
    "cont":   ["21 문제다음", "21 문제다음 별행"],
    "eq":     ["21 문제다음 별행", "21 문제다음"],
    "cond":   ["21 박스(테두리)", "02-박스"],
    "condeq": ["21 박스(테두리) 별행", "21 박스(테두리)"],
    "boxtop": ["21 박스위"],
    "boxbot": ["21 박스아래"],
    "ex":     ["21 보기", "02-보기"],
}


def read_named_styles(path: Path) -> dict:
    """틀의 이름 붙은 스타일에서 역할 → (스타일 id, 문단 모양 id, 글자 모양 id) 를 얻는다.

    이름이 있으면 이쪽이 정답이다. 내용을 보고 추측하는 `read_roles()` 보다 정확하고,
    조건 상자 테두리처럼 우리가 만들 수 없던 것도 이미 정의돼 있다.
    """
    with zipfile.ZipFile(path) as z:
        head = z.read("Contents/header.xml").decode("utf-8")

    by_name: dict[str, dict] = {}
    for m in re.finditer(r'<hh:style\b[^>]*/?>', head):
        tag = m.group(0)
        name = re.search(r'name="([^"]*)"', tag)
        pid = re.search(r'paraPrIDRef="(\d+)"', tag)
        cid = re.search(r'charPrIDRef="(\d+)"', tag)
        sid = re.search(r'id="(\d+)"', tag)
        if name and pid and sid:
            by_name[name.group(1)] = {
                "style": sid.group(1), "para": pid.group(1),
                "char": cid.group(1) if cid else "0"}

    out: dict = {}
    for role, candidates in STYLE_NAMES.items():
        for nm in candidates:
            if nm in by_name:
                out[role] = {**by_name[nm], "name": nm}
                break
    return out


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

        _clean_frame_paragraph(paras[0])
        sec.mark_modified()
    return removed


# 문단 0 에는 '틀' 과 '1번 문항' 이 함께 들어 있다.
#   run0: secPr·ctrl           → 구역·단 정의
#   run1: tbl·rect·line·tbl    → 머리말 틀 (수학 영역 · 제2교시 · 5지선다형)
#   run2: t·equation           → 1번 문항 발문   ← 실물 문제. 지워야 한다
#   run3: t                    → 발문 나머지     ← 지워야 한다
# 그래서 문단 0 을 통째로 남기면 남의 문제가 딸려 오고, 통째로 지우면 머리말이 사라진다.
FRAME_TAGS = {"secPr", "colPr", "ctrl", "tbl", "rect", "line", "ellipse",
              "arc", "polygon", "curve", "pic", "container", "textart",
              "ole", "chart", "connectLine"}


def _clean_frame_paragraph(para) -> None:
    """첫 문단에서 **틀만 남기고 글·수식은 지운다.**

    틀(표·선·사각형)에 들어 있는 머리말 글자는 그 안에 있으므로 함께 남는다.
    실물 확인: 이 틀 안의 글자는 `2025학년도 … 수학 영역 … 제2교시 … 5지선다형` 뿐이고
    문제 본문이나 수식은 없다.
    """
    for run in list(para.children):
        if run.local_name == "linesegarray":
            run.remove()            # 낡은 줄 캐시 — 남기면 한글이 뒤 내용을 버린다
            continue
        if run.local_name != "run":
            continue
        if any(c.local_name in FRAME_TAGS for c in run.children):
            continue                # 틀이 들어 있는 run 은 그대로 둔다
        run.remove()                # 글자·수식만 있는 run = 실물 문항


def set_masthead_title(doc: HwpxDocument, title: str) -> bool:
    """머리말의 `2025학년도 대학수학능력시험 문제지` 를 우리 회차명으로 바꾼다.

    ⚠️ 머리말 글자는 한 조각이 아니라 여러 `<hp:t>` 에 쪼개져 있다
       ('2025학년도 ', '대', '학수학능력시', '험 ', '문', '제', '지' …).
       한 곳만 고치면 나머지가 남아 `2027학년도 …학수학능력시험 문제지` 가 된다.
       첫 조각에 새 글을 넣고 **나머지는 비운다.**
    """
    changed = False
    for path in [p for p in doc.list_part_paths()
                 if p.startswith("Contents/section") and p.endswith(".xml")]:
        sec = doc.get_part(path)
        paras = [k for k in sec.root.children if k.local_name == "p"]
        if not paras:
            continue
        texts = [n for n in paras[0].iter() if n.local_name == "t"]
        joined = "".join(n.text or "" for n in texts)
        if "문제지" not in joined:
            continue
        end = joined.index("문제지") + len("문제지")
        pos, first = 0, True
        for n in texts:
            length = len(n.text or "")
            if pos < end:
                n.text = title if first else ""
                first = False
            pos += length
        sec.mark_modified()
        changed = True
    return changed


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
    roles = read_named_styles(path)
    if roles:
        # 이름 붙은 스타일에는 '문항 번호' 서식이 없다. 번호는 발문 문단의 첫 조각이
        # 본문과 다른 글자 모양을 쓰므로(실물 13.5pt vs 11.5pt) 거기서 찾아 온다.
        guessed = read_roles(path)
        if "num" in guessed:
            roles["num"] = guessed["num"]
    if len(roles) < 3:
        # 이름 붙은 스타일이 없는 틀이면 내용을 보고 추측하는 쪽으로 내려간다.
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
