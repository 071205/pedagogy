# 빈 문서 골격에 참조 표가 없어 한글이 파일을 열지 못한다

- ID: `REV-2026-012`
- 날짜: `2026-08-31`
- 보고자: `Claude` (사용자 제보로 재현)
- 상태: `resolved`
- 심각도: `P0`
- 영향 영역: `server`
- 관련 인계: `HANDOFF-2026-018`, `HANDOFF-2026-019`

## 요약과 영향

`/document-hwpx`(범용 AI 문서)로 만든 `.hwpx`를 한글에서 열면
**"파일을 읽거나 저장하는데 문제가 있습니다"**가 뜨고 열리지 않는다.
이 경로로 만든 **모든 문서**가 해당된다 — 즉 범용 문서 기능 전체가 동작하지 않았다.

`experiments/hwp-export/out/*.hwpx` 중 **틀 파일을 열어 쓰는 모의고사 경로는 영향이 없다**
(그쪽은 실물 한글 파일을 통째로 물려받으므로 참조 표가 이미 다 있다). 밑바닥에서 만드는
`HwpxDocument.blank()` 경로만 깨져 있었다.

## 재현 절차

1. `python3 experiments/hwp-export/document_to_hwpx.py 문서.json 결과.hwpx`
   (또는 `document-editor.html` → `한글로 내보내기`)
2. 만들어진 `.hwpx`를 한컴 한글에서 연다.
3. "파일을 읽거나 저장하는데 문제가 있습니다" 오류.

## 기대 결과 / 실제 결과

- 기대: 한글이 문서를 열고 제목·본문·수식·표가 보인다.
- 실제: 열리지 않는다. XML 자체는 잘 정형화돼 있어 `lxml` 파싱·`strict_validate()`는
  **전부 통과했다** — 그래서 검사가 다 초록불인데 파일은 안 열리는 상태였다.

## 근거

`pedagogy_hwpx.HwpxDocument._blank_parts()`가 `refList` 안에 `charProperties`,
`paraProperties`, `styles` 세 개만 만들었다. 실물 한글 파일(`평가원 수학 양식.hwpx`)의
`refList`는 순서까지 포함해 다음과 같다:

```
fontfaces · borderFills · charProperties · tabProperties · numberings · paraProperties · styles
```

빠진 표 때문에 아래 참조가 전부 허공을 가리키고 있었다(생성 파일 감사 결과, 총 31건):

| 참조 | 가리키는 표 | 상태 |
| --- | --- | --- |
| `charPr` 의 `<hh:fontRef hangul="0" .../>` | `fontfaces` | 표 자체가 없음 |
| `paraPr` 의 `tabPrIDRef="0"` | `tabProperties` | 표 자체가 없음 |
| `<hp:tbl>`·`<hp:tc>` 의 `borderFillIDRef="0"` | `borderFills` | 표 자체가 없음 |

추가로 `charPr id="0"`에는 `fontRef` 자식이 아예 없었고, `paraPr id="0"`은 속성·자식이
하나도 없는 빈 요소였다. `<hh:head>`의 첫 자식 `beginNum`도 없었다.

⚠️ 표(`borderFills`) 참조는 `HANDOFF-2026-019`(표 블록 추가)가 새로 만든 것이지만,
**`fontfaces`·`tabProperties`는 그 전부터 깨져 있었다.** 즉 표 없는 문서도 열리지 않았다.
`HANDOFF-2026-018`이 "한컴 한글에서 생성 파일을 열어 확인해야 한다"고 남긴 검증이
실행되지 않은 채 넘어간 것이 원인이다.

## 처리 기록

