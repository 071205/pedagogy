# fontRef의 xmlns 선언을 JS만 글꼴 ID로 해석함

- ID: `REV-2026-128`
- 날짜: `2026-10-15`
- 보고자: `Claude 후보 · Codex 재현`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock`
- 관련 인계: `HANDOFF-2026-191`

## 요약과 영향

hh:fontRef 자체에 xmlns:x=urn:h1-review-x만 선언하면 Python은 통과하지만 JS는 fontface lang=XMLNS:X에 없는 글꼴 오류를 냈다. DOM attributes에는 xmlns 선언이 있으나 lxml attrib에는 없다. 기존2547a1e에도 있다.

## 재현 절차 / 기대 결과 / 실제 결과

독립 Codex가 현재/2547a1e·실제 Chromium에서 확인했다. namespace 선언만 추가한 정상 입력은 출력 가능해야 하고 hangul=999999는 계속 차단해야 한다.
검사: `scripts/check-hwpx-section-package.py`와 실제 DOM의 `.mjs`.
정상 출력은 보존하고 누락/없는 글꼴 참조는 양쪽 동일하게 차단해야 한다.

## 처리 기록

- `2026-10-15` · Codex: JS는 http://www.w3.org/2000/xmlns/ namespace의 속성만 건너뛴다. 정상/없는 font ID 대조와 전체 references parity를 확인했다. namespace-ref RED가 양쪽 NAMESPACE_DECLARATION_AS_FONT로 실패한다.
  최종56사례·기존출력 대조·Claude 좁은 후속 검토는191에 모은다.
