# HWPX 그림 경로가 작업 폴더 밖 파일을 읽음

- ID: `REV-2026-007`
- 날짜: `2026-08-31`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock`, `server`, `tests`
- 관련 인계: `HANDOFF-2026-012`

## 요약과 영향

모의고사 JSON의 `image.data.src`는 HWPX 내보내기 때 로컬 파일명으로 쓰인다.
`find_image()`가 `root / src`를 그대로 검사해 `../` 및 절대 경로를 막지 않으므로,
내보내기 요청이 PEDAGOGY 작업 폴더 밖의 읽을 수 있는 PNG/JPEG를 HWPX `BinData`에 포함할 수
있다. 악의적인 가져오기 JSON을 연 사용자가 내보내기를 누르면 의도하지 않은 로컬 그림 파일을
다운로드된 시험지에 넣게 된다.

## 재현 절차

1. `/private/tmp/hwpx-outside.png`에 유효한 PNG를 둔다.
2. 그림 블록의 `src`를 `../../../private/tmp/hwpx-outside.png`로 둔 모의고사 JSON을 만든다.
3. `mock_to_hwpx.build()`를 기본 이미지 루트로 호출하거나 편집기에서 `/hwpx`로 내보낸다.
4. 결과 `Report.figures`와 HWPX의 `BinData`를 확인한다.

## 기대 결과 / 실제 결과

- 기대: 그림 파일은 지정된 안전한 이미지 폴더 안의 파일명만 허용하며, 폴더 밖 경로는 경고와
  자리표시로 처리한다.
- 실제: `find_image()`가 작업 루트 밖의 파일을 찾아 `Report.figures == 1`, 경고 없음으로
  HWPX에 포함한다.

## 근거

`experiments/hwp-export/mock_to_hwpx.py`의 `find_image()`는 `root / src`에 대해 존재 여부만
확인한다. 2026-08-31에 2×1 PNG를 `/private/tmp`에 두고 위 경로로 생성한 결과,
`candidate_found=True`, `escapes_root=True`, `embedded_figures=1`, `warnings=[]`를 확인했다.

## 제안 (선택)

각 이미지 후보를 `resolve()`한 뒤 허용 루트의 `relative_to()`가 되는지 확인한다. 편집기에서
안내한 `work/` 폴더를 `/hwpx`의 이미지 루트로 명시 전달하고, 임시 출력 폴더·저장소 전체를
기본 탐색 루트로 쓰지 않는다. 이 재현을 자동 검사에 추가한다.

## 처리 기록

- `2026-08-31` — `Codex`: 등록. 기본 루트에서 `../../../private/tmp/hwpx-outside.png`가
  실제 HWPX 그림으로 포함되는 것을 재현했다.
- `2026-08-31` — `Codex`: 해결. `mock_to_hwpx.find_image()`가 후보와 허용 루트를
  `resolve()`한 뒤 `relative_to()`로 같은 폴더 안인지 확인하고, 실제 파일만 받게 했다.
  기본 API/CLI 이미지 루트도 저장소 전체가 아니라 출력·JSON 파일 옆으로 좁혔다.
  `test_image_paths.py`에서 `../outside.png`와 절대 경로가 모두 차단되고 정상 그림만
  포함되는 것을 확인했다. 검사 조건을 반대로 바꾸면 assertion이 실패하는 것도 확인했다.
