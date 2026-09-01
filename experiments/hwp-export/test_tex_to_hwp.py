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

# 편집기 예제 문항에 실제로 들어 있던 것들 (samples/editor-seed.json)
SHAPE = [
    ("조판 힌트 \\limits 는 무시", r"\lim\limits_{h\to0} f(h)", "lim"),
    ("조판 힌트 \\displaystyle 는 무시", r"\displaystyle\int_{-2}^{a} f(x)\,dx", "int"),
    ("수열의 중괄호는 글자로 찍힌다", r"\{a_n\}", "lbrace"),
    ("인자 하나짜리 분수 \\frac13", r"\frac13", "{1}over{3}"),
    ("중괄호 없는 근호 \\sqrt3", r"15\sqrt3", "sqrt{3}"),
    ("윗줄 (선분 표기)", r"\overline{AB}<\overline{AC}", "bar"),
]

# 변환은 되지만 실물 대조본이 없는 것들 — 모양만 확인한다
SHAPE2 = [
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

print("\n[3] 편집기 예제 문항에 실제로 있던 표기")
for label, tex, must in SHAPE:
    try:
        got = convert(tex)
        check(f"{label} — {got[:50]}", must in normalize(got) or must in got,
              f"'{must}' 가 없음: {got}")
    except UnsupportedTex as e:
        check(label, False, f"변환 실패: {e}")

print("\n[4] 모양 확인 (실물 대조본 없음)")
for label, tex, must in SHAPE2:
    try:
        got = convert(tex)
        check(f"{label} — {got[:56]}", must in got, f"'{must}' 가 없음: {got}")
    except UnsupportedTex as e:
        check(label, False, f"변환 실패: {e}")

print("\n[4-1] LaTeX 공백 명령")
# 30문항 시험지를 처음 변환해 보고서야 `\ `(역슬래시+공백)가 빠진 것을 알았다.
# `\mathrm{B}\!\left(20,\ \dfrac13\right)` 처럼 실제로 흔히 쓰는 표기가 통째로
# `[수식 변환 실패]` 로 나갔다. `\,` `\;` `\quad` 는 이미 있었다.
for label, tex in [
        ("역슬래시+공백", r"a\ b"),
        ("\\: 중간 공백", r"a\:b"),
        ("실제로 터졌던 표기", r"\mathrm{B}\!\left(20,\ \dfrac13\right)"),
        ("정규분포 표기", r"\mathrm{N}(m,\ \sigma^2)"),
]:
    try:
        got = convert(tex)
        check(f"{label} — {got[:52]}", True)
    except UnsupportedTex as e:
        check(label, False, f"변환 실패: {e}")

print("\n[4-2] 한컴 공개 규격서(수식 revision 1.3)와 맞는가")
# ⚠️ 아래는 실물 시험지에서 '유도한' 것이 아니라 **규격서에 적힌 것**이다.
#    출처: 한글 문서 파일 구조 - 수식 revision 1.3 (한컴 공개 문서)
SPEC = [
    # (규격서 절, 라벨, 입력, 결과에 반드시 있어야 하는 것)
    ("1.2",     "행렬은 MATRIX/PMATRIX/BMATRIX/DMATRIX 넷뿐 — vmatrix 는 없는 명령",
     r"\begin{vmatrix}a&b\\c&d\end{vmatrix}", "dmatrix"),
    ("1.1.2.3", "9자 넘는 낱말은 따옴표로 묶어야 한 항으로 처리된다",
     r"\mathrm{Probability}", '"Probability"'),
    ("1.2.1",   "글자 장식 acute", r"\acute{a}", "acute"),
    ("1.2.1",   "글자 장식 under(밑줄)", r"\underline{xy}", "under"),
    ("1.2.1",   "글자 장식 arch(breve)", r"\breve{a}", "arch"),
    ("1.2",     "적분 OINT", r"\oint f", "oint"),
    ("1.2.4",   "그리스 대문자는 대문자로", r"\Gamma", "GAMMA"),
    ("1.2.4",   "varepsilon 은 그대로", r"\varepsilon", "varepsilon"),
]
for clause, label, tex, must in SPEC:
    try:
        got = convert(tex)
        check(f"[{clause}] {label} — {got[:44]}", must in got, f"'{must}' 가 없음: {got}")
    except UnsupportedTex as e:
        check(f"[{clause}] {label}", False, f"변환 실패: {e}")

# 9자 규칙이 **명령 이름까지 망가뜨리면 안 된다** — varepsilon(10자)은 명령이지 낱말이 아니다.
got = convert(r"\varepsilon")
check("9자 규칙이 명령 이름은 건드리지 않는다", '"' not in got, f"명령이 따옴표에 묶였다: {got}")

# 경계값: 정확히 9자는 묶지 않고, 10자부터 묶는다.
check("9자는 그대로", '"' not in convert("abcdefghi"), convert("abcdefghi"))
check("10자는 묶는다", '"abcdefghij"' in convert("abcdefghij"), convert("abcdefghij"))

print("\n[5] 모르는 명령은 조용히 버리지 않고 알린다")
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
