# 변경 인계 — 저장소 정리: 실물 자료를 `실물자료/` 로 모은다

- ID: `HANDOFF-2026-181`
- 날짜: `2026-10-04`
- 작성자: `Claude / Opus 5.5`
- 상태: `reviewed` — Codex Sol medium 1회, 결함 없음
- 영향 영역: `tests | docs`
- 관련 이슈: `없음`
- 브랜치: `claude/repo-tidy` (기준 `codex/b7-outbox-tg08vw` = main `11f1e12` + 레일 문서 2커밋)

## 변경 내용

해리 요청으로 작업 폴더를 정리했다.

- **저장소에 올라가는 변경**: 루트의 저작물 실물 15개(양식·수능 원본·참고 N제·실험 출력 `결과.hwpx`)를
  `실물자료/` 로 옮기고, 그 파일을 경로로 찾는 코드만 고쳤다 — `mock_to_hwpx.py`(`LOCAL_TEMPLATE`·`DEFAULT_REF`) ·
  틀 검사 넷의 `_LOCAL` · `exam_profile`/`template`/`make_exam_template` 의 CLI 기본값 · README 명령.
  출처를 밝히는 주석은 그대로 둔다(`index.html` 인라인 주석은 CSP 해시가 걸려 있다).
  `.gitignore` 에 `실물자료/`. 끝난 실험 `scripts/probe-schema.mjs` 삭제(호출자 없음).
  레일 문서의 Dependabot 범위를 열린 `#1~#7` 로 바로잡았다.
- **낡은 설명 바로잡기**(Codex 지적): CLAUDE.md 두 곳과 `verify.yml` 주석이 틀 검사 넷이 CI 에서 `⏭` 라고
  적었는데, 실제로는 저장소의 벗긴 틀로 **돈다**(main `verify.yml` 최근 실행 로그에서 넷 다 ✅).
- **로컬에서만**(저장소 무관): 다시 만들 수 있는 산출물 삭제 — `experiments/hwp-export/out/` · `test-results/` ·
  `dist/` · `work/tmp*` · `__pycache__/` · `firestore-debug.log` · `.DS_Store`, 그리고 9/20 감수용 옛 사본 `분석용 코드/`.

## 위험과 검토 요청

⚠️ 틀 검사 넷은 실물이 없으면 **조용히 벗긴 틀로 대체**한다 — 경로가 틀려도 빨간불이 아니라 실물 대조만 빠진다.
그래서 넷이 `실물자료/평가원 수학 양식.hwpx` 를 실제로 고르는지 모듈의 `TEMPLATE` 값으로 직접 확인했다.

## 검증

- `HWPX_PYTHON=/opt/anaconda3/bin/python3 npm run test:hwpx` — 12건 실행·통과, 건너뜀 0
- 넷의 `TEMPLATE` → `실물자료/평가원 수학 양식.hwpx` 존재 · `mock_to_hwpx` 의 `LOCAL_TEMPLATE`·`DEFAULT_REF` 존재
- `check:static` · `check:hooks` · `check:review-hygiene` 통과
- 다른 컴퓨터(실물 없음)에서는 이전과 같다 — 벗긴 틀이 우선이고 그 경로는 바뀌지 않았다

## 검토 기록

- 2026-10-04 · Codex GPT-5.6 Sol medium · 실물을 루트 경로·cwd·glob 로 찾는 실행 코드 전수 검색, 대체 조건, CI·제품 영향 ·
  **결함 없음**. 비차단 지적(CLAUDE.md·`verify.yml` 의 낡은 `⏭` 설명)은 CI 로그로 확인한 뒤 같은 브랜치에서 고쳤다.
