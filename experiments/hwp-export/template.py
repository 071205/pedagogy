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

from pedagogy_hwpx import HwpxDocument, MM_TO_HWPUNIT

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
    # ⚠️ `1행`·`2행`·`3행` 은 '몇 번째 줄' 이 아니라 **선지가 몇 줄을 차지하는 배치인가**다.
    #    실물 확인: 3+2 배치는 ①②③ 줄과 ④⑤ 줄이 **둘 다 문단 19(`2행`)** 를 쓴다
    #    (각각 5회씩). 둘째 줄에 다른 스타일을 주면 ④가 ① 아래로 안 오고 벌어진다.
    "ch1row": ["21 1행", "1행"],     # 한 줄에 5개
    "ch2row": ["2행"],               # 두 줄(3+2) — 두 줄 모두 이것
    "ch3row": ["3행"],               # 세 줄(2+2+1)
    "cont":   ["21 문제다음", "21 문제다음 별행"],
    "eq":     ["21 문제다음 별행", "21 문제다음"],
    "cond":   ["21 박스(테두리)", "02-박스"],
    "condeq": ["21 박스(테두리) 별행", "21 박스(테두리)"],
    "boxtop": ["21 박스위"],      # 상자 '앞' 여백 문단
    "boxbot": ["21 박스아래"],     # 상자 '뒤' 여백 문단 — 없으면 발문이 상자에 붙는다
    "ex":     ["21 보기", "02-보기"],
    # ⚠️ `figure` 와 `note` 는 **여기 두지 않는다.** 실물이 쓰는 문단 모양에 이름이 없고,
    #    이름이 그럴듯한 `보기`·`표 내용`·`확인사항-` 은 실물에서 **0회** 쓰인다.
    #    예전에 `figure` 를 `보기` 로 두어, 실물이 그림에 쓰지 않는 모양으로 우리 그림이
    #    나가고 있었다(`docs/MOCK-STYLE-DESIGN.md` §8-④). `read_roles_by_usage()` 가 찾는다.
}


def read_equation_base(path: Path) -> int | None:
    """실물 수식의 기준 크기(baseUnit, 1/100pt).

    ⚠️ 본문 크기와 다르다 — 실물은 본문 11.5pt 에 수식 11.0pt 다(522개 전부).
       본문 크기를 그대로 쓰면 수식만 커 보인다.
    """
    with zipfile.ZipFile(path) as z:
        for name in [n for n in z.namelist() if n.startswith("Contents/section")]:
            m = re.search(r'<hp:equation[^>]*baseUnit="(\d+)"', z.read(name).decode("utf-8"))
            if m:
                return int(m.group(1))
    return None


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


def read_roles_by_usage(path: Path) -> dict:
    """본문에 **무엇이 들어 있는지**로 역할을 찾는다(이름이 아니라 쓰임으로).

    ⚠️ 이름으로 찾는 `STYLE_NAMES` 가 통하지 않는 것들이 있다. 실물의 **그림은 이름 없는
       문단 모양**을 쓰고(17회), 이름이 그럴듯한 `보기`·`표 내용` 은 **한 번도 쓰이지
       않는다.** 그런데 우리 변환기는 그 `보기` 에 매핑돼 있었다 — 실물이 그림에 쓰지
       않는 모양으로 우리 그림이 나가고 있었다. 값이 가까워(줄간격만 165 vs 160) 눈에
       띄지 않았다. `docs/MOCK-STYLE-DESIGN.md` §8-④ 참고.

    ⚠️ `※ 확인 사항` 도 같다. 이름 붙은 `확인사항-` 은 0회이고 실제로는 이름 없는
       문단 모양을 쓴다.

    이름으로 찾은 것을 **덮어쓴다** — 이름은 그럴듯해도 실물이 안 쓰면 틀린 답이다.
    """
    with zipfile.ZipFile(path) as z:
        sections = [z.read(n).decode("utf-8")
                    for n in z.namelist() if n.startswith("Contents/section")]

    from collections import Counter
    votes: dict[str, Counter] = {"figure": Counter(), "note": Counter()}
    for sec in sections:
        for p in re.findall(r"<hp:p\b[^>]*>.*?</hp:p>", sec, re.S):
            pid = re.search(r'paraPrIDRef="(\d+)"', p)
            if not pid:
                continue
            role = None
            if "<hp:pic" in p:
                role = "figure"
            elif "확인 사항" in _visible(p):
                role = "note"
            if role is None:
                continue
            # 그 문단에서 가장 많이 쓰인 글자 모양을 함께 잡는다.
            chars = Counter(re.findall(r'<hp:run\b[^>]*charPrIDRef="(\d+)"', p))
            cid = chars.most_common(1)[0][0] if chars else "0"
            votes[role][(pid.group(1), cid)] += 1

    out: dict = {}
    for role, c in votes.items():
        if not c:
            continue
        (pid, cid), n = c.most_common(1)[0]
        out[role] = {"para": pid, "char": cid, "count": n}
    return out


