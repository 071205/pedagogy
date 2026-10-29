---
name: hwpx-element
description: HWPX 요소·수식·표·구역의 호환성 분석과 조판 엔진 개선. 정상/변형 표본, 실제 한글 열기·본문·PDF·왕복 저장, 필요 시 REA 함수 분석으로 근거를 만들고 Python/JS 구현·진단·회귀에 적용한다. 한글 출력 누락·깨짐, 새 HWPX 요소, 조판 스킬 개선, 중단된 한글 분석 재개에 사용한다.
---

# 새 HWPX 요소 들이기

⚠️ **추측으로 XML 을 짓지 않는다.** 규격서(KS X 6101)는 *무엇이 무엇을 뜻하는가* 만 알려 주고
**한글이 받아 주는가**는 답하지 않는다. 문법이 완벽해도 한글은 거부하거나 — 더 나쁘게 —
**조용히 빈 것으로 조판하고 이유를 말하지 않는다.**

근거와 이미 알아낸 요소는 [`docs/HWPX-ELEMENT-SPECS.md`](../../../docs/HWPX-ELEMENT-SPECS.md) 에 있다.
**그 문서를 먼저 읽는다.** 아래는 새 요소를 알아내는 절차다.

## 재개와 질문 선택

진행 위치는 [`docs/DEV-TOKEN-ROADMAP.md`](../../../docs/DEV-TOKEN-ROADMAP.md)의 H1 행,
완료한 실험은 [`docs/HWP-RESEARCH-RESULTS.md`](../../../docs/HWP-RESEARCH-RESULTS.md)에서 확인한다.
설치·인증·같은 함수 분석·통과한 검사를 처음부터 반복하지 않는다. 앱 빌드나 대상 해시가
달라졌으면 새 주소를 찾고 이전 관찰의 적용 범위를 구분한다.

현재 질문을 한 문장으로 고정한다. 예: “구역의 본문 순서는 ID·manifest 순서·spine 순서 중
무엇으로 결정되는가?” 이미 공개 규격/정상 XML/실물 시험으로 답할 수 있는 부분부터 확인하고,
남은 질문에 필요한 REA 함수만 추적한다. 패키지 질문 다음에는 긴 수식의 크기·기준선·행 간격을 조사한다.
전체 한글 기능을 한꺼번에 복제하는 작업으로 넓히지 않는다.

규칙 후보에 근거 종류를 붙인다: **공개 규격 / 버전별 실물 관찰 / REA 정적 가설 / 우리 생성기 정책**.
가설을 제품의 강제 오류 조건으로 바로 바꾸지 않는다. 세부 운영은
[연구·적용 절차](references/research-workflow.md)를 필요한 단계에서 읽는다.

## ① 그 요소가 든 `.hwpx` 를 손에 넣는다

한글 UI 로 직접 만들거나, 근거 생성기를 쓴다. **우리 골격에서 출발하면 참조 번호가 그대로
쓸 수 있는 근거가 된다.**

```bash
python3 -m venv /tmp/probe-venv && /tmp/probe-venv/bin/pip install -q python-hwpx
/tmp/probe-venv/bin/python - <<'PY'
from hwpx.document import HwpxDocument
d = HwpxDocument.open("experiments/hwp-export/templates/blank.hwpx")
d.add_paragraph("본문")
# ← 알아내려는 요소를 여기서 넣는다
d.save_to_path("/tmp/probe.hwpx")
PY
```

⚠️ **외부 라이브러리는 근거 생성기다 — 코드를 가져오는 곳이 아니다.** 파이썬 55,000줄은
브라우저로 갈 수 없고, 옮겨 오면 파이썬↔JS 대조가 영구히 죽는다.
⚠️ **생성기가 두 자리에 모두 쓰는 경우가 있다.** 머리말이 그랬다 — `secPr` 안 사본과 본문
`ctrl` 양쪽. 어느 쪽이 일하는지는 ③이 아니라 **④가 가른다**.

## ② 한글이 받아 주는지 본다 — 받지 않으면 근거가 아니다

```bash
npm run test:hwpx-opens -- /tmp/probe.hwpx
```

