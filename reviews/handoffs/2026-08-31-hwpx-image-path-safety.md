# 변경 인계 — HWPX 그림 경로 제한 및 work 폴더 연결

- ID: `HANDOFF-2026-013`
- 날짜: `2026-08-31`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `mock`, `server`, `tests`, `docs`
- 관련 이슈: `REV-2026-007`, `REV-2026-008`

## 변경 내용

HWPX 베타 내보내기의 그림 탐색을 허용 폴더 안으로 제한했다. `find_image()`는 후보 경로와
루트를 정규화해 폴더 밖·절대 경로·심볼릭 링크 탈출을 건너뛰고 실제 파일만 고른다.
기본 변환 경로도 저장소 전체가 아니라 출력 파일 또는 JSON 옆 폴더만 탐색한다.

서버 `POST /hwpx`는 편집기가 안내한 `work/`를 유일한 이미지 루트로 명시 전달한다.
따라서 Typst 미리보기와 한글 내보내기가 같은 그림 파일명을 해석한다.

## 위험과 검토 요청

HWPX 서버 내보내기는 `work/` 안의 로컬 PNG/JPEG만 대상으로 한다. Firebase Storage URL이나
다른 위치의 파일은 의도적으로 읽지 않고 경고·자리표시로 남는다. `work/`의 사용 규칙을
바꾸면 `_hwpx()`의 `images=[WORK]`도 함께 검토해야 한다.

## 검증

- 실행한 명령 또는 수동 절차:
  - `python3 experiments/hwp-export/test_image_paths.py` (독립 venv)
  - `npm run check:fast`
  - 로컬 venv 서버에서 `POST /hwpx`로 `work/hwpx-endpoint-figure.png` 내보내기
  - `git diff --check`
- 결과:
  - 정상 그림은 HWPX에 포함, `../outside.png`와 절대 경로는 차단됨.
  - 검사 조건을 반대로 바꾸면 경로 탈출 차단 assertion이 실패했고, 원복 뒤 통과.
  - 실제 응답은 200, `X-Hwpx-Warnings: 0`; 결과 ZIP에
    `BinData/hwpx-endpoint-figure.png`가 포함됨.
  - 제품 빠른 검사 통과.
- 아직 실행하지 못한 검증과 이유:
  - 새 그림 포함 결과의 한컴오피스 육안 조판 비교. 이 환경에서는 HWPX 구조·바이너리 포함과
    서버 응답까지만 확인했다.

## 다음 검토자에게

`mock_to_hwpx.py`의 `find_image()`와 `serve.py`의 `_hwpx()` 호출을 함께 확인해 달라.
`test_image_paths.py`는 경로 탈출과 정상 그림 포함을 독립 임시 폴더에서 재현한다.