- `2026-08-31` — `Claude`: 원인 파악 및 수정.
  - **원인**: 위 근거 참고. XML 파서로는 잡히지 않는 종류의 결함이라
    (문법은 완벽하고 의미 참조만 끊김) 기존 검사가 전부 통과했다.
  - **수정 파일**:
    - `pedagogy_hwpx.py` — `_blank_parts()`에 `beginNum`, `fontfaces`(7개 언어,
      글꼴 파일은 심지 않고 이름만), `borderFills`(1=테두리 없음·2=실선),
      `tabProperties`, `numberings`, 온전한 `charPr id=0`(`fontRef` 포함)과
      `paraPr id=0`, `style id=0` 추가. 실물 파일의 `refList` 순서를 따랐다.
    - `pedagogy_hwpx.py` — `append_table()`의 `borderFillIDRef` 기본값을 `"0"`에서
      실제 존재하는 id로. **실물 파일의 `borderFill` id는 1부터 시작하고 0은 없다.**
      틀 파일을 열어 쓸 때를 위해 인자로 바꿀 수 있게 했다.
    - `pedagogy_hwpx.py` — `reference_validation_errors()`가 이제 **본문·머리글의 id
      참조가 실제로 존재하는지** 센다(`charPrIDRef`, `paraPrIDRef`, `styleIDRef`,
      `borderFillIDRef`, `tabPrIDRef`, 그리고 언어별 `fontRef`). `save()`가 이미
      `strict_validate()`를 부르므로, 참조가 끊긴 문서는 **저장 자체가 막힌다.**
    - `test_document_export.py` — 위 검증에 대한 회귀 검사 추가.
  - **검증**:
    - 참조 표 6개(`fontfaces`·`borderFills`·`charProperties`·`tabProperties`·
      `paraProperties`·`styles`)를 **하나씩 지워 보고 6건 모두 검증기가 잡는 것을 확인.**
      처음에는 `fontfaces`만 못 잡았다(언어별 속성이라 일반 규칙에 안 맞음) — 전용
      검사를 따로 붙여 잡히게 했다.
    - 없는 id(`borderFillIDRef="99"`)를 가리키는 경우도 잡는지 확인 — 표가 있기만 하면
      통과하는 검사가 되지 않도록.
    - `save()`가 끊어진 문서를 실제로 거절하는지 확인(검증기가 있어도 저장 경로가
      안 부르면 소용없다).
    - `npm run test:hwpx` 9건 통과 — **틀 기반 모의고사 경로도 그대로 통과**(그쪽은
      실물 파일의 참조 표를 물려받으므로 영향 없음을 확인).
    - `npm run check:fast` 전체 통과.
- `2026-08-31` — `Claude`: **위 수정으로는 부족했다. 사용자가 다시 열었더니 여전히
  같은 오류였다.** 컴퓨터 제어로 한컴 한글을 직접 띄워 재현·해결했다.

  - **왜 부족했나**: 끊어진 참조를 메운 것은 맞지만, 한글이 요구하는 것은 그것만이
    아니었다. 실제로 더 빠져 있던 것 —
    `META-INF/manifest.xml`, `META-INF/container.rdf`, `Preview/`,
    `<hh:head>`의 `compatibleDocument`·`docOption`·`trackchageConfig`,
    `container.xml`의 추가 `rootfile` 항목, `content.hpf`의 메타데이터.
    **하나씩 맞히는 방식으로는 끝이 나지 않는 문제였다.**

  - **실제 해결**: 한글에서 새 빈 문서를 만들어 `.hwpx`로 저장하고, **그 파일을 골격으로
    쓴다**(`templates/blank.hwpx`, 개인정보 제거 후 저장소에 포함).
    `HwpxDocument.blank()`가 이제 그 파일을 연다. 손으로 짓던 `_blank_parts()` 122줄은
    삭제했다. `template.py`가 시험지 틀에 대해 이미 내렸던 결론과 같다 —
    *"실물 파일을 틀로 쓰면 우리가 분석하지 않은 것까지 전부 따라온다."*

  - **추가로 발견**: 한글 빈 문서의 `borderFills`는 **전부 테두리 '없음'** 이라, 그대로
    쓰면 **선이 보이지 않는 표**가 나온다. `add_border_fill()`로 실선 정의를 런타임에
    만들어 쓴다. 이건 열리기는 해도 눈으로 보기 전엔 모르는 결함이라, 검사에서 실제
    `leftBorder type` 값을 확인한다.

  - **검증(이번엔 실물로)**:
    - 한컴 한글을 직접 실행해 고치기 전 파일로 **오류를 재현**했다.
    - 한글이 저장한 빈 문서를 골격으로 쓴 파일이 **열리는 것을 확인**했다.
    - 최종 문서(제목·소제목·인라인 수식·별행 수식·표·글머리표·번호목록·인용문)를
      **한글에서 열어 전부 정상 렌더되는 것을 눈으로 확인**했다. 표 테두리도 보인다.
    - 골격 파일을 치우면 검사가 실패하고, 테두리를 `NONE`으로 바꾸면 검사가 실패하는
      것을 확인한 뒤 원복했다.
    - `npm run check:fast` 전체 통과(HWPX 9건 포함).

  - **남은 것**: 없음. 실물 확인까지 마쳤다.
