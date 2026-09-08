#!/usr/bin/env python3
"""실물 시험지 파일에서 **조판 틀만** 남긴 배포용 틀을 만든다.

    python3 experiments/hwp-export/make_exam_template.py "평가원 수학 양식.hwpx"

⚠️ **왜 필요한가.** 실물 파일에는 2025 수능 문제·도형과 만든 사람 이름(532곳)이 들어 있어
   저장소에 올릴 수 없었고, 그래서 시험지 HWPX 내보내기는 **이 컴퓨터에서만** 됐다.
   조판에 필요한 것은 **틀**(구역·단·스타일·머리말·표 개체)뿐이므로 내용을 전부 벗긴다.

⚠️ **세 단계를 모두 거쳐야 한다.** 하나라도 빠지면 "벗겼다" 는 말이 사실이 아니다:
     strip_to_frame  남의 문제 (⚠️ `clear_body` 가 아니다 — 그것은 이어지는 쪽 머리말과
                     구획 태그 표까지 지워, 변환기가 떠 올 것이 없어진다)
     shrink_images   그림(BinData) — 지우지 않고 1×1 로 바꾼다(figure 역할 판정에 필요)
     strip_identity  **미리보기 글·썸네일·작성자 메타** ← 이것을 빼먹으면 미리보기에
                     문제 전문이 그대로 남는다(실측으로 확인했다)

만든 틀이 실물과 같은 조판을 내는지는 `test_style_roles.py` 와 `test_structure.py` 가 본다.
"""
from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import template as tmpl                       # noqa: E402
from pedagogy_hwpx import HwpxDocument        # noqa: E402

OUT = HERE / "templates" / "exam-math.hwpx"


def build(src: Path, out: Path = OUT) -> dict:
    doc = HwpxDocument.open(src)
    frame = tmpl.strip_to_frame(doc)      # ⚠️ clear_body 가 아니다 — 위 함수 주석 참고
    report = {
        "문단": f"글 조각 {frame['바꾼 글 조각']}개 채움글자로 · 수식 {frame['지운 수식']}개 지움 · 틀 안쪽 글 {frame['틀 안쪽 글']}개 유지",
        "그림": tmpl.shrink_images(doc),
        "신원": tmpl.strip_identity(doc),
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out)
    report["크기"] = f"{src.stat().st_size:,} → {out.stat().st_size:,} 바이트"
    return report


# 틀에 **남아 있어도 되는 글**. 시험지 형식 그 자체이고, 변환기가 만드는 모든 시험지에
# 어차피 찍힌다(표제부·이어지는 쪽 머리말·구획 태그·※ 확인 사항).
# ⚠️ 여기에 무언가를 더할 때는 **그것이 형식인지 남의 내용인지** 먼저 판단할 것.
# ⚠️ 선택과목은 **세 갈래가 모두 들어 있다**(확률과 통계·미적분·기하). 하나만 적으면
#    나머지가 '남의 내용' 으로 잡힌다. 그래서 과목 이름을 패턴으로 받는다.
ELECTIVE = r"(?:확률과 통계|미적분|기하)"
FRAME_PATTERNS = [
    r"2025학년도 대학수학능력시험 문제지",
    rf"수학 영역\({ELECTIVE}\)",
    r"수학 영역",
    r"제ᅟ?2ᅟ?교시", r"제 2 교시", r"제2교시",
    r"5지선다형", r"단답형", r"홀수형", r"짝수형",
    # 구획 태그는 run 이 쪼개져 '단' 과 '답형' 으로 따로 오기도 한다
    r"답형", r"단",
    # ※ 는 기호 글꼴로 찍힌 `*` 다(CLAUDE.md). 확인 사항 상자의 글도 형식이다.
    r"확인 사항",
    r"답안지의 해당란에 필요한 내용을 정확히 기입\(표기\)했는지 확인하시오\.",
    rf"이어서, 「선택과목\({ELECTIVE}\)」 문제가 제시되오니, 자신이 선택한 과목인지 확인하시오\.",
]

