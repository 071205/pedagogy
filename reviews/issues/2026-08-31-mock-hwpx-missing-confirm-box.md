# HWPX 시험지에 '※ 확인 사항' 상자가 없다

- ID: `REV-2026-010`
- 날짜: `2026-08-31`
- 보고자: `Claude`
- 상태: `open`
- 심각도: `P3`
- 영향 영역: `server`
- 관련 인계: `HANDOFF-2026-015`

## 요약과 영향

편집기는 각 과목의 **마지막 쪽 오른쪽 단 아래**에 `※ 확인 사항` 상자를 넣는다
(`noteFor(meta, i, elec)`). 공통 과목 끝에는 '이어서 「선택과목(…)」 문제가 제시되오니'
안내가 한 줄 더 붙는다. 실물 시험지의 고정 요소다.

HWPX 변환기는 이 상자를 만들지 않는다. 내보낸 시험지는 실물·화면과 이 부분이 다르다.
문항 내용에는 영향이 없어 심각도는 낮지만, '한글로 열어 그대로 PDF 로 뽑는다' 는 이
기능의 목적에는 어긋난다.

## 재현 절차

1. `experiments/hwp-export/samples/full-exam.json`
2. `python3 mock_to_hwpx.py samples/full-exam.json out/full-exam.hwpx samples/images`
3. `Contents/section*.xml` 에서 `확인 사항` 을 센다.

```
'확인 사항' 등장 0회
'답안지' 등장 0회
```

## 기대 결과 / 실제 결과

- 기대: 공통 구역 끝과 선택 구역 끝에 각각 `※ 확인 사항` 상자가 있다.
- 실제: 어느 구역에도 없다.

## 근거

- 편집기: [`mock-exam-editor.html`](../../mock-exam-editor.html) 의 `noteFor()` 와
  `renderPreview()` 의 `<div class="notebox">`.
- 변환기: [`mock_to_hwpx.py`](../../experiments/hwp-export/mock_to_hwpx.py) 의 `build()` 에
  대응 코드가 없다.

## 제안 (선택)

'마지막 쪽 오른쪽 단 아래' 라는 위치는 HWPX 문단 흐름만으로는 정할 수 없다 — 쪽이 몇 장
나올지는 한글이 조판하며 정하기 때문이다. 틀에 이 상자가 도형으로 들어 있는지 먼저
확인하는 편이 낫다(`clear_body()` 가 첫 문단의 틀 도형은 남기므로, 상자가 거기 있다면
글자만 바꾸면 된다). 없다면 '구역 마지막 문단에 흐름대로 붙인다' 로 타협할 수 있는지
실물과 대조해 판단할 것.

## 처리 기록

- `2026-08-31` — `Claude`: 등록. 검증: 위 재현 절차로 30문항 표본에서 확인.
