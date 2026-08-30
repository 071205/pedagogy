# 변경 인계 — HWPX 베타 그림 실제 포함 및 경로 안전성

- ID: `HANDOFF-2026-012`
- 날짜: `2026-08-30`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `tests`, `docs`
- 관련 이슈: `없음`

## 변경 내용

`experiments/hwp-export/mock_to_hwpx.py`가 모의고사 JSON의 그림 블록을 더 이상
자리표시로만 내보내지 않는다. `image.src`의 PNG/JPEG/GIF/BMP를 JSON 파일과 같은 폴더에서
읽어 HWPX `BinData`에 포함하고, 그림 블록의 mm 폭과 원본 가로세로 비율로 크기를 정한다.

JSON이 임의 경로의 로컬 파일을 읽게 하지 않도록, 절대 경로·`..`로 폴더 밖으로 나가는 경로는
차단했다. 파일이 없거나 형식을 읽을 수 없으면 조용히 생략하지 않고 경고 및 HWPX 안의
자리표시로 남긴다. `test_mock_to_hwpx.py`는 2×1 PNG를 만들어 바이너리 포함, HWPX 재열기,
폴더 탈출 차단을 확인한다.

제품 파일(`index.html`, `mock-exam-editor.html`, `serve.py`)은 변경하지 않았다.

## 위험과 검토 요청

지원 입력은 로컬 PNG/JPEG/GIF/BMP만이다. 편집기의 현재 `src`는 파일명 기준이므로 이와
맞지만, Firebase Storage URL·data URL을 직접 내보내는 제품 경로는 아직 지원하지 않는다.
실제 한글 앱에서 그림의 세로 배치와 페이지 넘김을 한 번 눈으로 확인해 달라.

## 검증

- 실행한 명령 또는 수동 절차:
  - 독립 venv에서 `pip install -r experiments/hwp-export/requirements.txt`
  - `python3 experiments/hwp-export/test_tex_to_hwp.py`
  - `python3 experiments/hwp-export/test_mock_to_hwpx.py`
  - `python3 experiments/hwp-export/make_e2e_probe.py /private/tmp/pedagogy-hwpx-e2e`
  - `python3 experiments/hwp-export/mock_to_hwpx.py experiments/hwp-export/samples/editor-seed.json /private/tmp/pedagogy-hwpx-final-smoke.hwpx`
  - `npm run check:fast`, `git diff --check`
- 결과:
  - 수식 변환 20/20 통과.
  - 그림 테스트는 HWPX 재열기와 ZIP의 `BinData` 바이트가 입력 PNG와 일치함을 확인.
  - 편집기 실제 예제 6문항·59수식이 경고 없이 HWPX로 생성됨.
  - 그림 파일명을 의도적으로 `missing.png`으로 바꾸면 `그림 파일을 읽지 못함` assertion으로
    실패하는 것을 확인한 뒤 원복.
  - 제품 빠른 검사 통과.
- 아직 실행하지 못한 검증과 이유:
  - 한컴오피스 한글에서 새 그림 포함 HWPX의 육안 검증. 이 환경에서는 구조적 생성·재열기까지
    확인했으며, 실제 GUI 조판 확인은 다음 검토 단계로 남긴다.

## 다음 검토자에게

`mock_to_hwpx.py`의 `safe_image_path()`가 JSON 파일의 부모 밖을 읽지 않는지와
`emit_figure()`의 width/height 비율을 먼저 검토해 달라. `test_mock_to_hwpx.py`는 외부
이미지·네트워크 없이 자체 PNG를 만들어 재현한다. 이 변경은
`codex/hwpx-export-experiment` 베타 브랜치에만 있으며 `main`에는 합치지 않는다.
