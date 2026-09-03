"""공통·선택 구역 분리 검사 (베타).

실물 시험지는 공통과 선택이 **서로 다른 구역**이다. 틀 파일도 구역이 둘이고
(`section0` 공통 · `section1` 선택), 선택 구역의 머리말은 `수학 영역(확률과 통계)` 이며
쪽번호가 1 부터 다시 매겨진다. 편집기의 `buildPages()` 도 공통→선택 경계에서 반드시
새 쪽 왼쪽 단부터 시작한다.

예전에는 30문항을 전부 `section0` 에 넣고 `section1` 은 빈 채로 두었다. 그래서
23~30번이 공통 머리말 아래 이어 붙고, 고른 선택과목과 무관하게 틀에 박힌
`확률과 통계` 가 인쇄되며, 마지막에 빈 쪽이 하나 딸려 나왔다.
표본이 6문항(전부 공통·5지선다)뿐이라 아무도 몰랐다.

    python3 test_sections.py
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import mock_to_hwpx  # noqa: E402

HERE = Path(__file__).parent
TEMPLATE = HERE.parents[1] / "평가원 수학 양식.hwpx"
SAMPLE = HERE / "samples" / "full-exam.json"
IMAGES = HERE / "samples" / "images"      # 그림 표본 폴더 (test_structure.py 와 같다)

SKIP_UNAVAILABLE = 2   # 저장소에 둘 수 없는 자료가 없어서 건너뜀(실물 틀 — 저작물)
SKIP_FIXABLE = 3       # 설치하거나 파일을 두면 돌 수 있는 건너뜀 — CI 에서는 실패로 본다

if not SAMPLE.exists():
    print(f"표본이 없어 건너뜁니다 ({SAMPLE.name}) — 저장소에 있어야 하는 파일입니다")
    raise SystemExit(SKIP_FIXABLE)
if not TEMPLATE.exists():
    print(f"실물 틀이 없어 건너뜁니다 ({TEMPLATE.name})")
    raise SystemExit(SKIP_UNAVAILABLE)


def section_text(z: zipfile.ZipFile, index: int) -> str:
    xml = z.read(f"Contents/section{index}.xml").decode("utf-8")
    # 쪽 머리말·꼬리말은 **본문이 아니다.** 같이 펴면 그 글자가 본문 앞에 달라붙어
    # `수학 영역(확률과 통계)3` + `27.` = `…)327.` 이 되고, 번호 정규식의 앞막음에
    # 걸려 27번이 통째로 없는 것처럼 보인다(실제로 그렇게 오진했다).
    xml = re.sub(r"<hp:(header|footer)\b.*?</hp:\1>", "", xml, flags=re.S)
    runs = re.findall(r"<hp:t(?:\s[^>]*)?>(.*?)</hp:t>", xml, re.S)
    joined = "".join(runs)
    # 탭은 글자 사이를 벌리는 **공백**이다. 그냥 지우면 `16.` 과 발문이 붙어
    # `16. ` 을 찾는 검사가 헛돈다(실물처럼 번호 뒤를 탭으로 바꾸자 그렇게 됐다).
    joined = re.sub(r"<hp:tab[^>]*/>", " ", joined)
    return re.sub(r"<[^>]+>", "", joined)


def problem_numbers(text: str) -> list[int]:
    """`12. ` 꼴로 시작하는 문항 번호. 본문 속 숫자와 섞이지 않게 앞을 막는다."""
    return [int(n) for n in re.findall(r"(?<![0-9])(\d{1,2})\. ", text)]


def build(data: dict) -> zipfile.ZipFile:
    tmp = tempfile.TemporaryDirectory()
    build.keep.append(tmp)                      # 검사가 끝날 때까지 살려 둔다
    out = Path(tmp.name) / "exam.hwpx"
    mock_to_hwpx.build(data, out, images=[IMAGES])
    return zipfile.ZipFile(out)


build.keep = []

data = json.loads(SAMPLE.read_text(encoding="utf-8"))
fails = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global fails
    fails += not ok
    print(f"  {'✅' if ok else '❌'} {label}" + (f" — {detail}" if detail else ""))


# ── 1. 30문항이 구역별로 갈려 실린다 ──────────────────────────────────────
z = build(data)
common, elective = section_text(z, 0), section_text(z, 1)
nums0, nums1 = problem_numbers(common), problem_numbers(elective)

print("문항 배치")
check("공통 구역에 1~22번", nums0 == list(range(1, 23)), f"{nums0}")
check("선택 구역에 23~30번", nums1 == list(range(23, 31)), f"{nums1}")
check("30문항이 하나도 빠지지 않았다", sorted(nums0 + nums1) == list(range(1, 31)),
      f"{len(nums0) + len(nums1)}개")

# ── 2. 머리말 ─────────────────────────────────────────────────────────────
print("\n머리말")
check("공통 구역은 괄호 없는 '수학 영역'",
      "수학 영역" in common and "수학 영역(" not in common)
m = re.search(r"수학 영역\(([^)]*)\)", elective)
check("선택 구역은 '수학 영역(선택과목)'", bool(m), m.group(0) if m else "없음")

for name in ("미적분", "기하", "확률과 통계"):
    z2 = build({**data, "elective": name})
    got = re.search(r"수학 영역\(([^)]*)\)", section_text(z2, 1))
    check(f"고른 과목 '{name}' 이 머리말에 반영된다",
          bool(got) and got.group(1) == name, got.group(1) if got else "없음")

# ── 3. 단답형 문항은 선지를 싣지 않는다 ───────────────────────────────────
# 16번에는 선지 블록이 남아 있지만 type 이 short 다. 편집기도 숨기기만 하고
# 지우지 않으므로(객관식으로 되돌리면 살아난다) 시험지에만 안 나와야 한다.
print("\n단답형")
p16 = next(p for p in data["problems"] if p["num"] == 16)
check("표본 16번은 선지 블록을 갖고 있다",
      any(b["type"] == "choices" for b in p16["blocks"]))
check("그런데 시험지에는 그 선지가 없다", "①" not in common.split("16. ")[1].split("17. ")[0])

# ── 4. 선택 문항이 없으면 선택 구역은 비어 있다 ───────────────────────────
print("\n공통만 있는 시험지")
only_common = {**data, "problems": [p for p in data["problems"] if p["sect"] != "선택"]}
z3 = build(only_common)
check("선택 구역에 문항이 들어가지 않는다", problem_numbers(section_text(z3, 1)) == [])

# ── 4-2. 구획 태그(단답형)와 ※ 확인 사항 ─────────────────────────────────
#
# 둘 다 **표 개체**다(docs/MOCK-STYLE-DESIGN.md §9). 실물에서 잰 값과 직접 맞춘다 —
# 우리 코드가 우리 코드를 검사하지 않게 하려는 것이다(설계 원칙 4).
#
#   단답형 태그   27.84 × 8.28mm   · 태그가 먹는 높이 15.9mm(태그 위 끝 → 첫 문항)
#   ※ 확인 사항   111.00 × 35.64mm(3줄) · 111.00 × 21.15mm(2줄)
print("\n구획 태그 · ※ 확인 사항")
HP = "http://www.hancom.co.kr/hwpml/2011/paragraph"
MM = 7200 / 25.4

# ⚠️ 여기서는 **정규식으로 문단을 자르면 안 된다.** 표 안에 문단이 또 있어서
#    `<hp:p ...>.*?</hp:p>` 가 표 안쪽에서 먼저 닫힌다 — 표가 통째로 안 보인다
#    (실제로 그렇게 만들었다가 검사 6건이 헛돌았다). 문서 트리로 훑는다.
from lxml import etree  # noqa: E402


def top_paragraphs(z: zipfile.ZipFile, index: int) -> list:
    root = etree.fromstring(z.read(f"Contents/section{index}.xml"))
    return [e for e in root if etree.QName(e).localname == "p"]


def tables(z: zipfile.ZipFile, index: int) -> list[dict]:
    """구역 안의 표들 — 문단 번호·크기(mm)·글·붙은 문단의 나눔 속성."""
    out = []
    for pi, para in enumerate(top_paragraphs(z, index)):
        for tbl in para.iter(f"{{{HP}}}tbl"):
            sz = tbl.find(f"{{{HP}}}sz")
            pos = tbl.find(f"{{{HP}}}pos")
            out.append({
                "para": pi,
                "w": int(sz.get("width")) / MM, "h": int(sz.get("height")) / MM,
                "text": re.sub(r"\s+", "", "".join(tbl.itertext())),
                "lines": len([x for x in tbl.iter(f"{{{HP}}}p")]),
                "pos": dict(pos.attrib) if pos is not None else {},
                "cb": para.get("columnBreak") == "1",
                "pb": para.get("pageBreak") == "1",
            })
    return out


def para_numbers(z: zipfile.ZipFile, index: int) -> dict[int, int]:
    """문단 번호 → 그 문단이 시작하는 문항 번호(표·머리말 글자는 뺀다)."""
    found = {}
    for pi, para in enumerate(top_paragraphs(z, index)):
        clone = etree.fromstring(etree.tostring(para))
        for junk in list(clone.iter(f"{{{HP}}}tbl")) + list(clone.iter(f"{{{HP}}}header")):
            junk.getparent().remove(junk)
        m = re.match(r"\s*(\d{1,2})\.", "".join(clone.itertext()))
        if m:
            found[pi] = int(m.group(1))
    return found


z4 = build(data)
for sec_i, first_short, label in ((0, 16, "공통"), (1, 29, "선택")):
    tbl = tables(z4, sec_i)
    tags = [t for t in tbl if t["text"] == "단답형"]
    check(f"{label} 구역에 '단답형' 태그가 하나 있다", len(tags) == 1, f"{len(tags)}개")
    if tags:
        t = tags[0]
        check(f"{label} 태그 크기가 실물과 같다 (27.84×8.28mm)",
              abs(t["w"] - 27.84) < 0.1 and abs(t["h"] - 8.28) < 0.1,
              f"{t['w']:.2f}×{t['h']:.2f}mm")
        nums = para_numbers(z4, sec_i)
        after = [n for pi, n in sorted(nums.items()) if pi > t["para"]]
        check(f"{label} 태그 바로 뒤가 첫 단답형 문항({first_short}번)이다",
              bool(after) and after[0] == first_short, str(after[:2]))
        # 태그가 단(또는 쪽) 첫머리를 안아야 문항이 태그 아래로 온다.
        check(f"{label} 태그 문단이 단나눔·쪽나눔을 안고 있다", t["cb"] or t["pb"],
              f"cb={t['cb']} pb={t['pb']}")

    notes = [t for t in tbl if t["text"].startswith("*확인사항")]
    check(f"{label} 구역에 '※ 확인 사항' 이 하나 있다", len(notes) == 1, f"{len(notes)}개")
    if notes:
        n = notes[0]
        want_h, want_lines = (35.64, 3) if sec_i == 0 else (21.15, 2)
        check(f"{label} 확인 사항 크기가 실물과 같다 (111.00×{want_h}mm)",
              abs(n["w"] - 111.0) < 0.1 and abs(n["h"] - want_h) < 0.1,
              f"{n['w']:.2f}×{n['h']:.2f}mm")
        check(f"{label} 확인 사항은 {want_lines}줄이다", n["lines"] == want_lines, f"{n['lines']}줄")
        # 쪽 기준 절대배치 — 흐름에 자리를 차지하지 않고 오른쪽 아래에 붙는다.
        # ⚠️ **마지막 쪽**에 있어야 한다. 쪽 기준 절대배치라 어느 문단에 매다느냐가
        #    '몇 쪽에 나오는가' 를 정한다 — 앞 쪽 문단에 매달면 시험 도중에 튀어나온다.
        breaks = [pi for pi, para in enumerate(top_paragraphs(z4, sec_i))
                  if para.get("pageBreak") == "1"]
        check(f"{label} 확인 사항이 그 구역 마지막 쪽에 있다",
              n["para"] >= (max(breaks) if breaks else 0),
              f"문단 {n['para']} · 마지막 쪽 시작 {max(breaks) if breaks else 0}")
        check(f"{label} 확인 사항이 쪽 기준 오른쪽 아래에 붙는다",
              n["pos"].get("vertRelTo") == "PAGE" and n["pos"].get("vertAlign") == "BOTTOM"
              and n["pos"].get("treatAsChar") == "0",
              str({k: n["pos"].get(k) for k in ("treatAsChar", "vertRelTo", "vertAlign")}))

# 공통 상자에는 고른 선택과목 이름이 들어간다(틀의 '미적분' 이 그대로 나가면 안 된다).
note0 = [t for t in tables(z4, 0) if t["text"].startswith("*확인사항")]
check("공통 확인 사항에 고른 과목 이름이 들어간다",
      bool(note0) and "선택과목(확률과통계)" in note0[0]["text"],
      note0[0]["text"][-40:] if note0 else "없음")
z5 = build({**data, "elective": "기하"})
note5 = [t for t in tables(z5, 0) if t["text"].startswith("*확인사항")]
check("과목을 바꾸면 그 이름으로 바뀐다",
      bool(note5) and "선택과목(기하)" in note5[0]["text"],
      note5[0]["text"][-40:] if note5 else "없음")

# 태그가 먹는 높이 — 실물에서 잰 15.9mm 여야 한다(단의 '위 여백' 이 된다).
step = float((mock_to_hwpx.TMPL_MARKS.get("tag_step_mm") or 0))
check("태그가 먹는 높이를 틀에서 읽는다 (실물 15.9mm)", abs(step - 15.9) < 0.5,
      f"{step:.2f}mm")

# ── 5. 이 검사가 실제로 무언가를 검사하는가 ───────────────────────────────
# 구역 배정을 뭉개면(전부 구역 0) 위 검사들이 빨간불이어야 한다.
print("\n검사가 유효한지")
real_cur = mock_to_hwpx.CUR


class PinnedToZero(dict):
    """어느 구역을 쓰라고 해도 0 을 준다 — 고치기 전 동작."""

    def __setitem__(self, key, value):
        super().__setitem__(key, 0)


mock_to_hwpx.CUR = PinnedToZero(sec=0)
try:
    broken = build(data)
    broken0 = problem_numbers(section_text(broken, 0))
    broken1 = problem_numbers(section_text(broken, 1))
finally:
    mock_to_hwpx.CUR = real_cur

check("구역 배정을 뭉개면 선택 문항이 공통 구역으로 넘어간다",
      broken1 == [] and sorted(broken0) == list(range(1, 31)),
      f"공통 {len(broken0)}개 · 선택 {len(broken1)}개")
check("그때 위의 '선택 구역에 23~30번' 검사가 실제로 빨간불이 된다",
      broken1 != list(range(23, 31)))

if fails:
    print(f"\n실패 {fails}건")
    raise SystemExit(1)
print("\n전부 통과")
