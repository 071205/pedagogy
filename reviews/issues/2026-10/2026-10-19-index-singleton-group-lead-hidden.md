# 묶음이 한 문항으로 줄면 공유 안내문이 미리보기·출력에서 사라진다

- ID: `REV-2026-132`
- 날짜: `2026-10-19`
- 보고자: `Codex 독립 편집·출력 검토 에이전트 · 부모 재현 확인`
- 상태: `confirmed`
- 심각도: `P2`
- 영향 영역: `index | tests`
- 관련 인계: `HANDOFF-2026-194`
- 검토 기준: `877a8e7..cd24e61` (PR #23)

## 요약과 영향

안내만 공유하는 정상 2문항 묶음에서 마지막 구성원을 삭제하면 대표가 1문항 묶음으로 남는다.
새 `computeNums()`는 범위를 반환하지 않고 기존 `groupHeadHTML()`은 빈 범위의 안내를 그리지 않는다.
안내문은 데이터에 남지만 미리보기·실제 조판에서 누락되며 진단도 없다. 편집 입력도 숨겨져 조용히 틀린 출력이 된다.

## 재현 절차

격리 localhost·외부 요청 차단 Chromium에서 합성 권을 만들고 실제 삭제 단추를 사용했다.

1. A의 `groupLead='다음을 듣고 물음에 답하시오.'`, 본문 ‘첫 문항’, B, 무관한 C를 둔다.
2. 기존 선택 UI/공통 API로 A~B를 2문항 묶음으로 정한다.
3. 미리보기의 `[01~02] 다음을 듣고 물음에 답하시오.첫 문항`을 확인한다.
4. 목록의 **B 삭제 단추**를 누른다. 미리보기와 `buildPrintDoc()`의 DOM을 확인한다.

- 기대: 1문항으로 줄어도 남은 문항에 필요한 안내를 보존해 표시하거나, 명시 정리 전까지 진단/차단한다.
- 실제: A의 `groupOf='a'`, `groupSpan=1`, 안내 문자열은 그대로인데 `range=''`, 진단 `[]`.
  미리보기는 ‘첫 문항’만 남고 실제 조판에도 안내가 없다. `#qGroupLead.style.display='none'`이다.

재현: `node /private/tmp/rev108-review-2026-10-19/print-probe.mjs`.
부모 독립 재실행: `parent-print.log` (같은 디렉터리, exit 0). `SINGLETON` 결과로 위 값을 확인했다.
아래 저장소 루트의 순수 렌더 경계 재현은 마지막 단언이 **현재 head에서 실패**한다.

```sh
node --input-type=commonjs <<'NODE'
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const context = vm.createContext({});
for (const file of ['pedagogy-normalize.js','pedagogy-render.js','pedagogy-print.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const N = context.PedagogyNormalize, P = context.PedagogyPrint, R = context.PedagogyRender;
const s = N.normSet({problems:[{id:'a',groupLead:'합성 안내'}, {id:'b'}, {id:'c'}]}, {keepId:true});
N.setGroupSpan(s.problems, 'a', 2);
N.removeGroupedProblem(s.problems, 1);
const range = P.computeNums(s.problems)[0].range || '';
assert.ok(R.groupHeadHTML(s.problems[0], range).includes('합성 안내'), '안내가 출력에서 빠졌다');
NODE
```

## 근거와 수정 시 확인할 경계

- `index.html:7503`의 구성원 삭제 → `syncGroupSpans()`로 대표의 파생 크기가 1이 된다.
- `pedagogy-print.js:91`은 구성원 1개인 묶음의 범위를 생략한다.
- 기존 `pedagogy-render.js:348`은 범위가 비면 안내도 생략하며, `index.html` 편집 UI도 `span>1`에만 안내 칸을 보인다.
- 정상 2→1 삭제·명시 1문항·지문 없는 안내 전용 묶음의 미리보기/실제 출력과 편집 가능성을 회귀·RED로 확인해야 한다.

## 처리 기록

- `2026-10-19` — 독립 Codex 검토자가 실제 Chromium 삭제 단추로 재현.
  부모가 동일 head에서 probe를 재실행해 미리보기/실제 조판의 안내 누락과 진단 부재를 확인. 기능 수정 없음, PR 승인 보류.