def read_column_tops_mm(doc: HwpxDocument) -> dict[int, list[float]]:
    """구역마다 **단별로 첫 내용이 시작하는 자리**(mm). 그 단의 '위 여백' 이다.

    첫 쪽은 표제부(회차·수학 영역·제2교시·5지선다형 상자)가 글의 흐름에서 자리를
    차지하므로 문항이 단 맨 위에서 시작하지 않는다. 실물에서 재면 두 구역 모두

        단0 = 40.7mm · 단1 = 24.7mm · 단2 이후 = 0mm

    이고, 우리가 만든 파일도 한글이 같은 자리에 놓는다(저장시켜 확인했다).

    ⚠️ **이 값을 빼지 않으면 그만큼 아래로 내려간다.** 단 전체를 반으로 나누면 1쪽
       왼단 둘째 문항이 188.4mm 에 놓인다 — 실물 168.5mm 보다 20mm 아래다.
       오른단(24.7)을 0 으로 보면 12mm 어긋난다. 둘 다 실제로 겪었다.

    ⚠️ `clear_body()` 앞에서 읽어야 한다. 한글이 저장한 줄 정보(`linesegarray`)를 보는데,
       그건 본문을 비우면 함께 사라진다.
    """
    out: dict[int, list[float]] = {}
    for path in [p for p in doc.list_part_paths()
                 if p.startswith("Contents/section") and p.endswith(".xml")]:
        try:
            sec_i = int(path.removeprefix("Contents/section").removesuffix(".xml"))
        except ValueError:
            continue
        tops: list[float] = []
        want = True
        for para in [k for k in doc.get_part(path).root.children if k.local_name == "p"]:
            if para.get_attr("columnBreak") == "1" or para.get_attr("pageBreak") == "1":
                want = True
            if not want:
                continue
            segs = [c for c in para.children if c.local_name == "linesegarray"]
            if not segs or not segs[0].children:
                continue
            try:
                tops.append(int(segs[0].children[0].get_attr("vertpos")) / MM_TO_HWPUNIT)
            except (TypeError, ValueError):
                tops.append(0.0)
            want = False
            if len(tops) >= 4:
                break
        if tops:
            out[sec_i] = tops
    return out


