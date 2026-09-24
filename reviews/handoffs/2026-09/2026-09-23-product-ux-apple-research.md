# 변경 인계 — 제품 UX 요구 통합·Apple 공식 UX 조사

- ID: `HANDOFF-2026-165`
- 날짜: `2026-09-23`
- 작성자: `Codex`
- 상태: `needs-follow-up`
- 영향 영역: `docs`
- 관련 이슈: `없음`

## 변경 내용

사용자의 제품 방향, AI 일괄 구성 UX 토론, N제 전체 지면 요구와 Apple 공식 UX 조사 적용안을
[PRODUCT-UX-DESIGN.md](../../../docs/PRODUCT-UX-DESIGN.md)에 통합했다. 구현 전 제안이며
코드·실행 레일·저장 계약은 변경하지 않았다. 사용자 선택은 전체 지면도 이번 UX와 함께 구현이다.

## 위험과 검토 요청

Apple의 네이티브 동작을 웹에 그대로 복제하지 않았는지, AI/저장 상태와 되돌리기 범위를
과장하지 않았는지 확인할 것. HANDOFF-162의 저장 구조·B4 순서 미결을 닫는 기록이 아니다.

## 검증

- Apple HIG·Pages 공식 문서와 기존 UI/인쇄 코드의 관련 구간을 읽기 전용으로 대조.
- 문서 내부 로컬 Markdown 링크·`git diff --check` 통과. INDEX 상한 초과를 발견해 기존 설명을
  압축한 뒤 `check:review-hygiene` 통과(120/120줄, 최근5/5, 자기검사6/6). 기록 파일 삭제 없음.
- 기능/브라우저 검사는 미실행: 문서만 작성했으며 구현·사용성 검증을 주장하지 않는다.

## 다음 작업자에게

다음은 **Astra high**로 기존 실행 레일에 UX 요구를 통합한다. 입력은 이 문서와
`docs/PRODUCT-UX-DESIGN.md`, `docs/DEV-TOKEN-ROADMAP.md`, `docs/RAIL-ORDERS.md`,
`docs/STORAGE-CONTRACT.md` §2-5, HANDOFF-162다. HANDOFF-164 검토는 완료됐으나 B3 실제
배포는 미실행이다. 먼저 UX 요구가 R2/R4/R8과 B4~B7에 미치는 영향·순서·모델·완료 기준을
문서에 반영하고, 미결 사용자 결정을 분리한다. 코드 구현과 과거 검사 반복은 이번 다음 작업의
범위가 아니다. 레일 통합 후 연결된 시안 과제를 정해 사용자 확인을 받는다.

## 검토 기록

아직 독립 검토하지 않음.
