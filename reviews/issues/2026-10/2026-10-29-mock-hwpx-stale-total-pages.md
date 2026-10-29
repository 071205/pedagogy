# 모의고사 HWPX의 전체 쪽수가 원본 틀의 20으로 남는다

- ID: `REV-2026-158`
- 날짜: `2026-10-29`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `mock | tests`
- 관련 인계: `HANDOFF-2026-207`

## 요약과 영향

현재 브라우저 HWPX 생성기의 시험지 표본을 실제 한글에서 PDF로 저장하면 3쪽인데 하단은
1/20·2/20·3/20으로 표시된다. 수식/문항 표시 성공이나 Python/JS parity 성공만으로 잡히지 않는
출력 정보 오류다. 원본 틀의 전체 쪽수20이 masterpage에 남아 있다.

## 재현 절차

1. 현재 코드에서 HWPX_EXAM_OUT을 지정해 scripts/check-hwpx-exam.mjs로 browser-exam.hwpx 생성.
2. Mac 한글 앱에서 열어 파일→PDF로 저장하기 실행.
3. 실제 PDF는3쪽이며 각 쪽 하단의 분모는20이다. XML Contents/masterpage0~3.xml의 hp:t도20.

## 기대 결과 / 실제 결과

- 기대: 출력의 전체 쪽수는 실제 문서와 일치하거나 보장할 수 없는 총수를 표시하지 않는다.
- 실제: 현재 쪽은1/2/3으로 갱신되지만 전체 쪽수가 원본 값20이다.

## 근거

- 로컬 표본: /private/tmp/pedagogy-pre2-hwpx/browser-exam.hwpx, browser-exam.pdf.
- 실제 한글 PDF3쪽 PNG 전부 시각 대조. 표본의9문항·수식·이미지는 표시됨.
- CLI 로그: /private/tmp/pedagogy-pre2-hwpx-build.log, Python/JS 정합 검사 통과.
- 원문 자료/운영 자료는 사용하지 않았다. 새 요소나 XML 필드를 추측해 삽입하지 않는다.

## 처리 기록

- 2026-10-29 Codex: 실제 한글 PDF에서 재현, confirmed 등록. 독립 검토·수정은 다음.

- 2026-10-29 Codex: native 한글의 전체 쪽수 필드를 직접 저장해 TOTAL_PAGE 확인. JS/Python open_template에서 좁은 셀 구조만 전환. 실제 수정본 PDF1/3·2/3·3/3, 9문항 보존·왕복 재저장/닫기/재열기 PDF3쪽 PNG동일. 정상 parity/RED3·HWPX12·문서 브라우저·정적·회귀175 통과. 최종 독립 검토 진행 중. [근거](../../audits/2026-10-29/prelaunch-print/README.md).

- 2026-10-29 Claude Opus/high 최종 정정 검토: 가드/직렬화 정합/기대값·native 검증 합의, 재현 블로커 없음. 검토 후 가드 보완 생성물의 모든 ZIP 파트가 native검증 표본과 동일함도 확인. [최종 의견](../../audits/2026-10-29/prelaunch-print/claude-total-final.md).
