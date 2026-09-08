# REV-032 의 검사가 제품이 아니라 검사 자신의 사본을 본다

- ID: `REV-2026-040`
- 날짜: `2026-09-09`
- 보고자: `Claude`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-066` · 수정 커밋 `ff2b288`
- 분석 기준: `ff2b288` (현재 HEAD)

## 요약과 영향

`REV-2026-032`(계정 전환 시 늦은 응답 폐기)의 **수정은 맞는데 그 수정을 지키는 검사가 없다.**
`scripts/check-audit-safety.mjs` 가 `sessionContext`·`sessionMatches` 를 **문자열로 다시 적어**
모든 fixture context 에 붙이기 때문에, 검사는 제품의 가드가 아니라 **자기 사본**을 실행한다.

제품에서 그 가드가 사라져도 검사는 계속 초록불이다. 이 저장소가 여러 번 겪은
"항상 통과하는 검사" 이고, 하필 **P1 결함 하나가 통째로 그 위에 얹혀 있다.**

## 재현 절차

```bash
# 1) 가드를 무력화한다
perl -0pi -e 's/const sessionMatches=c=>.*/const sessionMatches=c=>true;/' index.html
node scripts/check-audit-safety.mjs      # → pass 9 / fail 0

# 2) 아예 지운다
perl -0pi -e 's/^const sessionContext=.*\nconst sessionMatches=.*\n//m' index.html
grep -c "const sessionMatches" index.html # → 0
node scripts/check-audit-safety.mjs      # → pass 9 / fail 0
git checkout index.html
```

## 기대 결과 / 실제 결과

- 기대: 제품의 `sessionMatches` 가 무너지면 `032` 검사 두 개가 빨간불이 된다.
- 실제: 제품에서 두 줄을 **통째로 지워도 9/9 통과**한다.

## 근거

`scripts/check-audit-safety.mjs:12-14` 의 `const session = \`let authEpoch=0; …\`` 와
`context()` 가 그 문자열을 `code` 뒤에 이어 붙인다(15-16행). `fn('loadSets')` 로 떠 온
제품 함수가 참조하는 `sessionMatches` 는 이 사본으로 해석된다.

⚠️ 같은 파일의 다른 검사는 이 문제가 없다. 나머지 여덟은 직접 깨보기로 빨간불을 확인했다 —
`031`(DELETE→purge 복원) · `033`(전송본 대신 살아 있는 참조) · `034`(releaseImage 가 다시
삭제) · `036`(keepId 여도 자르기) · `037`(스트림 상한 제거) · `038`(실패 시 dirty 해제).
**`032` 만 어떻게 깨도 빨간불이 안 난다.**

## 수정 설계

`sessionContext`·`sessionMatches` 도 `fn()` 처럼 **제품에서 떼어 내 실행**한다.
`index.html` 이 그 둘을 `const` 화살표 함수로 두고 있어 `fn()`(=`function 이름(`) 으로는 못
집는다 — 이름으로 한 줄을 떠 오는 추출기를 하나 더 두거나, 제품 쪽을 `function` 선언으로
바꾼다(후자가 `check-static` 의 다른 추출기들과도 결이 맞는다).

⚠️ 사본을 남긴 채 "제품과 같은지" 를 문자열로 대조하는 방식은 쓰지 말 것 —
`REV-2026-026` 에서 목록은 같은데 **동작이 달라** 못 잡은 전례가 있다. 떼어 내 **실행**해야 한다.

## 완료 판단에 필요한 검사

위 재현의 1)·2) 두 가지 깨보기에서 `032` 검사가 **빨간불**이 되고, 되돌리면 초록불일 것.

## 처리 기록

- 2026-09-09 — Codex / HANDOFF-2026-069: `sessionContext`·`sessionMatches`를 제품의
  `function` 선언으로 바꾸고 안전 검사도 `fn()`으로 실제 소스에서 추출해 실행하도록 바꿨다.
  임시 사본에서 제품 `sessionMatches`를 항상 true로 바꾸면 A→B/A→B→A 두 검사가
  `writes.length: 1 !== 0`으로 실패했다. 원상태에서는 두 경우를 포함한 11개 안전 검사가 통과했다.