def read_pad_step_mm(doc: HwpxDocument, roles: dict) -> float | None:
    """빈 문단 **하나가 실제로 차지하는 세로 길이**(mm).

    문항 사이를 빈 문단으로 벌릴 때 몇 개가 필요한지 세는 값이다.

    ⚠️ **줄 높이만 세면 안 된다.** 빈 문단 하나는 `줄 높이 + 문단 위·아래 여백` 만큼
       차지한다. 실물 틀에서 재면

           줄 높이 6.696mm(11.5pt × 165%) + 문단 아래 여백 4.057mm = 10.753mm

       인데, 여백을 빼고 6.694mm 로 계산했더니 빈 문단이 실제보다 1.6배 크게 벌어져
       둘째 문항이 219.6mm 까지 내려갔다(목표 168.1mm). 한글이 저장한 줄 정보
       (`linesegarray` 의 vertpos 간격)로 확인한 값이다.

    ⚠️ 값을 박아 두지 않는다 — 틀을 바꾸면 함께 바뀌므로 틀에서 읽어야 한다.
    """
    spec = roles.get("cont") or roles.get("stem") or {}
    para_id, char_id = spec.get("para"), spec.get("char")
    if para_id is None:
        return None
    head = doc.get_part("Contents/header.xml").root
    size = spacing = None
    for node in head.iter():
        if node.local_name == "charPr" and char_id is not None and node.get_attr("id") == str(char_id):
            try:
                size = int(node.get_attr("height"))
            except (TypeError, ValueError):
                pass
        elif node.local_name == "paraPr" and node.get_attr("id") == str(para_id):
            line = next((c for c in node.iter() if c.local_name == "lineSpacing"), None)
            if line is not None and line.get_attr("type") == "PERCENT":
                try:
                    spacing = int(line.get_attr("value"))
                except (TypeError, ValueError):
                    pass
    if not size:
        size = 1150            # 실물 본문 11.5pt — 글자 모양이 0(기본)이면 여기로 온다
    if not spacing:
        return None
    line_mm = (size / 100) * (spacing / 100) / 72 * 25.4
    return line_mm + _para_gap_mm(head, para_id)


def _para_gap_mm(head, para_id) -> float:
    """문단 위·아래 여백의 합(mm). 빈 문단 하나가 줄 높이에 더해 차지하는 만큼이다."""
    for node in head.iter():
        if node.local_name != "paraPr" or node.get_attr("id") != str(para_id):
            continue
        margin = next((c for c in node.iter() if c.local_name == "margin"), None)
        if margin is None:
            return 0.0
        total = 0.0
        for side in margin.children:
            if side.local_name in ("prev", "next"):
                try:
                    total += int(side.get_attr("value")) / MM_TO_HWPUNIT
                except (TypeError, ValueError):
                    pass
        return total
    return 0.0


def capture_page_headers(doc: HwpxDocument) -> dict[int, list[str]]:
    """이어지는 쪽의 머리말 정의를 **본문을 비우기 전에** 떠 둔다.

    ⚠️ 실물은 쪽마다 머리말을 다시 넣지 않는다. `수학 영역` 머리말은 **2쪽 첫 문단**의
       `<hp:ctrl><hp:header>…</hp:header></hp:ctrl>` 한 번뿐이고, 3쪽부터는 그것을
       물려받는다(실물 대조: 5번 문단에만 있고 8·13·18번 문단에는 없다).
       그래서 `clear_body()` 가 그 문단을 지우면 **2쪽부터 머리말이 통째로 사라진다.**
       여기서 먼저 떠 두었다가 `mock_to_hwpx.build()` 가 새 2쪽 첫 문단에 도로 넣는다.

    돌려주는 값은 `{구역 번호: [run XML, …]}` 이다. 머리말이 없는 틀이면 빈 dict.
    """
    found: dict[int, list[str]] = {}
    for path in [p for p in doc.list_part_paths()
                 if p.startswith("Contents/section") and p.endswith(".xml")]:
        try:
            sec_i = int(path.removeprefix("Contents/section").removesuffix(".xml"))
        except ValueError:
            continue
        sec = doc.get_part(path)
        for para in [k for k in sec.root.children if k.local_name == "p"]:
            runs = [r for r in para.children
                    if r.local_name == "run"
                    and any(n.local_name == "header" for n in r.iter())]
            if runs:
                # 첫 번째로 나오는 것만 쓴다 — 실물에 하나뿐이고, 여러 개를 넣으면
                # 쪽마다 머리말이 겹쳐 찍힌다.
                found[sec_i] = [r.to_xml() for r in runs]
                break
    return found


