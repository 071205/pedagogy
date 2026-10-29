# 수식 표본 검사에서 입력 의미와 혼합 순서를 놓침

- ID: `REV-2026-121`
- 날짜: `2026-10-15`
- 보고자: `Codex` (독립 스킬 평가 에이전트 재현)
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-190`

## 요약과 영향

신규 수식 표본 검사는 생성기가 쓴 manifest의 script를 XML과 비교했고 표식의 존재만 확인했다.
그래서 변환기와 XML이 함께 틀리거나 AFTER 표식이 수식 앞으로 옮겨져도 통과했다.
실제로 만든 정상 표본이 잘못됐다는 판정은 아니다. 의미 검증 oracle의 독립성이 부족했다.

## 재현 절차

1. 임시/메모리 검사에서 `tex_to_hwp.convert = lambda _tex: 'x'`를 주입한다.
2. 별도 주입에서는 `append_run_xml`의 AFTER run을 문단 맨 앞으로 옮긴다.
3. 수정 전 각각 수식 표본 검사 exit 0, 7 checks PASS였다.

## 기대 결과 / 실제 결과

- 기대: 원래 분수·2×2 행렬·20항 합 의미 또는 BEFORE→수식→AFTER 순서가 틀리면 실패.
- 실제: 같은 manifest와 비교하고 표식 존재만 검사해 두 주입을 모두 놓쳤다.

## 근거

`scripts/check-hwp-equation-fixtures.py`가 `manifest['scripts']`를 기대값으로 썼고
문단/run 순서를 비교하지 않았다. 독립 에이전트가 수정 전 두 주입의 통과를 재현했다.

## 처리 기록

- `2026-10-15` · Codex: 변환기를 부르지 않는 고정 입력·script oracle, 직접 문단/run의
  정확한 혼합 순서와 다음 문단 위치 검사 추가. 연구 게이트 PASS,
  `H1_EQUATION_CONTENT_RED=script|order` 각각 `EQUATION_INPUT_MEANING_LOST` /
  `EQUATION_MIXED_ORDER_LOST` exit 1 확인. geometry RED도 유지한다.

- `2026-10-15` · Codex 독립 재검토: 같은 converter=x·AFTER 앞 이동 주입이 각각 의미/순서 code로 exit1. green과 geometry/script/order RED 확인. 추가 결함 없음.
