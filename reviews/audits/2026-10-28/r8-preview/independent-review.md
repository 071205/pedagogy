# R8 미리보기 최종 독립 검토

2026-10-28 · 구현 root Codex / 독립 검토 GPT-6 Sol medium (`r8_final_review`, 레일 지정).

- 합의: REV157 로컬 수정·회귀에 추가 재현 결함 없음.
- 근거: 375/768/1194px의 6쪽 탐색, 실제 잘림 경고→한 쪽 배치→Undo 복구, 10개 목표 RED, cleanup2 fulfilled. package/CI의 Chromium 설치 뒤 quick 검사 순서·diff check 확인.
- 미합의: 없음. 다음: 인계/이슈 기록 후 후속 CI 확인.
- 한계: 실제 로그인·시스템 인쇄/한글·Safari/iPad 실기기·원격 backend/운영 게이트 미검증.

첫 별도 검토자(`r8_preview_review`)는 원본 안내+문항 선택에서 paper viewport가 패널 밖으로
사라지는 결함을 실제 재현했다. source 높이/flex 제한과 inspector overlay로 보완했으나,
그 검토자는 capacity 오류로 최종 판정을 못 남겼다. 위 별도 Sol 검토가 최종 판정이다.

검토 중 Escape의 선행조건 누락을 의심했지만 기존 selectSheetProblem이 다시 여는 경로를
놓친 것으로 검토자가 단정을 철회했다. 열린 선행조건·내부 버튼 초점·Escape 제거 RED를
명시해 검증 근거를 강화했다. 실행 중 complete:false를 최종 통과로 세지 않았다.

Claude opus/high inline 진단은150초 timeout/최종의견0이었다. 반복 호출하지 않고 지정 로컬
모델의 독립 검토로 이어갔으며 Claude 승인으로 기록하지 않는다.

## 최종 원본 usability 보완

guest 추가 QA에서 원본 영역12px/연결button hit=false를 root가 실제 재현했다. 종이의
flex-basis:auto가 여러 쪽 intrinsic height로 원본을 압축한 것이 원인이었다. 최종 narrow
flex-basis0으로 고치고, 원본 없음/긴 이미지 양쪽의 최소 높이/버튼 hit와 해당 RED를 추가했다.
별도 Sol 검토자가 최종 정확본 정상3/RED10·cleanup·diff check를 확인해 합의를 갱신했다.
미합의 없음, 시스템/실기기/원격 운영 미검증 범위는 유지한다.
