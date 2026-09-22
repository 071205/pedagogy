# R4.5 첫 묶음 — 선지 넘침 사다리 구현

- ID: `HANDOFF-2026-163`
- 날짜: `2026-09-22`
- 작성: `Claude / Sonnet 5`
- 검토: **대기 — Codex Sol medium**(비구현자 검토 계약)
- 커밋 전 단계. 코드: `index.html`. 검사: `tests/regression-test.html`.

## 한 일

레일 지시(`RAIL-ORDERS.md` ③)와 `REV-2026-104` 명세대로 `fitPrintDoc()` 의 선지 넘침
보정을 고쳤다. **저장 데이터·미리보기는 건드리지 않았다** — 일회용 `#printDoc` 복제본의
배치 클래스만 바꾼다.

- **판정**: `.choices` 컨테이너 rect → `.choice:not(.choice--img) .text` 의
  `scrollWidth-clientWidth>2`.
- **완화**: 폐지된 `choices--wrap`(늘 2열과 같은 높이) 대신 **사다리**
  `horizontal→cols3→cols2→vertical`. 저장된 배치가 출발점이고 **열은 줄이기만 한다.**
  `paired`·그림 선지는 사다리에서 뺐다(구조가 다르고 넘침도 재현되지 않았다).
- **단계별 읽기·쓰기 분리**: 사다리 각 단(`for(rung...)`)이 그 단의 모든 블록을 먼저
  읽고 나서 한꺼번에 클래스를 바꾼다. 블록 하나를 사다리 끝까지 끌고 내려가지 않는다.
- **(1-b) 개별 축소**도 측정 대상을 `.choice`→`.text` 로 바꿨다(같은 원인으로 죽어 있었다
  — `.text{overflow-x:hidden}` 때문에 `.choice` 의 scrollWidth 는 늘 clientWidth 와 같았다).
- `choices--wrap` 클래스를 JS·CSS 양쪽에서 지웠다.
- ⚠️ 인라인 스크립트를 고쳐 CSP 해시가 깨졌다 — `test:public` 이 잡아 즉시 갱신했다
  (`sha256-HCTn933keHIRFT8eMGN2I3MMoIcfwSo0jUo/k4M/w0Q=`).

## 검증

실측(브라우저·실제 인쇄 경로): 긴 수식 선지 5열 잘림 **50→0**, `choices--wrap` 잔존
**0**, 3열로 충분한 표본 10개 중 **0개**가 2열로 내려감, 사용자가 고른 `cols2` **3개**
전부 유지(승격 0), 배치 클래스 중복 **0**, 300문항 `fitPrintDoc` **32.2ms**.

`tests/regression-test.html` 에 검사 4개 추가(`test:audit-browser` 158→**162** 통과).
이슈 파일의 §검사 5·6(깨보기)은 원 이슈 실측표(옛 판정 50→50·0건)로 이미 재현돼 있어
검사 파일에 옛 로직을 다시 베끼지 않고 **전제 가드**로 대신했다(사본이 갈라지는 것을
피하려는 선택 — 근거는 이슈 파일 §수정에 있다).

`check:fast` 전체 실행, **내 diff 로 인한 새 실패 0건**. `test:worker` 의
`setWriteBaseEntryFromDoc is not defined` 는 `git stash` 로 **B3 커밋(`de546a8`)에 이미
있던 것**임을 확인했다 — CAS 코드 영역이라 B3 독립 검토 몫이고 손대지 않았다.

## 다음

1. **Codex Sol medium** 이 이 diff(`index.html` 의 `fitPrintDoc`·선지 CSS,
   `tests/regression-test.html` 검사 4개)만 독립 검토한다.
2. 승인되면 **R4.5 둘째 묶음**(`⋮`·`…` 단독행 가운데 정렬 · [`RAIL-ORDERS.md`](../../../docs/RAIL-ORDERS.md) ④)로 간다 — **다른 커밋**이다.
3. `test:worker` 의 기존 실패(`setWriteBaseEntryFromDoc`)는 B3 독립 검토가 다룰 것 —
   이 인계는 그 상태를 그대로 남긴다.