# ── 구획 태그(5지선다형·단답형)와 ※ 확인 사항 ──────────────────────────────
#
# ⚠️ 이 둘은 **문단이 아니라 표 개체**(`<hp:tbl>`)다. 문단 모양만 맞춰서는 아무것도
#    나오지 않는다(docs/MOCK-STYLE-DESIGN.md §9).
#
# 크기·테두리·안여백을 우리가 지어내지 않는다 — **실물 표를 통째로 떠서 도로 심는다.**
# 머리말을 그렇게 다루는 것과 같은 방식이고, 같은 이유로 `clear_body()` **전에** 불러야 한다.
#
# 실물에서 잰 값(참고 — 아래 코드는 이 숫자를 쓰지 않고 표를 그대로 옮긴다):
#   5지선다형 38.82 × 8.28mm · 단답형 27.84 × 8.28mm · ※ 확인 사항 111.00 × 35.64mm(3줄)
#   · 21.15mm(2줄) · 테두리 0.12mm · 안여백 0.49mm
_TAG_NAMES = {"단답형": "short", "5지선다형": "choice"}


def _squeeze(s: str) -> str:
    return re.sub(r"\s+", "", s)


def capture_marks(doc: HwpxDocument) -> dict:
    """본문을 비우기 전에 구획 태그·※ 확인 사항 표를 떠 둔다.

    돌려주는 값:

        {"tag": {"short": {...}}, "note": {3: {...}, 2: {...}}, "tag_step_mm": 15.9}

    각 항목은 `{"tbl": 표 XML, "para": 문단모양, "style": 스타일, "char": 글자모양}` 이다.
    `tag_step_mm` 은 **태그 문단 위 끝에서 다음 문항이 시작하는 자리까지**의 거리로,
    한글이 실제로 그렇게 놓은 값을 `linesegarray` 에서 읽은 것이다(실물 15.9mm).
    이 값이 그 단의 '위 여백' 이 된다 — 안 빼면 그만큼 문항이 아래로 밀린다.

    ⚠️ 태그 표는 **셀 안 문단이 하나인 사본**을 고른다. 실물의 어떤 사본은 셀 안에
       이어지는 쪽 머리말(`<hp:ctrl><hp:header>`)을 품고 있어서, 그걸 떠다 심으면
       머리말이 태그마다 다시 정의돼 쪽마다 겹쳐 찍힌다.
    """
    tags: dict[str, dict] = {}
    notes: dict[int, dict] = {}
    step_mm: float | None = None
    for path in [p for p in doc.list_part_paths()
                 if p.startswith("Contents/section") and p.endswith(".xml")]:
        paras = [k for k in doc.get_part(path).root.children if k.local_name == "p"]
        for i, para in enumerate(paras):
            for run in [r for r in para.children if r.local_name == "run"]:
                for tbl in [t for t in run.children if t.local_name == "tbl"]:
                    body = _squeeze(tbl.text_content())
                    inner = [n for n in tbl.iter() if n.local_name == "p"]
                    spec = {"tbl": tbl.to_xml(),
                            "para": para.get_attr("paraPrIDRef"),
                            "style": para.get_attr("styleIDRef"),
                            "char": run.get_attr("charPrIDRef")}
                    role = _TAG_NAMES.get(body)
                    if role:
                        if role in tags and len(inner) != 1:
                            continue        # 머리말을 품은 사본은 버린다
                        tags[role] = spec
                        if role == "short" and len(inner) == 1:
                            step_mm = _next_para_top_mm(paras, i) or step_mm
                    elif body.startswith("*확인사항") or body.startswith("※확인사항"):
                        notes.setdefault(len(inner), spec)
    return {"tag": tags, "note": notes, "tag_step_mm": step_mm}


def _next_para_top_mm(paras: list, i: int) -> float | None:
    """`paras[i]` 다음 문단의 첫 줄이 놓인 자리(단 위 기준 mm)."""
    for para in paras[i + 1:]:
        segs = [c for c in para.children if c.local_name == "linesegarray"]
        if not segs or not segs[0].children:
            continue
        try:
            return int(segs[0].children[0].get_attr("vertpos")) / MM_TO_HWPUNIT
        except (TypeError, ValueError):
            return None
    return None


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


