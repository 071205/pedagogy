"""문항 배치 규칙 검사 (베타).

`mock_to_hwpx.column_starts()` 가 편집기의 `buildPages()` 와 **같은 규칙**인지 본다.
여기가 어긋나면 화면 미리보기와 실제 시험지의 문항 위치가 달라진다.

편집기(mock-exam-editor.html)의 규칙:

    cur.push(p);
    if (cur.length >= SPEC.perCol || p.breakAfter || (다음 문항의 sect 가 다름))
        새 단;

    python3 test_layout.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from mock_to_hwpx import PER_COL, column_starts  # noqa: E402


def prob(num: int, *, sect: str = "공통", br: bool = False) -> dict:
    return {"num": num, "sect": sect, "breakAfter": br}


CASES = [
    ("한 단에 2문항 — 6문항이면 3단",
     [prob(i) for i in range(1, 7)], {2, 4}),
    ("breakAfter 는 거기서 끊는다",
     [prob(1, br=True), prob(2), prob(3), prob(4)], {1, 3}),
    ("과목 구분이 바뀌면 끊는다",
     [prob(1), prob(2), prob(3, sect="선택"), prob(4, sect="선택")], {2}),
    ("문항이 하나면 나눌 곳이 없다", [prob(1)], set()),
    ("빈 목록", [], set()),
]

fails = 0
print(f"PER_COL = {PER_COL} (편집기 SPEC.perCol 과 같아야 한다)")
for label, probs, want in CASES:
    got = column_starts(probs)
    ok = got == want
    fails += not ok
    print(f"  {'✅' if ok else '❌'} {label}: {sorted(got)}"
          + ("" if ok else f"  ← 기대 {sorted(want)}"))

# 검사가 실제로 실패하는지 — 규칙을 어긋내면 결과가 달라져야 한다
import mock_to_hwpx  # noqa: E402

mock_to_hwpx.PER_COL = 3
broken = column_starts([prob(i) for i in range(1, 7)])
mock_to_hwpx.PER_COL = PER_COL
if broken == {2, 4}:
    print("  ❌ PER_COL 을 바꿔도 결과가 같다 — 이 검사는 아무것도 검사하지 않는다")
    fails += 1
else:
    print(f"  ✅ 고의로 PER_COL=3 으로 바꾸면 {sorted(broken)} 로 달라진다(검사가 유효)")

print()
if fails:
    print(f"실패 {fails}건")
    raise SystemExit(1)
print(f"전부 통과 ({len(CASES) + 1}건)")
