# 변경 인계 — 브라우저 엔진에 검증을 들이고, 각주 스타일을 이름으로 찾는다

- ID: `HANDOFF-2026-143`
- 날짜: `2026-09-17`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `server`, `tests`
- 관련 이슈: `REV-2026-094`

## 변경 내용

`python-hwpx`(Apache-2.0)를 **근거 자료로 읽어** 우리 엔진의 빈 곳을 찾은 결과다.
**코드는 한 줄도 가져오지 않았다** — 라이선스 의무가 생기지 않고, 무엇보다 저쪽은
파이썬 55,078줄이라 브라우저로 갈 수 없고 우리 **파이썬↔JS 대조 계약을 죽인다.**
배운 것은 *아이디어* 둘이고 구현은 우리 것이다.

1. **`hwpx-engine.js` 에 검증을 이식했다.** 파이썬 `save()` 는 `strict_validate()` 를
   부르는데 브라우저 `toBlob()` 은 **아무것도 보지 않았다.** 정작 사용자에게 나가는 것은
   브라우저 경로다. 이제 `toBlob()` 이 먼저 `strictValidate()` 를 부른다.
   옮긴 것: `validationErrors` · `itemCountErrors` · `referenceWarnings` ·
   `referenceValidationErrors` · `strictValidate` + 표 넷(`SECTION_REFS` · `HEADER_REFS` ·
   `ITEM_COUNTS` · `REQUIRED_PARTS`).
2. **각주 본문 스타일을 이름으로 찾는다**(`REV-2026-094`). 숫자를 박아 뒀다가 실제로
   틀려 있었다 — 자세한 것은 그 이슈.
3. **`appendInlineEquation`** 을 JS 에 더했다(파이썬의 같은 이름처럼 `appendEquation` 별칭).
4. **파리티 신호에 `styleIDRef` 를 더했다.** 이것을 안 봐서 2번이 숨을 수 있었다.

## 위험과 검토 요청

⚠️ **`toBlob()` 이 이제 던질 수 있다.** 여기가 제일 위험하다 — 예전에는 무엇을 넣어도
파일이 나왔고 이제는 검증에 걸리면 내보내기가 **실패**한다. 정상 문서를 거부하면
시험지·AI 문서 내보내기가 통째로 막힌다. 그래서 다음을 확인했다:

- `blank.hwpx` · `exam-math.hwpx` **둘 다 오류 0건 · 경고 0건**.
- 파리티 두 문서와 시험지 한 부가 모두 통과.
- 검증기가 파이썬과 **같은 판정·같은 문구**를 내는지 대조(아래).

⚠️ **참조표가 통째로 없는 경우는 오류가 아니라 경고다.** 파이썬 쪽의 판단을 그대로
옮겼다 — 그런 문서를 한글이 멀쩡히 여는 것이 확인돼 있다. 오류로 올리면 정상 문서를
거부하게 된다. 되돌리지 말 것.

## 검증

- 실행한 명령:
  - `npm run test:hwpx-browser` · `npm run test:hwpx-exam` · `npm run test:hwpx`
  - `npm run check:static` · `npm run test:review-contracts`
  - `npm run test:hwpx-opens -- <각주·쪽나눔 문서>` + 한글로 PDF 추출 후 **눈으로 확인**
- 결과: 전부 통과. PDF 에서 각주 표시·구분선·쪽을 넘는 번호 이어짐·쪽나눔 뒤 빈 줄 없음,
  그리고 `½`·`₆C₂` 가 제 모양으로 찍히는 것까지 확인했다.
  ⚠️ PDF **텍스트 추출**로는 수식이 빈칸·`C` 로 보인다 — 수식 글꼴에 ToUnicode 가 없어서다.
  결함이 아니다. **그림으로 봐야 한다.**
- 아직 실행하지 못한 검증: 없음(`check:fast` 전체는 길어 관련 묶음만 돌렸다).

## 다음 검토자에게

diff 범위: `hwpx-engine.js` · `experiments/hwp-export/pedagogy_hwpx.py` ·
`scripts/check-hwpx-browser.mjs` · `docs/HWPX-ELEMENT-SPECS.md` · `CLAUDE.md`.

⚠️ **특히 봐 주었으면 하는 것** — `strictValidate()` 가 거부하면 안 되는 정상 문서가
더 있는지. 지금 확인한 골격은 둘뿐이다(`blank` · `exam-math`). 사용자가 `open()` 으로
자기 `.hwpx` 를 열어 쓰는 경로가 생기면 그 문서들이 이 관문을 지나야 한다.

재현 전제: `pip install -r experiments/hwp-export/requirements.txt` · `npx playwright install chromium`.
한글 PDF 단계는 맥 + 한글 + 손쉬운 사용 권한이 필요하다.

## 검토 기록