# 채움글자와 구조 표시. `_KEEP_CHARS` 와 같은 뜻이지만 **여기서 따로 적는다** —
# 만드는 코드의 상수를 그대로 가져다 쓰면 그 상수가 틀렸을 때 검사도 함께 틀린다.
ALLOWED_CHARS = set("가0123456789.,()[]①②③④⑤※◦*「」 \t\r\n\u3000")


def leftovers(path: Path) -> list[str]:
    """배포용 틀에 **남의 내용이 남았는지** 구조로 확인한다.

    ⚠️ **금칙어 목록으로 하면 안 된다.** 처음엔 네 낱말(`백승우`·`수학능력시험`·
       `의 값은?`·`huryul`)만 찾았고 **빈 목록을 돌려주면서** 실제로는 원본 수식 522개와
       한글 텍스트 노드 171개가 남아 있었다(`REV-2026-030`). 찾을 것을 나열하는 검사는
       나열하지 않은 것을 통과시킨다.
       → 뒤집는다: **허용한 것 말고는 전부 실패**로 본다.

    ⚠️ 만드는 코드(`template.strip_to_frame`)와 **다른 방식으로** 읽는다 — 그쪽은 노드를
       고쳐 가며 훑고 이쪽은 완성된 파일을 ZIP 으로 다시 연다. 같은 가정으로 만들고 같은
       가정으로 확인하면 둘이 함께 틀린다.
    """
    from lxml import etree

    bad: list[str] = []
    with zipfile.ZipFile(path) as z:
        parts = [n for n in z.namelist()
                 if n.startswith("Contents/section") and n.endswith(".xml")]
        for name in parts:
            root = etree.fromstring(z.read(name))

            # ① 수식 — 자리표시자(`1`) 말고는 남으면 안 된다
            scripts = [(e.text or "").strip() for e in root.iter()
                       if etree.QName(e).localname == "script"]
            real = [x for x in scripts if x and x != "1"]
            if real:
                bad.append(f"{name}: 원본 수식 {len(real)}개 (예: {real[0][:40]!r})")

            # ② 글 — 허용 글자와 형식 문구를 걷어내고 남는 것이 있으면 남의 내용이다
            # ⚠️ **`.text` 만 읽으면 안 된다.** `<hp:t>값<hp:tab/>은?</hp:t>` 의 `은?` 은
            #    `<hp:tab>` 의 꼬리라 `.text` 에 없다 — 만드는 쪽도 여기도 `.text` 만 봐서
            #    **둘이 함께** 원본 발문을 놓쳤다(`REV-2026-030` 재발).
            text = "".join((e.text or "") + (e.tail or "") for e in root.iter())
            for pattern in FRAME_PATTERNS:
                text = re.sub(pattern, "", text)
            rest = "".join(c for c in text if c not in ALLOWED_CHARS)
            if rest:
                uniq = "".join(dict.fromkeys(rest))
                bad.append(f"{name}: 형식이 아닌 글 {len(rest)}자 (예: {uniq[:30]!r})")

        # ③ 미리보기·메타에 사람 정보가 남았는지
        blob = "".join(z.read(n).decode("utf-8", "ignore") for n in z.namelist())
        for needle, why in [("백승우", "만든 사람 이름"), ("huryul", "저장한 사람 계정")]:
            if needle in blob:
                bad.append(f"{why}('{needle}') {blob.count(needle)}건")
        prv = z.read("Preview/PrvText.txt").decode("utf-8", "ignore").strip()
        if prv:
            bad.append(f"미리보기 글 {len(prv)}자 ({prv[:30]!r})")
    return bad


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("평가원 수학 양식.hwpx")
    if not src.exists():
        raise SystemExit(f"실물 틀이 없습니다: {src}")
    rep = build(src)
    print(f"{rep['문단']} · 그림 {rep['그림']}개 1×1 로")
    for line in rep["신원"]:
        print(f"  · {line}")
    print(rep["크기"], "→", OUT)
    bad = leftovers(OUT)
    if bad:
        print("\n❌ 아직 남아 있습니다:", " / ".join(bad))
        raise SystemExit(1)
    print("✅ 이름·문제 글이 남지 않았습니다")
