# 구역 선언 수가 작아 본문을 잃는 파일도 출력함

- ID: `REV-2026-123`
- 날짜: `2026-10-15`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock`
- 관련 인계: `HANDOFF-2026-191`

## 요약과 영향

물리 구역이 둘인데 header secCnt=1인 파일을 Python strict/save와 브라우저 strict/toBlob이 허용했다.
H1-section-02 실물에서 이 입력은 A만 읽고, 재저장 시 B XML까지 사라졌다. 일반 정상 생성물의
현재 본문이 유실됐다는 보고는 아니며, 이런 불일치 출력에 방어선이 없던 결함이다.

## 재현 절차

1. 자체 두 구역 표본의 secCnt만1로 바꾼다.
2. `H1_PACKAGE_BASELINE=2547a1e <lxml Python> scripts/check-hwpx-section-package.py`.
3. `H1_PACKAGE_JS_BASELINE=2547a1e HWPX_PYTHON=<같은 Python> node scripts/check-hwpx-section-package.mjs`.
4. 두 기준 검사가 새 API 부재가 아니라 `SECTION_COUNT_LOSS_UNBLOCKED`로 exit1임을 확인한다.

## 기대 결과 / 실제 결과

- 기대: 현재 출력 프로필에서 `[section-count-mismatch]`로 출력 전에 차단.
- 수정 전: strict를 통과하고 출력. 실제 한글에서는 뒤 구역 누락.

## 근거

[실험 결과](../../../docs/HWP-RESEARCH-RESULTS.md) H1-section-02와
`research/h1-section-02.json`에 입력/저장/PDF 해시·관찰이 있다.

## 처리 기록

- `2026-10-15` · Codex: Python/JS에 읽기 전용 구역 진단과 canonical 출력 프로필 게이트 추가.
  별칭/ID 교환은 inspect 경고와 export 미지원 오류로 구분한다. 누락 파트 guard와 기존 참조 순회를 유지한다.
  Python·실제 Chromium DOM parity, save/toBlob 차단·정상 재열기·내용 보존·기준 RED를 확인했다.
  기존HWPX12종/동시성·일반브라우저·시험지·167회귀 통과. 최종 범위/추가 검증은 인계191.
