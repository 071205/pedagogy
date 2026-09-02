"""생성물의 문단 흐름이 실물과 같은지 검사 (베타).

실물 `평가원 수학 양식.hwpx` 의 스타일 이어짐을 세어 얻은 구조다.

    01-문제 → 21 박스위 → 21 박스(테두리) → 21 박스아래 → 21 문제다음   (실물 7회 일관)

이 순서가 어긋나면 상자 뒤 발문이 상자에 딱 붙거나 앞이 벌어진다.

    python3 test_structure.py
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from lxml import etree  # noqa: E402

import mock_to_hwpx  # noqa: E402

HP = "http://www.hancom.co.kr/hwpml/2011/paragraph"
HERE = Path(__file__).parent
TEMPLATE = HERE.parents[1] / "평가원 수학 양식.hwpx"
SAMPLE = HERE / "samples" / "with-figure.json"


def styles_of(path: Path) -> list[tuple[str, str, bool]]:
    """(스타일 이름, 글, 그림인가) 순서대로."""
    z = zipfile.ZipFile(path)
    head = z.read("Contents/header.xml").decode("utf-8")
    names = {m.group(1): m.group(2) for m in
             re.finditer(r'<hh:style id="(\d+)"[^>]*name="([^"]*)"', head)}
    out = []
    for part in [n for n in z.namelist() if n.startswith("Contents/section")]:
        for p in (e for e in etree.fromstring(z.read(part))
                  if etree.QName(e).localname == "p"):
            out.append((names.get(p.get("styleIDRef"), "?"),
                        "".join(p.itertext()).strip(),
                        bool(list(p.iter(f"{{{HP}}}pic")))))
    return out


SKIP_UNAVAILABLE = 2   # 저장소에 둘 수 없는 자료가 없어서 건너뜀(실물 틀 — 저작물)
SKIP_FIXABLE = 3       # 설치하거나 파일을 두면 돌 수 있는 건너뜀 — CI 에서는 실패로 본다

if not SAMPLE.exists():
    print(f"표본이 없어 건너뜁니다 ({SAMPLE.name}) — 저장소에 있어야 하는 파일입니다")
    raise SystemExit(SKIP_FIXABLE)
if not TEMPLATE.exists():
    print(f"실물 틀이 없어 건너뜁니다 ({TEMPLATE.name})")
    raise SystemExit(SKIP_UNAVAILABLE)

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "t.hwpx"
    mock_to_hwpx.build(json.loads(SAMPLE.read_text(encoding="utf-8")), out,
                       ref=TEMPLATE, images=[HERE / "samples" / "images"])
    seq = styles_of(out)
    # ⚠️ 임시 폴더는 이 블록을 벗어나면 지워진다. 뒤에서 볼 XML 은 여기서 떠 둔다.
    _z = zipfile.ZipFile(out)
    HEAD_XML = _z.read("Contents/header.xml").decode("utf-8")
    SEC0_XML = _z.read("Contents/section0.xml").decode("utf-8")

names = [s for s, _, _ in seq]
fails = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global fails
    fails += not ok
    print(f"  {'✅' if ok else '❌'} {label}" + (f" — {detail}" if detail and not ok else ""))


print("문단 흐름")
# 조건 상자는 앞뒤 여백 문단으로 감싸여야 한다
box = [i for i, n in enumerate(names) if n == "21 박스(테두리)"]
check("조건 상자가 있다", bool(box))
if box:
    first, last = box[0], box[-1]
    check("상자 앞에 '21 박스위'", names[first - 1] == "21 박스위", names[first - 1])
    check("상자 뒤에 '21 박스아래'", names[last + 1] == "21 박스아래", names[last + 1])
    check("그 뒤 발문은 '21 문제다음'", names[last + 2] == "21 문제다음", names[last + 2])

# 그림은 가운데 정렬 문단에
# ⚠️ **스타일 이름으로 보면 안 된다.** 실물이 그림에 쓰는 문단 모양은 **이름이 없다**
#    (paraPr 49). 이름이 그럴듯한 `보기`·`표 내용` 은 실물에서 0회 쓰인다 —
#    예전에 이 검사가 그 이름을 요구해서, 우리 그림이 실물과 다른 모양으로 나가는데도
#    초록불이었다(docs/MOCK-STYLE-DESIGN.md §8-④). **정렬을 직접 본다.**
def _align_of(para_id: str) -> str:
    m = re.search(rf'<hh:paraPr\b[^>]*\bid="{para_id}"[^>]*>.*?</hh:paraPr>', HEAD_XML, re.S)
    a = re.search(r'<hh:align\b[^>]*horizontal="([A-Z]+)"', m.group(0)) if m else None
    return a.group(1) if a else "?"


_fig_ids = re.findall(r'<hp:p\b[^>]*paraPrIDRef="(\d+)"[^>]*>(?:(?!</hp:p>).)*?<hp:pic\b',
                      SEC0_XML, re.S)
check("그림이 가운데 정렬 문단에 있다",
      bool(_fig_ids) and all(_align_of(i) == "CENTER" for i in _fig_ids),
      f"문단 모양 {_fig_ids} → 정렬 {[_align_of(i) for i in _fig_ids]}")

# 첫 문항은 틀 문단(머리말과 같은 문단)에 이어 써야 빈 줄이 안 생긴다
check("첫 문단에 머리말과 1번이 함께 있다",
      "수학 영역" in seq[0][1] and "1." in seq[0][1], seq[0][1][:40])

# 수식 기준 크기는 본문이 아니라 틀에서 온다
base = mock_to_hwpx.eq_base()
check("수식 기준 크기를 틀에서 가져온다(본문 크기가 아님)", base == 1100, str(base))

print()
if fails:
    print(f"실패 {fails}건")
    raise SystemExit(1)
print("전부 통과")