⚠️ **한글이 자고 있으면 첫 판정이 거짓 실패로 나온다.** 한 건만 ❌ 이고 뒤 파일은 ✅ 라면
파일이 아니라 콜드 스타트를 의심하고 다시 돌린다.
⚠️ **창 개수로 판정하지 않는다** — 오류 대화상자도 창이다. 검사가 대화상자 글을 읽는다.
현재 검사 exit 0은 전부 열림, 1은 거부/unknown 포함, 2는 skip 포함이다. 거부를 예상한 표본
묶음의 exit 1은 검사 고장이라는 뜻이 아니다. JSON의 각 상태와 앞뒤 정상 대조군을 함께 읽는다.
`pass`는 문서 창 관찰이며 본문·조판 통과가 아니다. 기존 같은 이름 창은 skip하고,
권한/모호한 창/예상 밖 대화상자/시간 초과는 원인을 보존해 중단한다. 사용자 작업이 없는 시험 세션을 사용한다.

## ③ XML 을 근거로 삼는다 — 차집합이면 금방 찾힌다

```bash
python3 -c "
import zipfile,re
els=lambda p:set(re.findall(r'<(h[pc]:[a-zA-Z]+)', zipfile.ZipFile(p).read('Contents/section0.xml').decode()))
print(sorted(els('/tmp/probe.hwpx') - els('experiments/hwp-export/templates/blank.hwpx')))"
```

**어디에 매달렸는지**까지 본다 — 요소 이름만으로는 부족하다. `lxml` 로 부모 경로를 찍어
실물(`templates/exam-math.hwpx`, 한글이 제 손으로 저장한 파일)과 **같은 자리**인지 견준다.
변형은 ZIP 전체 목록과 다른 파트의 동일성을 검사한다. 경로를 바꾸면 manifest뿐 아니라
`META-INF/container.rdf`의 참조도 조사한다. 미갱신 참조를 남긴 표본과 모든 참조를 갱신한 표본은 별개다.

⚠️ **크기·좌표를 고정값으로 베끼지 말 것.** 표본의 숫자는 대개 **계산된 값**이다 —
머리말 상자의 `42520`·`4252` 는 '쪽 폭 − 좌우 여백' 과 '머리말 여백' 이었다. 골격에서 재어 쓴다.

## ④ 우리 엔진으로 같은 것을 낸 뒤 **PDF 를 뽑아 눈으로 본다**

```bash
npm run test:hwpx-opens -- 결과.hwpx        # 열리는가
node scripts/hwp-to-pdf.mjs 결과.hwpx        # 찍히는가 ← 이 단계를 건너뛰지 말 것
```

⚠️ **여는 것과 찍히는 것은 다른 문제다.** 이 단계에서만 드러난 결함이 둘 있다 —
조합 기호 `₆C₂` 가 **열리는데 발문이 빈칸**으로 인쇄되던 것, 머리말을 `secPr` 에 넣으면
**열리는데 아무것도 안 찍히던** 것. 둘 다 검사는 전부 초록불이었다.
⚠️ PDF **텍스트 추출**로는 수식이 빈칸으로 보인다(수식 글꼴에 ToUnicode 가 없다). **그림으로 본다.**
여러 쪽에 걸리는 요소면 **모든 쪽**을 본다(머리말은 되풀이되는 것이 핵심이었다).
입력에 있는 글·수식·그림의 순서와 위치를 출력에서 독립 대조한다. 두 구현끼리 같은 결과라는
이유만으로 내용 보존을 승인하지 않는다. 한글에서 다른 이름으로 저장한 뒤 닫고 재열기하고,
같은 내용 대조와 PDF 판정을 한다. 열기/내용/PDF/왕복 저장 상태를 각각 기록한다.

## ⑤ REA 로 한글이 HWPX 를 어떻게 읽는지 본다 (2026-10-15)

한글이 파일을 왜 받아 주거나 거부하는지, 어떤 값을 요구하는지 REA 로 분석해 규칙을 얻는다.

