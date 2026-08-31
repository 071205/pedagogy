# 변경 인계 — 모의고사 한글(HWPX) 내보내기 · 베타 (제품 연결)

- ID: `HANDOFF-2026-012`
- 날짜: `2026-08-31`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `mock`, `server`, `tests`, `docs`
- 관련 이슈: `없음`
- 이어지는 인계: `HANDOFF-2026-010`, `HANDOFF-2026-011`

## 변경 내용

지금까지 `experiments/hwp-export/` 에만 있던 한글 내보내기를 **베타 기능으로 제품에 연결**했다.
이번이 실험이 제품 코드를 건드린 첫 변경이다.

- `serve.py` — `POST /hwpx` 추가. 편집기의 저장 JSON 을 그대로 받아 `.hwpx` 를 돌려준다.
  **`/render` 와 같은 관문**(Host·Origin·`X-Exam-Client`·본문 크기)을 그대로 지난 뒤에만
  들어온다. 변환기는 `experiments/hwp-export` 를 그때 import 하며, 없거나 의존성이 없으면
  501 로 **무엇을 설치해야 하는지 안내**하고 서버는 계속 돈다.
- `mock-exam-editor.html` — 툴바에 `한글 내보내기 [베타]` 버튼. `/render` 와 같은 보안 헤더를
  보내고, 서버가 없으면 `python3 serve.py` 를 실행하라고 알린다. 변환 경고 건수는 응답 헤더
  `X-Hwpx-Warnings` 로 받아 토스트에 함께 띄운다(그림 누락·수식 변환 실패를 조용히 넘기지 않는다).
- `regression-test.html` — 검사 2건 추가(버튼 존재·베타 표시 / 보안 헤더 전송).

변환 자체는 여전히 `experiments/` 에 있고 제품이 아니다. 이 엔드포인트가 유일한 연결점이라
폴더를 지우면 버튼이 501 안내만 내고 나머지 제품은 그대로 동작한다.

## 위험과 검토 요청

**보안 관문을 그대로 지나는지가 이번 변경의 핵심 검토 지점이다.** `do_POST` 의 Host·Origin·
커스텀 헤더·본문 크기 검사를 `/render` 와 `/hwpx` 가 공유하도록 경로 분기만 넓혔다.
새 경로를 추가할 때 그 검사를 건너뛰지 않았는지 diff 로 확인해 달라.

응답이 JSON 이 아니라 바이너리라 `_json()` 을 쓰지 않고 직접 헤더를 쓴다. `_cors()` 를
빠뜨리지 않았는지, `Content-Length` 가 실제 길이와 맞는지 함께 봐 달라.

변환기는 요청마다 `importlib.reload` 한다(실험 중 코드가 자주 바뀌므로). 상용에 올릴 것이라면
이 부분은 한 번만 import 하도록 바꾸는 편이 낫다.

## 검증

- 실행한 명령 또는 수동 절차:
  - `curl` 로 헤더 없이 `POST /hwpx` → 403, 정상 요청 → 200 + 유효한 HWPX
  - 브라우저에서 편집기를 열어 `/hwpx` 를 실제로 호출(200, 63KB, 경고 1건)
  - `regression-test.html`
  - **의존성이 없는 파이썬으로 서버를 띄워** `/hwpx` 호출
  - `npm run check:fast`, `python3 -c "py_compile serve.py"`,
    `experiments/hwp-export/test_structure.py`, `test_layout.py`
- 결과:
  - 보안 관문 유지 확인(헤더 없으면 403).
  - 브라우저 회귀 **92 / 92 통과**(새 검사 2건 포함).
  - **보안 헤더를 일부러 빼자 `1건 실패 · 91건 통과` 로 빨간불이 됐고**, 원복 후 다시 92/92.
  - 의존성 없는 환경에서 501 과 설치 안내가 나오고 서버는 계속 동작.
  - 제품 정적 검사·문법 검사·실험 검사 모두 통과.
- 아직 실행하지 못한 검증과 이유:
  - 실제 인쇄물 대조. 실물 글꼴(신명 계열)이 이 컴퓨터에 없어 화면 조판까지만 확인했다.
  - 30문항 전체·선택과목이 섞인 시험지. 표본이 6문항이다.

## 다음 검토자에게

`serve.py` 의 `do_POST` 분기와 `_hwpx()`, `mock-exam-editor.html` 의 `toHwpx()`,
`regression-test.html` 의 새 검사 2건만 보면 된다. 변환기 쪽은 `HANDOFF-2026-011` 과
`experiments/hwp-export/README.md` 를 참고한다.

실물 `.hwpx` 틀은 저작물이라 커밋하지 않았다(`.gitignore`). 틀이 없으면 변환기가 임시
기본값으로 내려가므로 조판 품질만 떨어지고 동작은 한다.
