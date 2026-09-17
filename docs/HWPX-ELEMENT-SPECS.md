# HWPX 요소별 조판 근거 — 알아내는 방법과 알아낸 것

조판 엔진으로 새 요소를 다루려면 **한글이 실제로 무엇을 요구하는가**를 알아야 한다.
규격서(KS X 6101)는 *무엇이 무엇을 뜻하는가* 만 알려 주고 그 답은 주지 않는다
([`HWP-SPEC.md`](HWP-SPEC.md)) — 문법이 완벽해도 한글은 거부하거나 **조용히 빈 것으로
조판하고 이유를 말하지 않는다.**

⚠️ **그래서 추측으로 XML 을 짓지 않는다.** 아래 방법으로 근거를 만든 뒤 구현한다.

## 새 요소를 알아내는 방법 (2026-09-17 확립)

```bash
# ① 그 요소가 든 .hwpx 를 만든다 — 실물을 손에 넣는 단계
#    한글 UI 로 직접 만들어도 되고(메뉴는 살아 있다), 아래처럼 성숙한 외부
#    라이브러리로 만들어도 된다. 어느 쪽이든 **다음 줄이 판정한다.**
pip install python-hwpx        # Apache-2.0 · 의존성 lxml 하나
python3 - <<'PY'
from hwpx.document import HwpxDocument
d = HwpxDocument.new()
p = d.add_paragraph("본문")
p.add_footnote("각주 내용")          # ← 알아내려는 요소
d.save_to_path("/tmp/probe.hwpx")
PY

# ② 한글이 받아 주는지 본다 — 받지 않으면 그 XML 은 근거가 아니다
npm run test:hwpx-opens -- /tmp/probe.hwpx

# ③ 통과했으면 XML 을 읽어 근거로 삼는다. blank.hwpx 와 요소 집합을 차집합하면
#    그 요소가 새로 들인 것만 남아 금방 찾힌다.
python3 -c "
import zipfile,re
els=lambda p:set(re.findall(r'<(hp:[a-zA-Z]+)', zipfile.ZipFile(p).read('Contents/section0.xml').decode()))
print(sorted(els('/tmp/probe.hwpx') - els('experiments/hwp-export/templates/blank.hwpx')))"

# ④ 우리 엔진으로 같은 것을 낸 뒤 ②를 다시 돌리고, PDF 를 뽑아 눈으로 본다.
```

⚠️ **④의 '눈으로 본다' 를 건너뛰지 말 것.** 2026-09-17 에 조합 기호 ₆C₂ 가 **파일은
멀쩡히 열리고 검사도 전부 초록불인데 발문이 빈칸으로 인쇄되는** 결함이 이 단계에서만
드러났다. 여는 것과 제대로 그려지는 것은 다른 문제다.

## 알아낸 것

### 쪽 나눔 — 근거: 시험지 변환기(실물 PDF 로 확인)

문단 속성 하나다.

```xml
<hp:p pageBreak="1" …>
```

⚠️ **쪽나눔을 준 문단에 단나눔(`columnBreak`)까지 주지 말 것** — 한글이 둘 다 수행해
새 쪽의 왼쪽 단이 통째로 빈다. 쪽나눔은 그 자체로 새 쪽 첫 단에서 시작한다
(`mock_to_hwpx.py` 가 이미 그렇게 쓰고 있고 12쪽 시험지로 확인됐다).

### 각주 — 근거: 생성 후 한글 열기 통과(2026-09-17)

**본문 run 안**, `<hp:t>` 뒤에 `<hp:ctrl>` 로 매단다. 각주 본문은 `<hp:subList>` 안의
독립한 문단이다.

```xml
<hp:p paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
  <hp:run charPrIDRef="0">
    <hp:t>각주가 붙는 본문입니다.</hp:t>
    <hp:ctrl>
      <hp:footNote number="1" suffixChar="41" instid="662048330">
        <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP"
                    linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0"
                    hasTextRef="0" hasNumRef="0">
          <hp:p paraPrIDRef="10" styleIDRef="15" pageBreak="0" columnBreak="0" merged="0" id="0">
            <hp:run charPrIDRef="3">
              <hp:ctrl>
                <hp:autoNum num="1" numType="FOOTNOTE">
                  <hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>
                </hp:autoNum>
              </hp:ctrl>
            </hp:run>
            <!-- 각주 글자 run 이 이어진다 -->
          </hp:p>
        </hp:subList>
      </hp:footNote>
    </hp:ctrl>
  </hp:run>
</hp:p>
```

⚠️ **번호는 두 곳에 있다** — `<hp:footNote number>` 와 각주 문단 안의 `<hp:autoNum num>`.
⚠️ **서식은 이미 골격에 있다.** `secPr` 의 `<hp:footNotePr>`(구분선·간격·번호 방식)은
`blank.hwpx` 에 들어 있으므로 새로 만들 필요가 없다 — **실체만 매달면 된다.**
⚠️ `instid` 는 문서 안에서 겹치지 않아야 한다.

## 아직 근거가 없는 것

| 요소 | 무엇이 필요한가 |
|---|---|
| 머리말·꼬리말 | 시험지 쪽은 `capture_page_headers()` 로 **실물에서 떠다 쓴다**(본문 첫 문단의 `<hp:ctrl><hp:header>`). 일반 문서용으로 **새로 만드는** 근거는 없다 |
| 상자 안의 표·그림 | 계약이 재귀 구조가 되어야 한다 — 블록 안에 블록 |
| 지문(passage) | 시험지 전용 개념이라 일반 문서 계약에 넣을지부터 결정이 필요하다 |

## 새 블록 하나를 실제로 쓸 수 있게 하려면 — 여덟 곳

⚠️ 한 곳만 늘리면 **AI 가 정확히 만들어도 Worker 가 502 로 버리고 브라우저에서도 막힌다**
(`REV-2026-013` 에서 실제로 그랬다). `check-document-blocks.mjs` 가 네 곳을 대조한다.

| | 파이썬 | 자바스크립트(사본) |
|---|---|---|
| 엔진 원시 기능 | `pedagogy_hwpx.py` | `hwpx-engine.js` |
| 블록 → 문단 | `document_to_hwpx.py` | `hwpx-document.js` |
| 계약 | `document_schema.py` | `document-editor.html` 의 `validate()` |
| AI 경계 | — | `worker/index.js` 의 프롬프트 + `validateDocumentResponse` |

⚠️ **사본은 갈라진다** — `npm run test:hwpx-browser` 가 같은 문서 JSON 을 양쪽에 넣어
결과를 대조한다. 한쪽만 고치지 말 것.
