# R8 수동 PDF 원문 연결 감사

- ID: `HANDOFF-2026-200`
- 날짜: `2026-10-23`
- 구현: Codex
- 독립 검토: Codex `/root/r8_edit_print_review`, GPT-6 Sol / medium
- 범위: 감사 실행 코드·합성 증거. 제품 저장 동작 변경 없음.

## 변경과 검증

[감사 README](../../audits/2026-10-23/README.md)의 실제 PDF 원문 연결 절을 따른다.
결정적인 실제 2쪽 PDF를 filechooser로 입력하고 PDF.js canvas 픽셀, 기존 PNG 참조와
2쪽 지정, 재로드 Blob 바이트·SHA·ID·참조 및 UI 재진입을 연결해 확인한다.
source-only/편집·출력 결합/기본 대조 각각 세 화면 크기 정상, Blob/canvas/다른 참조
제거 RED 각각 목표 단언에서 실패했다. 소유 서버/브라우저 정리 및 node 문법·diff 검사 통과.

독립 검토에서 재현한 [REV-151](../../issues/2026-10/2026-10-23-tests-r8-source-ref-vacuous-assertion.md)은
기존 refs가 빈 배열이라 보존 비교가 공허하던 검사 결함이다. 실제 UI PNG 참조 준비와
nonempty 단언, 앱의 다른 참조 보존만 제거하는 RED로 수정하고 독립 재검증 후 resolved.
합의 / 미합의 없음 / 코드·정상 및 세 RED 근거 / 다음 R7 독립 호스팅 준비 계속.

## 현재 레일과 미결

PR28 main merge `a3d8a726c80b77675d2b141e38d1fdeef44f4326`의 Verify `39933138950`
필수 네 job 성공 및 Pages built를 확인했다. PR27 main `506b33c`도 네 job/Pages 완료.
main Sonar Security E는 이전 main부터 있던 네 finding이며 PR head 통과와 구별한다.
현재 인계 브랜치의 별도 CI 완료를 주장하지 않는다.

사용자 로그인 갱신 뒤에도 CLI 등록 계정은 하나, 분리 `pedagogy-ai-staging` SDK 조회는
403이다. 현재 계정의 projects:list에는 production만 보인다. 새 결제 연결 없는
`pedagogy-web-staging` 생성도 code8 project quota 초과로 거절됐다. 생성 완료/분리
staging 완료로 기록하지 않는다. production 설정·Rules·계정 기본값·결제는 변경하지 않았다.
사용자는 부재 중 승인 범위에서 계속하고 질문은 미결로 남기라고 지시했다. 도메인 구매 보류.

무료 정적 게스트 미리보기는 별도 패키지·명시 guest mode·backend/loopback 호출 차단·
자료 이관 금지 배너·독립 검토·정상/RED 후 새 기본 주소만 배포하는 다음 작업이다.
Astra high 독립 설계 판정은 이 경계를 조건으로 합의했으며 아직 배포 완료가 아니다.
전체 원문 무손실 이관은 기존 JSON export로 불가능하다는 설계 판정이 나왔다.
owner별 원문 Blob/전체 refs·초안·outbox·삭제 fence·동시 쓰기·cloud ACK와 mock blind write를
보존/차단하는 별도 high 구현·검토가 필요하다. 실제 사용자 자료를 새 origin에 옮기지 않는다.

R8의 PDF는 수동 연결이다. AI 추출/유료 AI/실계정 ACK/시스템 인쇄·한글/Safari·iPad/
인간 관찰은 미완료이며 R7 실제 운영 전환·R8 전체 운영 완료·R9/10 완료로 세지 않는다.
