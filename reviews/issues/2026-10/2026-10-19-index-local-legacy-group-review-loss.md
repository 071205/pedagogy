# 옛 로컬 묶음의 검토 상태가 삭제·무관한 관계 변경으로 사라진다

- ID: `REV-2026-131`
- 날짜: `2026-10-19`
- 보고자: `Codex 독립 데이터 검토 에이전트 · 부모 재현 확인`
- 상태: `confirmed`
- 심각도: `P2`
- 영향 영역: `index | tests`
- 관련 인계: `HANDOFF-2026-194`
- 검토 기준: `877a8e7..cd24e61` (PR #23)

## 요약과 영향

실제 로컬 부팅의 `readLocalSets()`/`loadSetsLocal()`은 JSON을 그대로 채택한다. 옛 위치 묶음은
`groupOf`/`groupReview` 없이 남는데, 새 관계 API의 `syncGroupSpans()`가 모든 비명시 문항의
`groupSpan`을 1로 덮는다. 기존 묶음의 불확실성이 사용자의 명시 재구성 없이 사라져 출력이 허용된다.
본문 문자열은 남지만 관계 정보와 검토 경고가 조용히 사라지는 결함이다. 별도 ② Rules 게이트와 무관하게 로컬에서 재현된다.

## 재현 절차

합성 자료·격리 localhost·외부 요청 차단 Chromium에서 실제 부팅/삭제 UI를 실행했다.

1. 부팅 전에 `PM_SETS_V7:guest`에 다음 배열을 가진 권을 기록한다.
   `P1(passage, groupSpan:3), P2, P3, Q4`. `groupOf`/`groupReview`는 없는 옛 자료다.
2. 실제 부팅이 끝난 뒤 권을 연다. `groupDiagnostics()`는 ‘소속 없는 옛 묶음’을 반환하고 `buildPrintDoc()`은 차단한다.
3. 목록에서 **P2의 실제 삭제 단추**를 누른다.
4. P1의 값과 진단·실제 조판 허용 여부를 확인한다.

- 기대: 옛 관계의 검토 필요 상태가 보존되어, 사용자가 명시 재구성하기 전에는 출력하지 않는다.
- 실제: `P1.groupSpan=1`, `groupOf/groupReview` 없음, 남은 ID `p1,p3,q4`, 진단 `[]`, 조판 허용.
- 추가 재현: 같은 옛 배열에서 무관한 Q4에 `setGroupSpan(arr,'q4',1)`만 호출해도 P1의 경고가 사라진다.

로컬 재현: `/private/tmp/rev108-review-2026-10-19/local-legacy-ui.cjs`와 `local-legacy-loss.cjs`.
부모 재실행 로그: `parent-legacy.log` (같은 디렉터리, 실제 UI 재현 exit 0).
다른 체크아웃에서 아래 경계 재현은 마지막 단언이 **현재 head에서 실패**한다.

```sh
node --input-type=commonjs <<'NODE'
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('pedagogy-normalize.js', 'utf8'), context);
const N = context.PedagogyNormalize;
const arr = [
  {id:'p1', groupSpan:3, blocks:[{type:'passage', data:{parts:[{text:'합성 지문'}]}}]},
  {id:'p2', blocks:[]}, {id:'p3', blocks:[]}, {id:'q4', blocks:[]}
];
assert.ok(N.groupDiagnostics(arr).length > 0);
N.removeGroupedProblem(arr, 1);
assert.ok(N.groupDiagnostics(arr).length > 0, '명시 재구성 없이 옛 관계 경고가 사라졌다');
NODE
```

## 근거와 수정 시 확인할 경계

- `index.html:3379` 로컬 로드의 JSON 직접 채택 → `index.html:7503` 삭제의 새 공통 API 호출.
- `pedagogy-normalize.js:464–469`가 명시 소속 없는 모든 문항을 1로 초기화한다.
- 현재 새 회귀는 주로 `normSet()`으로 만든 fixture여서 실제 옛 로컬 부팅 경로를 놓쳤다.
- 로컬/pending 저장본을 손실 없이 이관하고, 관계 갱신이 옛/손상된 불확실성을 지우지 않게 한다.
  실제 부팅 후 삭제·무관한 묶음 변경과 경고/출력 차단 보존을 회귀·RED로 확인해야 한다.

## 처리 기록

- `2026-10-19` — 독립 Codex 검토자가 순수 함수와 실제 Chromium 부팅/삭제 단추로 재현.
  부모가 동일 head의 실제 UI probe를 재실행해 확인. 기능 수정 없음, PR 승인 보류.
