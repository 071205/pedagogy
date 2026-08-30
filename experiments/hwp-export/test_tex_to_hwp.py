"""tex_to_hwp 검사 — 실물 수식을 기준으로 삼는다 (베타).

기준은 내가 지어낸 예시가 아니라 `2025학년도 수능 수학 문제.hwp` 에서 뽑은 실제 수식이다.
각 항목은 (실물 HWP 스크립트, 그와 같은 뜻의 LaTeX) 쌍이고, 변환 결과가 실물과
같아지는지를 공백 무시로 비교한다.

    python3 test_tex_to_hwp.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from tex_to_hwp import UnsupportedTex, convert, normalize  # noqa: E402

# (설명, LaTeX 입력, 실물에서 뽑은 HWP 스크립트)
CASES = [
    ("거듭제곱근 × 분수지수 (1번 문항)",
     r"\sqrt[3]{5} \times 25^{\frac{1}{3}}",
     " sqrt {3} of {5}  times 25^{{1} over {3}}"),

    ("부등식 사슬",
     r"2 f\left(1\right) \leq f\left(2\right) \leq f\left(3\right)",
     "2 f left(1  right)  leq f left(2  right)  leq f left(3  right)"),

    # 실물이 `2 n` 으로 띄어 쓰여 있어 LaTeX 쪽도 같게 둔다.
    # 변환기는 입력의 띄어쓰기를 그대로 옮기므로(`2n` 을 넣으면 `2n` 이 나온다),
    # 이 검사는 '실물과 같은 입력이 실물과 같은 출력을 낸다' 를 확인한다.
    ("극한·합",
     r"\lim_{n \to \infty} \sum_{k=1}^{2 n} a_{k} > \frac{1}{700}",
     " lim _{n ``rarrow``  inf }  sum_{k=1}^{2 n} a_{k} >{1} over {700}"),

    ("분수",
     r"\frac{1}{2} a_{n}",
     "{1} over {2} a _{n}"),
]

# 위·아래 첨자 범위. 한글에서 x^(2-a) 로 잘못 조판되던 것을 잡는다.
SCOPE = [
    ("첨자 범위를 중괄호로 묶는다", r"x^2-a", "x^{2}-a"),
    ("아래 첨자도 마찬가지", r"a_n+1", "a_{n}+1"),
    ("이미 묶인 것은 그대로", r"x^{2-a}", "x^{2-a}"),
    ("첨자 안 명령도 묶인다", r"x^\alpha", "x^{ alpha }"),
]

# 변환은 되지만 실물 대조본이 없는 것들 — 모양만 확인한다
SHAPE = [
    ("경우 나눔", r"f(x) = \begin{cases} 5x+a & (x < -2) \\ x^2-a & (x \geq -2) \end{cases}",
     "cases{"),
    ("행렬", r"\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}", "pmatrix{"),
    ("벡터", r"\vec{a} \cdot \vec{b}", "vec"),
    ("제곱근", r"\sqrt{x^2+y^2}", "sqrt"),
]

fails = []
passes = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global passes
    if ok:
        passes += 1
        print(f"  ✅ {label}")
    else:
        fails.append(label)
        print(f"  ❌ {label}\n     {detail}")


print("[1] 실물 수식과 대조")
for label, tex, real in CASES:
    try:
        got = convert(tex)
    except UnsupportedTex as e:
        check(label, False, f"변환 실패: {e}")
        continue
    ok = normalize(got) == normalize(real)
    check(label, ok, f"기대(실물): {normalize(real)}\n     실제:      {normalize(got)}")

print("\n[2] 위·아래 첨자 범위 (수식 뜻이 바뀌던 버그)")
for label, tex, want in SCOPE:
    try:
        got = convert(tex)
        check(f"{label} — {tex} → {got}", normalize(got) == normalize(want),
              f"기대: {normalize(want)} / 실제: {normalize(got)}")
    except UnsupportedTex as e:
        check(label, False, f"변환 실패: {e}")

print("\n[3] 모양 확인 (실물 대조본 없음)")
for label, tex, must in SHAPE:
    try:
        got = convert(tex)
        check(f"{label} — {got[:56]}", must in got, f"'{must}' 가 없음: {got}")
    except UnsupportedTex as e:
        check(label, False, f"변환 실패: {e}")

print("\n[4] 모르는 명령은 조용히 버리지 않고 알린다")
try:
    convert(r"\somethingweird{x}")
    check("모르는 명령에 예외", False, "예외가 나지 않았습니다 — 수식이 조용히 사라질 수 있음")
except UnsupportedTex:
    check("모르는 명령에 예외", True)

try:
    convert(r"\frac{1}{2")
    check("닫히지 않은 중괄호에 예외", False, "예외가 나지 않았습니다")
except UnsupportedTex:
    check("닫히지 않은 중괄호에 예외", True)

print()
if fails:
    print(f"실패 {len(fails)}건 / 통과 {passes}건")
    raise SystemExit(1)
print(f"전부 통과 ({passes}건)")
