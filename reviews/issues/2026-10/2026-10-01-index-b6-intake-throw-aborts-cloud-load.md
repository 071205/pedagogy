# 문항 하나의 `intake` 가 정규화에 실패하면 클라우드 라이브러리 전체 읽기가 실패로 떨어진다

- ID: `REV-2026-112`
- 날짜: `2026-10-01`
- 보고자: `Claude / Opus 5.5` (HANDOFF-173 독립 검토)
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-173`

## 요약과 영향

`normIntake()`(`pedagogy-normalize.js`)는 지원하지 않는 버전·형식에 **예외를 던지고**, `normProblem()` 이 그것을
그대로 전파한다. 그래서 문항 **하나**의 `intake` 가 `normSet()` 전체를 멈춘다. 예전 정규화는 모르는 값을 버렸지
던지지 않았다(신뢰 경계 규칙).

- 클라우드 첫 읽기: `loadSets()` → `mergeSets*()` → `docToSet()` 이 던져 **모든 문제집**이 로컬 폴백으로 떨어지고
  "클라우드에 연결하지 못했어요" 라는 **사실이 아닌** 안내가 뜬다. 새 기기면 로컬이 비어 '새 문제집' 하나만 보인다.
  이후 `watchCloud()` 는 그 문서만 조용히 건너뛰므로(`intakeMalformed`) 그 문제집은 **설명 없이 안 보인다**.
- 같은 이유로 JSON 가져오기(파일 전체 "JSON을 읽을 수 없어요")·백업 되돌리기(`b.sets.map(normSet)`)·
  `setJSON()`/`setToDoc()`(→ `setProblemsForSync`)도 한 문항 때문에 통째로 실패한다.
- 계기: 이후 버전이 `intake.version:2` 를 쓰고 이 버전 탭/기기가 그것을 읽을 때, 손으로 고친 JSON, 손상 문서.
  지금 B6 자체가 만드는 값은 통과하므로 **현재 운영 사용자에게는 아직 안 터진다.**

## 재현 절차

1. Node: `normSet({id:'s',problems:[{id:'p',blocks:[…]},{id:'q',blocks:[…],intake:{version:2,sources:[]}}]})`
   → `THROW: 지원하지 않는 intake 버전 · 업데이트 필요`. `sources:[{sourceId:'not-a-uuid',pages:[1]}]` 도 던진다.
2. 브라우저(`serve.py`, 외부 요청 차단, `fbDb` stub): 서버 확정 snapshot 에 문제집 세 개를 두고 `loadSets()`.
   - 정상: `sets` = `첫째·둘째·셋째`, 토스트 없음.
   - 둘째의 문항 하나에만 `intake:{version:2,sources:[]}`: `sets` = `["새 문제집"]`,
     토스트 `"클라우드에 연결하지 못했어요 · 이 기기 데이터로 계속합니다"`.
   (재현 스크립트는 검토 세션 scratchpad 의 `b6-intake-throw.mjs` — 저장소에 넣지 않았다.)

## 제안

계약 U0 §3 "새 메타데이터를 읽지 못하는 경로의 저장 차단/업데이트 방안" 의 **차단 범위를 그 문항(또는 그 문제집)으로**
좁힌다. 예: 모르는 버전의 `intake` 는 원문 그대로 보존하고 그 문제집을 '업데이트 필요 · 읽기 전용'으로 표시하며
저장을 막는다(덮어써서 지우지 않게). 다른 문제집 읽기·가져오기·백업은 계속한다. 회귀: 위 2번을 검사로 넣고,
`setJSON`·가져오기·백업 되돌리기도 한 문항 손상으로 전체가 멈추지 않는지 본다.

## 처리 기록

2026-10-03 · Codex · `resolved` (독립 재검토 대기, [HANDOFF-174](../../handoffs/2026-10/2026-10-03-index-b6-review-fixes.md)).
`normProblem`에서 strict 오류가 전파되던 원인을 `preserveIntake`로 격리했다. 불명/손상 intake는 그대로
보존하고 해당 권을 업데이트 필요·읽기 전용으로 표시한다. 일반 cloud 저장과 직접 CAS는 이를 제외/거절한다.
정상 로컬 초안으로 불명 원격본을 덮는 경우도 차단한다. 계정 파기는 명시 tombstone 예외다.

재현 검사는 `scripts/check-intake-review-fixes.mjs`의 112 항목이다. Node에서 version:2·잘못된 sourceId,
server ACK 3권 첫 읽기/구독, setJSON/setToDoc/내보내기, 실제 JSON 파일 입력과 백업 복원까지 통과했다.
정상 권 저장·대상 권 편집/쓰기 차단도 확인했다. `B6_REVIEW_RED=112`로 수정 전 `eb7e69f` 파일을
주입하면 첫 읽기가 새 문제집으로 떨어져 해당 검사가 실제 실패한다. strict `normIntake`는 유지했다.
필수 regression-test.html 167/167 및 기존 저장 회귀 통과. 로그와 경계는 HANDOFF-174를 참조한다.
- `2026-10-03` — `Claude / Opus 5.5`: **보고자 재검증 통과.** 원래 재현 절차를 `59a7503` 에서 다시 돌려 기대대로 동작함을 확인했다(HANDOFF-174 검토 기록). 단 이 수정이 만든 쓰기 쪽 경로는 `REV-2026-114` 로 따로 등록했다.
