# 변경 인계 — 자칼 런타임 제거 및 내부 HWPX 엔진 이관

- ID: `HANDOFF-2026-017`
- 날짜: `2026-08-31`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `mock`, `server`, `tests`, `docs`

## 변경 내용

HWPX 내보내기가 외부 `jakal-hwpx` 패키지를 불러오지 않게 했다.
`pedagogy_hwpx.py`는 PEDAGOGY가 유지하는 최소 엔진으로, 현 내보내기에 필요한 HWPX
패키지 읽기·저장, 실물 틀 보존, 문단·인라인 수식·그림 삽입, BinData manifest 갱신과
기본 참조 검증을 제공한다. XML 파싱에는 `lxml`만 직접 의존한다.

기존 바이너리 HWP 분석 실험은 `exam_profile.py`에서 선택적 legacy 경로로 바꿨다.
자칼이 없는 제품 환경에서는 HWPX 틀을 우선 쓰고, 틀이 없으면 저장된 기본 조판값으로
내보낸다.

## 검증

- `test_internal_runtime.py`: import hook으로 `jakal_hwpx`를 강제로 차단한 상태에서
  수식·그림 포함 HWPX를 생성했다.
- `HWPX_REQUIRE=1 npm run check:fast` 통과: HWPX 검사 7건과 제품 빠른 검사 통과.
- `HWPX_REQUIRE=1 npm run test:hwpx-parity` 통과: 34문항의 선지 배치가 편집기와 일치.
- `check-static.mjs`에 직접 `jakal_hwpx` import 금지 검사를 추가했고, import를 되돌려
  넣은 고의 실패에서 assertion이 발생한 뒤 원복했다.
- `git diff --check` 통과.

## 위험과 다음 검토

내부 엔진은 현재 사용 중인 HWPX 표면(문단·수식·그림·실물 시험지 틀)만 지원한다.
표·도형·각주·차트 같은 일반 한글 문서 기능은 아직 범위 밖이다. 범용 AI 문서 조판을
넓힐 때는 요청 형식을 먼저 JSON 스키마로 제한하고, 새 블록마다 HWPX 구조·한컴 육안
검사를 추가해야 한다.
