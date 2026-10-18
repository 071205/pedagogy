# 일반 manifest item의 href 누락을 JS만 놓침

- ID: `REV-2026-127`
- 날짜: `2026-10-15`
- 보고자: `Claude 후보 · Codex 재현`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock`
- 관련 인계: `HANDOFF-2026-191`

## 요약과 영향

id=plain-resource인 일반 manifest item에서 href 속성만 생략하면 Python은 오류지만 브라우저 JS는 strict/toBlob을 통과했다. 기존2547a1e에도 있던 참조 검사 차이다.

## 재현 절차 / 기대 결과 / 실제 결과

독립 Codex가 현재/2547a1e와 실제 Chromium에서 정상 대조군 포함6건으로 재현했다. 새 사례도 수정 전 MANIFEST_HREF_MISSING_UNCHECKED로 실패했다.
검사: `scripts/check-hwpx-section-package.py`와 실제 DOM의 `.mjs`.
정상 출력은 보존하고 누락/없는 글꼴 참조는 양쪽 동일하게 차단해야 한다.

## 처리 기록

- `2026-10-15` · Codex: 양쪽 href 누락을 빈 문자열로 정규화하고 기존 missing-part 참조 오류로 차단한다. references 전체 메시지를 parity에 포함했다. missing-href RED가 양쪽 MANIFEST_HREF_MISSING_UNCHECKED로 실패한다.
  최종56사례·기존출력 대조·Claude 좁은 후속 검토는191에 모은다.
