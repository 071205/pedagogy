# section ID 이름만으로 일반 리소스를 본문 파손으로 오진함

- ID: `REV-2026-125`
- 날짜: `2026-10-15`
- 보고자: `Claude 검토 후보 · Codex 재현`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock`
- 관련 인계: `HANDOFF-2026-191`

## 요약과 영향

새 구역 진단의 초기 구현은 id=section3인 일반 바이너리 리소스도 비구역 루트 integrity 오류로
판정했다. 구역과 같은 ID를 공유하는 일반 리소스를 후보에 확장하면서 target 오류도 더했다.
일반 HWPX의 임의 ID 이름을 자체 canonical 출력 규칙과 혼동한 과잉 진단이다.

## 재현 절차 / 기대 결과 / 실제 결과

1. 자체 정상 두 구역에 `BinData/research.bin`을 추가하고 manifest id를 section3으로 둔다.
2. 같은 일반 리소스를 section3·section4 두 ID로 참조하는 표본도 만든다.
3. 실제 구역 id=body와 일반 리소스 id=body가 중복되는 표본을 만든다.
4. 수정 전 새 exact oracle에서 `UNEXPECTED_SECTION_DIAGNOSTIC`로 실패했다.

기대: 1/2의 inspect는 unsupported 경고이며 일반 리소스 중복을 구역 target 중복으로 표시하지 않는다.
3은 ID 중복 integrity 오류를 유지하되 일반 리소스 target 파손 오류를 덧붙이지 않는다.
초기 구현은 ID 이름/공유만으로 target-invalid 또는 target-duplicate를 추가했다.

## 처리 기록

- `2026-10-15` · Codex: Claude C 제안의 OR 필터만으로는1이 남는 반례를 제시했고, D 검토에서
  실제 hs:sec / canonical 구역 자리 / ID 이름만 일치하는 리소스의 세 티어로 합의했다.
  ID 중복 모집단과 target 검사 모집단을 분리했다. Python/JS50사례와 resource3개 전체
  code/severity/kind oracle가 통과했다. 두 런타임의 `resource-classification` RED는 모두
  `UNEXPECTED_SECTION_DIAGNOSTIC`로 exit1. Codex 독립 에이전트도 분류를 대조했다.
