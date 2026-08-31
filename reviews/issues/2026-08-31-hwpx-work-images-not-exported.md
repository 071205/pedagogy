# HWPX 내보내기가 편집기 work/ 그림 폴더를 탐색하지 않음

- ID: `REV-2026-008`
- 날짜: `2026-08-31`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock`, `server`, `tests`
- 관련 인계: `HANDOFF-2026-012`

## 요약과 영향

모의고사 편집기는 그림 블록의 파일을 `serve.py` 옆 `work/`에 두도록 안내하고 Typst 실시간
미리보기도 그 위치를 쓴다. 그러나 `/hwpx`는 `mock_to_hwpx.build(req, out)`만 호출해
이미지 루트 기본값(임시 출력 폴더, 저장소 루트)만 사용한다. 따라서 편집기에서 정상적으로
미리보이는 그림도 한글 내보내기에서는 누락 경고와 자리표시가 된다.

## 재현 절차

1. `work/hwpx-review-figure.png`에 유효한 PNG를 둔다.
2. 모의고사 그림 블록의 `src`를 `hwpx-review-figure.png`로 둔다.
3. `/hwpx`로 내보내거나 `mock_to_hwpx.build()`를 기본 이미지 루트로 호출한다.
4. 결과 경고와 그림 수를 확인한다.

## 기대 결과 / 실제 결과

- 기대: 편집기가 안내한 `work/`의 그림이 HWPX에 포함된다.
- 실제: 기본 `/hwpx` 루트에서는 파일을 찾지 못하고, `work/`를 명시적으로 탐색할 때만 찾는다.

## 근거

`serve.py`의 `_hwpx()`는 `build(req, out)`에 `images=[WORK]`를 전달하지 않는다.
`mock_to_hwpx.build()`는 명시값이 없으면 `[out.parent, ROOT]`만 `IMAGE_ROOTS`로 사용한다.
2026-08-31에 `work/hwpx-review-figure.png`를 만들고 확인한 결과는
`default_endpoint_roots_find=False`, `editor_work_root_find=True`였다.

## 제안 (선택)

`_hwpx()`가 서버의 `WORK`만 명시적인 이미지 루트로 전달한다. `REV-2026-007`의 경로
탈출 차단과 함께 적용해, 임시 출력 폴더·저장소 전체 탐색은 없앤다. 실제 `/hwpx` 응답에
그림이 포함되는 자동 회귀를 추가한다.

## 처리 기록

- `2026-08-31` — `Codex`: 등록. 편집기 표준 `work/` 파일은 기본 HWPX 탐색 루트에서
  찾지 못하고, `work/`를 직접 전달했을 때만 찾는 것을 재현했다.
- `2026-08-31` — `Codex`: 해결. `serve.py`의 `_hwpx()`가 변환기에 `images=[WORK]`를
  명시 전달하도록 바꿨다. 실제 로컬 `POST /hwpx`에 `work/hwpx-endpoint-figure.png`를
  요청해 200, `X-Hwpx-Warnings: 0`, 결과 HWPX의
  `BinData/hwpx-endpoint-figure.png` 포함을 확인했다. `check-static.mjs`에도 이 서버
  연결을 확인하는 정적 회귀를 추가했다.
