# R8 PDF 감사의 기존 원문 참조 보존 단언이 빈 배열에서 공허하게 통과한다

- ID: `REV-2026-151`
- 날짜: `2026-10-23`
- 보고자: `독립 Codex /root/r8_edit_print_review`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-200`

## 요약과 영향

새 R8 PDF 감사가 priorRefsPreserved=true를 기록했지만, 실제 선택 문항 q2에는 기존
원문 참조가 없었다. 다른 원문 참조를 지우는 회귀를 검출한다는 주장은 검증되지 않았다.
앱 저장 오류를 재현한 이슈가 아니라 검사 범위/증거의 결함이다.

## 재현 절차

1. 합성 원본 q1에만 PNG 참조를 연결한 기존 구성 여정을 시작한다.
2. 수동 다섯째 권으로 q1을 옮긴 뒤 첫 결과 권(q2)을 연다.
3. 새 PDF 감사의 before.refs가 빈 배열임을 확인한다.
4. 기존 참조 보존 비교는 새 PDF 참조 하나만 비교하므로 다른 참조 제거를 검출하지 못한다.

## 기대 결과 / 실제 결과

- 기대: 비교 전에 비어 있지 않은 기존 참조를 보장하고 다른 참조를 지우면 실패한다.
- 실제: 빈 before.refs에도 정상 JSON이 priorRefsPreserved=true를 기록했다.

## 근거

`r8-pdf-source.mjs`의 before.refs/actual.refs 비교와 기존 seed q1 참조·다섯째 권 이동.
coverage guard만 추가한 수정 전 probe는 exit1, 실패 문구
`PDF prior-reference coverage requires existing source ref`였다.
로그: `/private/tmp/r8-source-pdf-rev151-before.log`.

## 처리 기록

- 2026-10-23 — 구현자: 실제 수동 UI로 기존 PNG를 연결·쪽 지정하고 refs.length>0을
  단언하도록 수정 중이다. 앱의 others 보존을 제거하는 HTML 변이/CSP 재해시로
  새 검사 RED도 확인한다. 정상/RED·독립 재검증 전 해결로 표시하지 않는다.

- 2026-10-23 — 해결: 실제 filechooser로 브라우저가 만든 16×16 PNG를 먼저 연결하고
  1쪽 지정 후 비어 있지 않은 refs를 단언한다. PDF 추가 뒤와 재로드 뒤에 기존 PNG와
  PDF 2쪽 참조 전체를 심층 비교한다. 복수 원문 선택자는 표시 완료를 기다린다.
- 정상 source-only와 edit-print 결합은 각각 세 화면 크기 모두 complete=true/exit0,
  priorRefCount=1이다. 기본 모드 대조도 세 크기 complete=true/exit0이다.
- 격리 HTML의 assignSourcePage에서 다른 원문 참조 보존만 제거한 RED는
  `PDF assignment preserves prior source refs`에서 exit1이다. Blob 유실과 빈 canvas
  RED도 각각 `PDF source Blob retained after reload`, `PDF page 2 actual raster pixels`
  단언에서 exit1이다. 정상/RED JSON은 같은 날짜 감사 폴더의 r8-source-pdf-*에 보존한다.
- 독립 Codex(`/root/r8_edit_print_review`, GPT-6 Sol / medium)가 수정 코드와 모든 결과를
  직접 대조해 합의·미합의 없음으로 재판정했다. 구현자 판정과 구별하며 Claude 승인이 아니다.
  범위는 오프라인 Chromium 수동 PDF 연결이며 AI 추출·실계정 ACK·실기기 검증은 아니다.
