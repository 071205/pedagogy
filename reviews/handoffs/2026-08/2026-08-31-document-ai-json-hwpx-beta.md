# 변경 인계 — 범용 AI 문서 JSON·미리보기·HWPX 베타

- ID: `HANDOFF-2026-018`
- 날짜: `2026-08-31`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index`, `worker`, `server`, `tests`, `docs`
- 관련 이슈: `없음`

## 변경 내용

모의고사 전용 흐름과 별도로 `document-editor.html`을 추가했다. 사용자는 한국어 요청을
입력하고, Worker가 만드는 제한된 문서 JSON을 화면에서 다시 검증·미리보기한 뒤 로컬
`/document-hwpx`를 통해 HWPX로 내보낸다. 메인 상단의 `AI 문서 β` 링크로 진입한다.

`document_schema.py`는 제목·제목글·문단·별행 수식·글머리표·번호 목록·인용문만 허용하며,
길이·개수와 타입을 제한한다. AI가 임의 HWPX/XML/HTML을 건네는 통로는 없다.
`document_to_hwpx.py`는 내부 `pedagogy_hwpx.py` 및 기존 LaTeX→HWP 수식 변환기를 이용해
같은 블록을 조판하고, 미지원 수식은 문서와 경고에 남긴다.

Worker는 기존 사진 문제 변환을 유지하면서 `mode: "document"` 요청을 추가했다. 같은
Firebase 인증·Origin 제한·Durable Object 사용량 예약/확정 규칙을 거치며, 모델 응답도
Worker와 브라우저와 Python 조판기에서 각각 계약 검증을 받는다.

## 위험과 검토 요청

- 이 기능은 아직 베타다. 표·그림·각주·사용자 제공 고정 양식의 정밀 재현은 지원하지 않으며,
  UI에도 이를 명시했다.
- HWPX 출력은 `lxml`을 설치한 로컬 `serve.py`에서만 가능하다. 정적 GitHub Pages만 열면
  AI 초안·JSON 미리보기까지만 가능하고 내보내기 경로는 없다.
- Worker 코드 변경은 저장소에만 반영했다. 배포 Worker가 새 문서 모드를 실제로 받도록 하는
  배포 작업은 이 변경에 포함되지 않는다.
- 한컴 한글의 실제 화면 육안 검증은 기존 수식·문단 경로의 검사를 통과했지만, 이 새 범용
  스타일은 표본 HWPX의 구조 검사와 브라우저 다운로드까지 확인한 상태다. 다음 검토자는
  한컴 한글에서 생성 파일을 열어 제목·목록·수식의 실제 인쇄 모양을 확인해야 한다.

## 검증

- `experiments/hwp-export/test_document_export.py` 통과: 허용 블록, raw XML 거절,
  수식 3개와 필수 HWPX 패키지를 확인했다.
- `experiments/hwp-export/test_document_endpoint.py` 통과: 실제 `/document-hwpx`가
  HWPX를 내보내고, 잘못된 블록은 400, `X-Exam-Client` 없는 요청은 403인지 확인했다.
- 새 수식 개수 assertion을 4로 고의 변경했을 때 `test_document_export.py`가 실패하는 것을
  확인한 뒤 원복했다.
- `node worker/worker-contract.test.mjs` 통과: 문서 요청의 인증 → reserve → consume →
  제공자 순서와 잘못된 AI 블록 거절을 확인했다.
- 로컬 브라우저에서 기본 문서와 수식 미리보기, 전체 블록 JSON 검증, HWPX 내보내기 성공
  상태(콘솔 오류 없음)를 확인했다.
- `HWPX_PYTHON=/private/tmp/pedagogy-hwpx-venv/bin/python HWPX_REQUIRE=1 npm run check:fast`
  통과: HWPX 9건을 포함한 빠른 회귀 검사 통과.
- `HWPX_PYTHON=/private/tmp/pedagogy-hwpx-venv/bin/python HWPX_REQUIRE=1 npm run test:hwpx-parity`
  통과: 기존 모의고사 선지 배치 34문항이 편집기와 일치.
- `git diff --check` 통과.

## 다음 검토자에게

변경 범위는 `document-editor.html`, `worker/index.js`, `serve.py`,
`experiments/hwp-export/document_*` 및 관련 검사다. `python3 serve.py`를 실행하는
인터프리터에 `experiments/hwp-export/requirements.txt`의 `lxml`이 설치돼 있어야
`/document-hwpx`를 실제로 확인할 수 있다. Worker 배포 전에는 실제 AI 버튼 대신
문서 JSON을 직접 넣어 미리보기·내보내기를 확인할 수 있다.