def _replace_span(texts, start: int, end: int, new: str) -> bool:
    """조각들을 이어 붙인 글에서 `[start, end)` 구간만 `new` 로 바꾼다.

    머리말 글자는 한 조각이 아니라 `'확','률','과',' ','통계'` 처럼 잘게 쪼개져 있어,
    구간이 조각 경계와 맞지 않는다. 조각마다 겹치는 부분만 잘라 내고 새 글은
    **첫 조각에만** 넣는다(모든 조각에 넣으면 글이 여러 번 반복된다).
    """
    pos, filled, changed = 0, False, False
    for node in texts:
        text = node.text or ""
        a, b = pos, pos + len(text)
        pos = b
        if b <= start or a >= end:
            continue
        head = text[:max(0, start - a)]
        tail = text[min(len(text), max(0, end - a)):]
        node.text = head + ("" if filled else new) + tail
        filled = True
        changed = True
    return changed


# 선택과목 구역 머리말의 `수학 영역(확률과 통계)` — 괄호 안이 고른 과목이다.
_AREA_OPEN = "수학 영역("


def set_masthead_elective(doc: HwpxDocument, elective: str) -> bool:
    """선택 구역 머리말의 과목 이름을 바꾼다.

    ⚠️ 틀에는 `확률과 통계` 가 박혀 있다. 이걸 바꾸지 않으면 사용자가 미적분을 골라도
       시험지에는 확률과 통계로 인쇄된다(실제로 그랬다). 공통 구역의 머리말은
       괄호가 없는 `수학 영역` 이라 여기에 걸리지 않는다.

    ⚠️ 한 구역에 `수학 영역(…)` 은 **하나가 아니다.** 표지 머리말 하나에 더해
       이어지는 쪽 머리말(짝수 쪽·홀수 쪽)이 있다. 첫 것만 바꾸면 1쪽만 미적분이고
       2쪽부터는 틀에 박힌 확률과 통계가 그대로 인쇄된다. 그래서 **다른 이름이
       남아 있는 곳이 없을 때까지** 되풀이한다.

    ⚠️ 돌려주는 값은 '고쳤는가' 가 아니라 **'머리말이 이제 맞는가'** 다. 고른 과목이
       틀에 박힌 것과 같으면 고칠 것이 없는데, 그걸 실패로 보고하면 호출한 쪽이
       "틀에서 선택과목 머리말을 찾지 못했다" 는 헛경고를 붙인다(실제로 그랬다).
    """
    found = False
    for path in [p for p in doc.list_part_paths()
                 if p.startswith("Contents/section") and p.endswith(".xml")]:
        sec = doc.get_part(path)
        for _ in range(8):          # 되풀이 상한 — 못 고치는 자리에서 맴돌지 않게
            texts = [n for n in sec.root.iter() if n.local_name == "t"]
            joined = "".join(n.text or "" for n in texts)
            hit, at = None, 0
            while True:
                at = joined.find(_AREA_OPEN, at)
                if at < 0:
                    break
                start = at + len(_AREA_OPEN)
                close = joined.find(")", start)
                if close < 0:
                    break
                found = True
                if joined[start:close] != elective:
                    hit = (start, close)
                    break
                at = close + 1
            if hit is None or not _replace_span(texts, hit[0], hit[1], elective):
                break
            sec.mark_modified()
    return found


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
        base = read_equation_base(path)
        if base:
            roles["_eq_base"] = base
    if len(roles) < 3:
        # 이름 붙은 스타일이 없는 틀이면 내용을 보고 추측하는 쪽으로 내려간다.
        roles = read_roles(path)
    # ⚠️ 이름으로 찾은 것을 **쓰임으로 찾은 것이 덮는다.** 이름이 그럴듯해도 실물이
    #    쓰지 않으면 틀린 답이다 — 그림이 실제로 그랬다(docs/MOCK-STYLE-DESIGN.md §8-④).
    roles.update(read_roles_by_usage(path))
    doc = HwpxDocument.open(str(path))
    # ⚠️ 순서가 중요하다 — `clear_body()` 뒤에 부르면 머리말은 이미 지워진 뒤다.
    roles["_page_header"] = capture_page_headers(doc)
    roles["_line_mm"] = read_pad_step_mm(doc, roles)
    roles["_column_tops"] = read_column_tops_mm(doc)
    roles["_marks"] = capture_marks(doc)
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
