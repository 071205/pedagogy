# 수정이 남긴 죽은 코드 셋 — 살아 있어 보여서 위험하다

- ID: `REV-2026-042`
- 날짜: `2026-09-09`
- 보고자: `Claude`
- 상태: `open`
- 심각도: `P2`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-066` · 수정 커밋 `ff2b288`
- 분석 기준: `ff2b288` (현재 HEAD)

## 요약과 영향

`REV-2026-034`·`036` 수정 뒤 **호출자도 효력도 없는데 살아 있어 보이는 것**이 셋 남았다.
셋 다 지금 당장 오작동하지는 않는다. 문제는 **다음 사람이 그것을 믿는다**는 것이다.

### ① `stillReferenced()` — 호출자 0

`index.html:3015`. 유일한 호출자였던 `deleteSetEverywhere` 의 이미지 정리가 사라졌다.
회귀 스위트에 "죽은 코드는 죽은 채로" 를 보는 검사가 있는데 이 함수는 거기 없다.

### ② `maxProblems` / `CLOUD_MAX_PROBLEMS` — 조용히 무시된다

`normSet` 이 `slice(0, keepId?undefined:max)` 가 되면서, `keepId:true` 인 두 호출부
(`docToSet:2488` · `restoreFromBackup:3288`)에서 **`maxProblems` 가 아무 일도 안 한다.**
실증:

```
maxProblems:10 · keepId:true  → 문항 900   ← 무시됨
maxProblems:10 · keepId 없음  → 문항 10
```

`CLOUD_MAX_PROBLEMS=20000` 은 이제 **아무 데도 안 쓰이는 상수**이고, 옆 주석은 그 값이
동작하는 것처럼 설명한다. 의도(자르지 않는다)는 맞지만 **코드가 의도를 두 번 말하고
한 번은 거짓말한다.** 값을 올리거나 내리는 다음 사람은 아무 효과도 못 본다.

### ③ `keepId` 가 두 가지 결정을 겸한다

`keepId` 는 원래 'id 를 살릴 것인가' 였는데, 이제 **'길이·개수 제한을 풀 것인가'** 까지
같은 플래그가 정한다. 서로 다른 질문이다. 언젠가 '남의 파일인데 id 는 살려야 하는' 경로가
생기면(공유 문제집·초대 링크 등) **가져오기 방어선이 조용히 사라진다.**
`CLAUDE.md` 가 `maxProblems` 500 을 "가져오기 전용 방어선" 이라고 못 박아 둔 그 선이다.

그리고 그 플래그의 진리값 처리가 **한 함수 안에서 갈린다** — `normBlock(b, keepId===true)`
는 엄격하고 같은 줄 옆의 `slice(0,keepId?undefined:50)`·`str(v,keepId?Infinity:max)` 는
느슨하다. 실증:

```
keepId=1 → 블록 80개 유지(무제한)  ·  첫 블록 글자수 20000(잘림)
```

한 호출에서 개수는 무제한인데 내용은 잘린다.

## 수정 설계

- ① `stillReferenced()` 는 지우거나, 후속 GC 작업의 자리표시로 남긴다면 그렇게 적는다.
- ② `maxProblems` 를 `keepId` 와 **독립**으로 되돌린다. 자르지 않을 곳은
  `maxProblems:Infinity` 를 **명시**해서 넘긴다 — 그러면 옵션이 다시 말이 되고
  `CLOUD_MAX_PROBLEMS` 도 살거나 깨끗이 사라진다.
- ③ 제한 해제는 `keepId` 가 아니라 **자기 이름의 옵션**으로 뺀다(`lossless:true` 등).
  그리고 세 자리의 진리값 판정을 `=== true` 로 통일한다.

## 완료 판단에 필요한 검사

`normSet(…,{keepId:true, maxProblems:10})` 이 10문항으로 잘리고,
`{keepId:true, lossless:true}` 만 자르지 않는 것. `keepId:1` 이 개수·내용에 **같은** 결정을
내리는 것.
