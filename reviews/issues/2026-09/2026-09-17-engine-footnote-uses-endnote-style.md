# 각주 본문이 각주가 아니라 **미주 스타일**로 조판된다

- ID: `REV-2026-094`
- 날짜: `2026-09-17`
- 보고자: `Claude`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `server`
- 관련 인계: `HANDOFF-2026-143`

## 요약과 영향

`append_footnote()` / `appendFootnote()` 가 각주 본문 문단에 `styleIDRef="15"` 를 박아 두고
있었다. 그런데 우리 `blank.hwpx` 에서 **15 는 미주(Endnote)이고 각주는 14** 다.

지금 당장 눈에 보이는 피해는 없다 — 그 골격에서 각주와 미주가 **같은 `paraPr=10`·
`charPr=3`** 을 가리켜 조판 결과가 같기 때문이다. **그래서 PDF 눈검사도 통과했다.**
위험한 것은 앞으로다:

- 골격(`blank.hwpx`)을 한글에서 다시 저장해 갈아 끼우면 번호가 바뀌어 **조용히 틀린다.**
- `HwpxDocument.open()` 으로 연 다른 문서에 각주를 달면 곧바로 틀린다. 시험지 틀
  (`exam-math.hwpx`)에서 15 는 `머리쪽번호`(paraPr=5·charPr=3)다.
- 그 문서에 15번 스타일이 아예 없으면 **끊어진 참조**가 되어 한글이 문서를 통째로
  열지 못한다 — 그때 한글은 "파일을 읽거나 저장하는데 오류가 있습니다" 한 줄만 말한다.

## 재현 절차

1. `python3 -c "…document_to_hwpx.build({... 'type':'footnote' ...}, '/tmp/fn.hwpx')"`
2. `Contents/section0.xml` 의 `<hp:subList>` 안 첫 `<hp:p>` 를 읽는다.
3. `styleIDRef` 를 `blank.hwpx` 의 `Contents/header.xml` 스타일 표와 맞춰 본다.

```bash
python3 -c "
import zipfile,re
h=zipfile.ZipFile('experiments/hwp-export/templates/blank.hwpx').read('Contents/header.xml').decode()
for m in re.finditer(r'<hh:style\b([^>]*?)/?>',h):
    a=m.group(1)
    if re.search(r'name=\"(각주|미주)\"',a): print(a)"
```

## 기대 결과 / 실제 결과

- 기대: 각주 본문 문단이 `styleIDRef="14"`(각주)를 가리킨다.
- 실제: `styleIDRef="15"`(미주)를 가리켰다.

## 근거

- `experiments/hwp-export/pedagogy_hwpx.py` `append_footnote()` 의 기본값
  `note_style_id: str = "15"` · `hwpx-engine.js` `appendFootnote()` 의 `noteStyleId = "15"`.
- 실측 — `blank.hwpx`: 각주 `id=14`(paraPr=10, charPr=3) · 미주 `id=15`(paraPr=10, charPr=3).
  `exam-math.hwpx`: `id=15` 는 `머리쪽번호`(paraPr=5, charPr=3)이고 각주 스타일이 **없다**.
- 원인(확인됨, 가설 아님): 이 값은 `python-hwpx` 의 **폴백 상수**
  (`_NOTE_STYLE_FALLBACK = {"footNote": ("15", "10", "3")}`)를 그대로 옮겨 적은 것이다.
  그쪽 골격은 각주=15·미주=16 이라 **한 칸씩 어긋난다.** 저쪽은 숫자를 쓰기 전에
  **이름으로 먼저 찾기 때문에** 그 라이브러리에서는 문제가 되지 않는다.
- ⚠️ **파리티 검사가 이것을 못 잡았다.** `check-hwpx-browser.mjs` 의 `signals()` 가
  `paraPrIDRef` 만 뽑고 **`styleIDRef` 를 아예 안 봤다.**

## 처리 기록

- `2026-09-17` — `Claude`: 등록과 동시에 수정.
  - **원인**: 스타일 참조를 숫자로 박았다(위 근거).
  - **수정**: `_note_style_refs()` / `_noteStyleRefs()` 를 만들어 머리글 스타일 표에서
    **이름(`각주`/`Footnote`)으로 찾는다.** 못 찾으면 **첫 스타일로 떨어진다** —
    없는 id 를 가리키면 한글이 문서를 통째로 못 열기 때문이다. 모양이 조금 다른 것보다
    못 여는 것이 훨씬 나쁘다. 호출자가 명시로 넘기면 그 값이 이긴다.
  - **파일**: `experiments/hwp-export/pedagogy_hwpx.py` · `hwpx-engine.js` ·
    `scripts/check-hwpx-browser.mjs`(`styleRefs` 신호 추가).
  - **검증**:
    - `npm run test:hwpx-browser` — `styleRefs` 를 새로 대조하고 양쪽 모두 `14` 로 통과.
    - 실측 — `blank.hwpx` → `('14','10','3')`, `exam-math.hwpx` → `('0','5','13')`(끊어진
      참조 없음).
    - `npm run test:hwpx-opens` — 한글이 연다.
    - 한글로 PDF 를 뽑아 **눈으로 확인** — 각주 표시 `1) 2) 3)`, 구분선, 쪽을 넘는 번호
      이어짐, 쪽나눔 뒤 빈 줄 없음까지 전부 맞다.
    - `npm run test:hwpx`(12건) · `npm run test:hwpx-exam` · `npm run check:static` ·
      `npm run test:review-contracts` 통과.
