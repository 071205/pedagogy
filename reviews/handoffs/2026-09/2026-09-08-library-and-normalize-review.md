# HANDOFF-2026-076 — A단계·정규화 분리 독립 검토

- 상태: ready-for-review
- 작성: Codex
- 기준: `b14b010`, `8392ee8`
- 관련 이슈: REV-2026-052 (resolved)

## 결론

`b14b010`의 기본 `libraryCloudSchema: 0`은 새 Firestore Rules의 운영 배포가 확인되지 않은 상태에서 맞는 A단계 기본값이다. 계약 검사는 A와 B를 명시적으로 나누어 실행하며, B 기능을 기본값에 우연히 의존하지 않는다.

`8392ee8`은 정규화와 입력 신뢰 경계를 별도 classic script로 옮기면서 기존 `window` 공개 표면을 유지한다. `file://`에서 추가 스크립트를 같은 디렉터리에서 읽는 방식도 현재의 정적 내보내기 계약과 맞는다.

## 재현된 문제와 수정

Node VM 정규화 검사가 표준 `URL` 없이 실행되어 `safeUrl()`의 허용 URL 경로를 검증하지 못했다(REV-2026-052). 검사 컨텍스트에 `URL`을 주입하고 허용된 Storage URL 단언을 추가했다. 브라우저 제품 코드 변경은 없다.

## HANDOFF-075의 세 질문

1. 현재 `window` 표면 복원은 순수 추출 단계에서 호환성을 지키는 근거가 충분하다. 사용처를 모두 module import로 바꾸기 전에는 축소하지 않는다.
2. `sheetHex`처럼 UI 표현에만 쓰이는 값은 index에 두어도 된다. 정규화 모듈은 입력 정제·기본값·상한처럼 신뢰 경계에 필요한 값만 소유해야 한다.
3. 다음 렌더 단계 전에는 분리된 정규화가 현재 파일과 동일한 API와 오류 처리를 유지한다는 계약 검사를 먼저 확장한다. 현재 단계에서 렌더 추출을 시작할 근거는 없다.

## 검증

- `npm run test:review-contracts` 통과: A/B 스키마, 폴더 tombstone, 계정 전환, 삭제·Undo·401 재시도, HTTP·`file://` HWPX와 실패 UI
- `HWPX_PYTHON=… npm run test:audit-browser` 통과: 154 / 154
- `npm run test:worker` 통과
- `npm run check:static` 통과
- `PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npm run check:rules` 통과

원격 push, Firebase Rules 배포, Worker 배포는 수행하지 않았다. `.tmp.driveupload/`의 다른 작업자 파일은 건드리지 않았다.
