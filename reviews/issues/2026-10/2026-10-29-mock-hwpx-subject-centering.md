# 한글 시험지 선택과목 제목이 짧아지면 왼쪽으로 치우친다

- ID: `REV-2026-159`
- 날짜: `2026-10-29`
- 보고자: `사용자 / Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock | tests`
- 관련 인계: `HANDOFF-2026-207`

## 재현·기대·실제

시험지 정합 표본9문항/선택 기하를 실제 Mac 한글로 PDF저장한다. 3쪽 과목 제목은 원본의 확률과 통계→기하로 바뀌지만 paraPr24 JUSTIFY와 앞쪽 공백8개가 남는다. 제목이 가운데여야 하나 실제1100px 렌더에서 제목 ink x205~454, 중심329.5, 종이중심380으로 약50.5px 왼쪽이다. 사용자가 출력 이미지에서 지적했고 XML/실제 PDF로 확인했다.

## 근거·처리 기록

- `/private/tmp/pedagogy-pre2-hwpx-fixed/final-native-3.png`, browser-exam.hwpx section1의 제목 문단·header paraPr24.
- 2026-10-29 Codex: 공백으로 배치한 원본 양식에 길이가 다른 과목명을 넣은 것이 원인. 제목 문단만 CENTER 서식 사본을 쓰고 앞쪽 공백/낡은 줄 위치 캐시를 지우는 수정 진행. 공유 서식/글자 모양·본문은 보존. 독립 검토·실제 출력 확인 전 resolved로 바꾸지 않음.

- 2026-10-29 Codex: JS/Python center_masthead_subjects를 본문 비우기/머리말 캡처 전에 적용. 원본 공유 서식5/24를 보존하고 제목용 CENTER 사본52/53과 공백/줄 캐시 제거로 수정. 실제3쪽 제목 중심377.5/380/379px(종이380), 기하9문항/정확한 쪽수 유지·왕복 재열기 PDF3쪽 PNG동일. 정상/RED3·HWPX12·문서 브라우저·정적·회귀175·기존 review-contracts 통과.
- 2026-10-29 Claude Opus/high: 첫 검토240s timeout, 좁은 inline 재시도에서 제시한 후행공백/검사시점 가설을 실제 생성물과 재대조해 철회. [정정 최종 합의](../../audits/2026-10-29/prelaunch-print/claude-center-final.md): 지원 소스 틀에 재현 블로커/미합의 없음. 잉크 bbox의 작은 비대칭을 고치려고 올바른 CENTER 좌표를 임의 이동하지 않는다. [근거](../../audits/2026-10-29/prelaunch-print/hwpx-centering-verification.json).
