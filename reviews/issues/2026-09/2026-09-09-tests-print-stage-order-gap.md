# 인쇄 단계 검사가 측정 뒤 초기화하는 잘못된 순서를 통과시킴

- ID: `REV-2026-060`
- 날짜: `2026-09-09`
- 보고자: `Codex`
- 상태: `open`
- 심각도: `P3`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-079`, `HANDOFF-2026-081`

## 재현과 영향

`test:review-contracts`의 단계 판정은 첫 `read`와 마지막 `read` 사이가 모두 읽기인지에만
의존한다. 따라서 `read, read, read, read, clear, clear, apply`처럼 **이전 축소를 재기
전에 해제하지 않는** 순서도 `true`다. 이 순서는 재인쇄 때 이미 축소된 폭을 자연 폭으로
오인할 수 있지만 현재 가짜 노드는 `scrollWidth`를 항상 400으로 돌려줘 함께 놓친다.
현재 제품 구현의 `clear → read → apply` 순서는 올바르다.

## 수정 설계

가짜 스타일 setter에서 빈 값은 `clear`, 나머지는 `apply`로 기록하고
`lastClear < firstRead <= lastRead < firstApply`를 단언한다. 초기 스타일을 축소된 상태로
채우고 `scrollWidth`가 해제 여부에 따라 달라지게 해 최종 `width`와 `scale`도 확인한다.
측정 루프를 해제 루프 앞으로 옮겼을 때 빨간불인지 검증한다. 현재 사용 중인
`scrollWidth`·`offsetHeight`를 대상으로 한 구조 검사임을 설명하고, 새로운 레이아웃 읽기
API가 생기면 계측 대상을 함께 늘린다.
