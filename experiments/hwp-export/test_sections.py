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
