"""조판 역할 표가 **실물과 같은가** — 2층 (베타).

`scripts/exam-style-roles.mjs` 는 역할 ↔ 실물 스타일 ↔ 조판 값을 적어 둔 정답표다.
`check-exam-style-roles.mjs`(1층)는 그 표와 **우리 코드**가 같은지를 본다 — 그것만으로는
표 자체가 낡아도 알 수 없다. 우리 표를 우리 표로 검사하는 셈이다(설계 원칙 4 위반).

그래서 여기서 표를 **실물 틀과 직접** 맞춰 본다.

  · 표에 적힌 스타일 이름이 틀에 실제로 있는가
  · 표에 적힌 문단 값(정렬·들여쓰기·여백·줄간격)이 틀에서 읽은 값과 같은가
  · 표에 적힌 탭 정지점이 틀의 탭 정의와 같은가
  · 이름으로 못 찾는 역할(`figure`·`note`)을 쓰임으로 찾은 결과가 표와 같은가

⚠️ 틀은 저작물이라 저장소에 없다. 없으면 **건너뛴다**(종료코드 2) — CI 는 이 검사를
   갖출 방법이 없다. 대신 1층이 CI 에서 항상 돈다.

    python3 test_style_roles.py
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import template as tmpl  # noqa: E402

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
TEMPLATE = ROOT / "평가원 수학 양식.hwpx"
ROLES_JS = ROOT / "scripts" / "exam-style-roles.mjs"

SKIP_UNAVAILABLE = 2   # 저장소에 둘 수 없는 자료가 없어서 건너뜀(실물 틀 — 저작물)
SKIP_FIXABLE = 3       # 설치하거나 파일을 두면 돌 수 있는 건너뜀 — CI 에서는 실패

if not ROLES_JS.exists():
    print(f"역할 표가 없어 건너뜁니다 ({ROLES_JS.name}) — 저장소에 있어야 하는 파일입니다")
    raise SystemExit(SKIP_FIXABLE)
if not TEMPLATE.exists():
    print(f"실물 틀이 없어 건너뜁니다 ({TEMPLATE.name})")
    raise SystemExit(SKIP_UNAVAILABLE)


def load_table() -> dict:
    """역할 표를 읽어 온다.

    ⚠️ 파이썬으로 **다시 옮겨 적지 않는다** — 그러면 사본이 하나 더 늘어난다.
       node 로 그 파일을 그대로 불러 JSON 으로 받는다. node 가 없으면 건너뛴다.
    """
    code = (f"import('file://{ROLES_JS.as_posix()}')"
            ".then(m => console.log(JSON.stringify("
            "{roles: m.ROLES, marks: m.MARK_OBJECTS})))")
    try:
        r = subprocess.run(["node", "-e", code], capture_output=True, text=True, timeout=30)
    except FileNotFoundError:
        print("node 가 없어 건너뜁니다 — 역할 표(.mjs)를 읽을 수 없습니다")
        raise SystemExit(SKIP_FIXABLE)
    if r.returncode != 0:
        print(f"역할 표를 읽지 못했습니다: {r.stderr.strip()[:200]}")
        raise SystemExit(SKIP_FIXABLE)
    return json.loads(r.stdout)


MM = 25.4 / 7200
_TABLE = load_table()
ROLES, MARKS = _TABLE["roles"], _TABLE["marks"]

with zipfile.ZipFile(TEMPLATE) as z:
    HEAD = z.read("Contents/header.xml").decode("utf-8")

fails = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global fails
    fails += not ok
    print(f"  {'✅' if ok else '❌'} {label}" + (f" — {detail}" if detail and not ok else ""))


def para_values(para_id: str) -> dict:
    """틀의 문단 모양에서 정렬·여백·줄간격·탭을 읽는다.

    ⚠️ 여백은 **`<hp:case>`(HwpUnitChar) 분기**를 읽는다 — 한글이 실제로 적용하는 쪽이다.
       `<hp:default>` 는 같은 값이 두 배로 적혀 있어서, 그쪽을 읽으면 표와 전부 어긋난다.
    """
    m = re.search(rf'<hh:paraPr id="{para_id}".*?</hh:paraPr>', HEAD, re.S)
    if not m:
        return {}
    body = m.group(0)
    case = re.search(r"<hp:case\b.*?</hp:case>", body, re.S)
    blk = case.group(0) if case else body
    v = {k: int(x) for k, x in re.findall(r'<hc:(\w+) value="(-?\d+)"', blk)}
    ls = re.search(r'lineSpacing type="\w+" value="(\d+)"', blk)
    return {
        "align": re.search(r'horizontal="([A-Z]+)"', body).group(1),
        "indent": round(v.get("intent", 0) * MM, 2),
        "left": round(v.get("left", 0) * MM, 2),
        "right": round(v.get("right", 0) * MM, 2),
        "below": round(v.get("next", 0) * MM, 2),
        "line": int(ls.group(1)) if ls else None,
        "tab": re.search(r'tabPrIDRef="(\d+)"', body).group(1),
    }


def tab_stops(tab_id: str) -> list[float]:
    """탭 정지점(mm).

    ⚠️ `<hh:tabItem>` 마다 `pos` 가 **두 벌** 적혀 있다(HwpUnitChar / HWPUNIT). 앞의 것이
       실제로 적용되는 값이다 — 뒤엣것을 세면 정지점이 두 배로 나온다.
    """
    m = re.search(rf'<hh:tabPr id="{tab_id}"(?:[^>]*/>|.*?</hh:tabPr>)', HEAD, re.S)
    if not m:
        return []
    items = re.findall(r'<hh:tabItem\b[^>]*?pos="(\d+)"', m.group(0))
    return [round(int(x) * MM, 2) for x in items[0::2]]


named = tmpl.read_named_styles(TEMPLATE)
usage = tmpl.read_roles_by_usage(TEMPLATE)

print("역할 찾기")
for role, spec in ROLES.items():
    if spec["by"] == "name":
        check(f"{role} — 틀에서 이름으로 찾힌다", role in named,
              f"'{spec['names']}' 중 틀에 있는 이름이 없다")
        if role in named:
            check(f"{role} — 고른 이름이 표의 첫 후보다",
                  named[role]["name"] == spec["names"][0],
                  f"틀 '{named[role]['name']}' · 표 '{spec['names'][0]}'")
    else:
        check(f"{role} — 쓰임으로 찾힌다(이름 없는 문단 모양)", role in usage,
              "read_roles_by_usage() 가 못 찾았다")

print("\n문단 값이 실물과 같은가")
found = {**named, **usage}
for role, spec in ROLES.items():
    if role not in found:
        continue
    real = para_values(found[role]["para"])
    want = spec["real"]
    for key in ("align", "indent", "left", "right", "below", "line"):
        if key not in want:
            continue
        got = real.get(key)
        ok = got == want[key] if key in ("align", "line") else abs(got - want[key]) < 0.02
        check(f"{role}.{key}", ok, f"틀 {got} · 표 {want[key]} (문단 모양 {found[role]['para']})")
    if "stops" in want:
        got = tab_stops(real["tab"])
        check(f"{role}.stops", got == want["stops"], f"틀 {got} · 표 {want['stops']}")

# ── 표 개체(구획 태그 · ※ 확인 사항)의 크기 ───────────────────────────────
# 이 둘은 문단이 아니라 표다. 우리가 만들지 않고 틀에서 떠다 심으므로
# (`template.capture_marks()`), 떠 온 표가 표에 적힌 크기와 같아야 한다.
print("\n표 개체가 실물과 같은가")
_doc, _roles = tmpl.open_template(TEMPLATE)     # ⚠️ 본문을 비우므로 맨 마지막에 부른다
marks = _roles.get("_marks") or {}


def tbl_size(xml: str) -> tuple[float, float]:
    m = re.search(r'<hp:sz\b[^>]*width="(\d+)"[^>]*height="(\d+)"', xml)
    return (round(int(m.group(1)) * MM, 2), round(int(m.group(2)) * MM, 2)) if m else (0.0, 0.0)


for key, want in MARKS.items():
    if key == "tag.step":
        got = marks.get("tag_step_mm")
        check(key, got is not None and abs(got - want["v"]) < 0.05,
              f"틀 {got} · 표 {want['v']}")
        continue
    group, name = key.split(".")
    spec = (marks.get("tag") or {}).get(name) if group == "tag" else \
           (marks.get("note") or {}).get(int(name))
    if not spec:
        check(key, False, "틀에서 그 표를 떠 오지 못했다")
        continue
    w, h = tbl_size(spec["tbl"])
    check(f"{key} 폭", abs(w - want["w"]) < 0.02, f"틀 {w} · 표 {want['w']}")
    check(f"{key} 높이", abs(h - want["h"]) < 0.02, f"틀 {h} · 표 {want['h']}")

# ── 이 검사가 실제로 무언가를 검사하는가 ──────────────────────────────────
# 표의 값을 하나 흔들면 빨간불이어야 한다.
print("\n검사가 유효한지")
probe = para_values(found["cond"]["para"])
check("표의 값을 흔들면 어긋난 것이 보인다",
      abs(probe["left"] - (ROLES["cond"]["real"]["left"] + 1.0)) > 0.02,
      "1mm 를 더해도 같다고 나온다 — 비교가 헛돌고 있다")

print()
if fails:
    print(f"실패 {fails}건")
    raise SystemExit(1)
print("전부 통과")