- 도구: REA(`rea` CLI 6.4.0 · 스킬 `reverse-engineer-anything`) + Ghidra 12.1.4. Codex 에도 같은 MCP 가 등록돼 있다.
  환경: `GHIDRA_INSTALL_DIR=/opt/homebrew/opt/ghidra/libexec` · `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
- **어디를 보나**: `Contents/Frameworks/Hnc/Bin/HwpApp.dylib`의 HWPX 읽기 경로에서 시작한다.
  문자열 빈도만으로 담당 기능을 확정하지 않는다. 분석 사본·빌드별 주소·Evidence는
  [`docs/HWP-RESEARCH-DESIGN.md`](../../../docs/HWP-RESEARCH-DESIGN.md)와 결과 문서에서 회수한다.
- 원본·사본 해시와 아키텍처를 확인한다. universal 파일이 공급자에서 거부되면 원본을 보존한
  ARM64 분석 사본을 만든다. 이전 빌드 주소를 현재 바이너리에 그대로 적용하지 않는다.
- 문자열 → xref → 함수 → 호출/판정 연결로 질문을 좁힌다. 반환형·간접 호출·정적 변수 해석의
  공백은 기록한다. 함수 분석 뒤 정상/반례 표본을 만들고 **④로 다시 판정**한다.
- 분석 산출물은 로컬 임시 경로에 보존하고, 저장소에는 규칙·해시·주소·Evidence ID·실물 결과를 남긴다.
  분석 코드나 의사코드를 우리 엔진에 복사하지 않는다.
- 도구 종료 전에 Evidence를 회수한다. close 오류는 세션 상태와 해당 프로세스를 확인해
  실제 종료 여부와 잔류 자원을 기록한다. “닫힘 확인 실패”를 “분석 실패”로 바꾸지 않는다.

## 에이전트 협업과 중단 처리

주 에이전트가 질문·표본·Evidence·채택 상태를 관리하고 구현은 한 명이 맡는다.
독립 에이전트는 명시한 코드/표본/판정만 검토하며 의견을 실제 코드와 검사로 확인한다.
Claude↔Codex 호출은 저장소 AGENTS 규약과 읽기 전용 래퍼를 따른다.
보고 요청은 **관찰·근거·결론·다음 행동**으로 쓴다. 내부 사고 원문이나 thinking 블록 출력을 요구하지 않는다.

중단은 권한/아키텍처/공급자/전송량/시간 초과/응답 거절로 기록한다.
전송량 문제에는 보존 Evidence의 요약·페이지 조회, 모델 응답 거절에는 오류 범주·요청 ID와
공식 피드백 경로를 사용한다. 도구 설정이나 단어 교체를 응답 거절의 해제 방법으로 단정하지 않는다.
다른 에이전트가 우리 코드·자체 표본을 검토했다면 그 범위만 승인 기록으로 남긴다.
한 경로가 중단돼도 진행 가능한 XML 비교·실물 시험·우리 코드 검증을 이어가며 재개 기록을 남긴다.

## 구현 — 고쳐야 하는 자리

⚠️ **한 곳만 고치면 사용자에게 도달하지 못한다.** 블록 하나는 **다섯 경계**다.

| | 파이썬 | 자바스크립트(사본) |
|---|---|---|
| 엔진 원시 기능 | `pedagogy_hwpx.py` | `hwpx-engine.js` |
| 블록 → 문단 | `document_to_hwpx.py` | `hwpx-document.js` |
| 계약 | `document_schema.py` | `document-editor.html` 의 `validate()` |
| **미리보기** | — | `document-editor.html` 의 **`render()`** |
| AI 경계 | — | `worker/index.js` 프롬프트 + `validateDocumentResponse` |

⚠️ `validate()` 와 `render()` 를 한 칸으로 세지 말 것 — 통과하는 것과 그려지는 것은 다른
경계다(`REV-2026-095` 에서 미리보기가 아무것도 표시하지 못했다).
⚠️ **블록이 아닌 것도 있다.** 머리말·꼬리말은 구역 전체에 걸리므로 `blocks` 가 아니라
최상위 값이다. 흐름에 끼는 것인지 문서에 걸리는 것인지 먼저 가른다.

## 마무리 — 이것까지가 한 벌이다

```bash
npm run test:hwpx-browser       # 파이썬↔JS 대조 (표본에 새 것을 더한다)
HWPX_PYTHON=<lxml 있는 파이썬> npm run test:hwpx
npm run check:static            # 다섯 경계 대조
```

- **파리티 표본에 새 요소를 더한다.** 안 더하면 사본이 갈라져도 초록불이다.
- **신호를 함께 본다** — 개수만 세지 말고 자리·크기·`charPrIDRef` 까지. 각주가 미주
  스타일로 나가던 것(`REV-2026-094`)과 머리말이 제목 크기로 나가던 것(`REV-2026-096`)을
  둘 다 놓쳤던 이유가 신호 부족이었다.
- **깨보기**: 새로 넣은 신호를 일부러 틀리게 만들어 빨간불이 나는지 본다.
- 근거를 [`docs/HWPX-ELEMENT-SPECS.md`](../../../docs/HWPX-ELEMENT-SPECS.md) 로 옮기고,
  인계와 이슈는 [`reviews/README.md`](../../../reviews/README.md) 양식을 따른다.
