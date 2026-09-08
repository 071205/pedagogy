# releaseImage() 무동작화가 '되돌릴 것이 없는' 업로드까지 샌다

- ID: `REV-2026-041`
- 날짜: `2026-09-09`
- 보고자: `Claude`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-066` · 수정 커밋 `ff2b288` · 원 이슈 `REV-2026-034`
- 분석 기준: `ff2b288` (현재 HEAD)

## 요약과 영향

`REV-2026-034`(Undo 로 주소는 살아나는데 파일은 지워짐)의 수정으로 `releaseImage()` 가
**전면 무동작**(`return;`)이 됐다. 방향은 맞다 — 현재 탭만으로 Undo·백업·다른 기기의 참조를
판정할 수 없다. 그런데 호출부 11곳 중 **참조가 생길 수 없는 경로까지** 함께 멈췄다.

`index.html:3984` 는 **업로드 롤백**이다.

```js
const stored=await storeImageFile(f);   // Storage 에 올라갔다
if(blk.type!=="choices" || !Array.isArray(blk.data.images)){
  if(isStorageUrl(stored)) releaseImage(stored);   // 올려 둔 것은 도로 반납
  return false;
}
```

올리는 동안 사용자가 블록 종류를 바꾼 경우다. 이 주소는 **`sets` 에 들어간 적이 없고**,
따라서 Undo 스냅샷에도 백업에도 다른 기기에도 존재할 수 없다. 보존할 참조가 원리적으로
없는데 보존된다 — **실패한 선지 그림 업로드마다 Storage 에 고아가 하나씩 영구히 쌓인다.**

## 재현 절차

로그인 상태에서 선지 그림을 고르고, 업로드가 끝나기 전에 그 블록의 종류를 조건/보기로 바꾼다.
Firebase Storage 콘솔의 `users/{uid}/images` 에 참조되지 않는 파일이 남는다.
(같은 모양의 경로가 `index.html:4143` 의 교체 잔여분에도 있을 수 있으니 함께 볼 것.)

## 기대 결과 / 실제 결과

- 기대: '아직 아무 상태에도 붙지 않은 업로드' 는 즉시 반납한다.
- 실제: 보존 정책이 그 경로까지 덮어 영구히 남는다.

## 근거

`index.html:3025` `releaseImage()` 가 `return;` 이고 호출부는 11곳이다(3031·3036·3055·
3874·3984·3992·4143·4188·4520·4548). 그중 3984 만 **저장 상태에 붙기 전** 경로다.

## 수정 설계

`releaseImage(url, {attached=true})` 처럼 **붙은 적이 있는가**를 호출부가 알려 준다.
`attached:false` 는 즉시 삭제하고, 나머지는 지금처럼 보존한다.
⚠️ 판정 근거를 `sets` 훑기로 되돌리지 말 것 — 그것이 `REV-2026-019` 의 원인이었다.
'붙은 적이 없다' 는 **호출부만 아는 사실**이므로 인자로 받는 것이 맞다.

## 완료 판단에 필요한 검사

업로드 도중 블록 종류를 바꾸는 경로에서 `delete` 가 **불리고**, Undo 복원 경로에서는
**안 불리는** 것을 함께 본다(지금 `check-audit-safety.mjs` 의 `034` 는 뒤쪽만 본다).

## 처리 기록

- 2026-09-09 — Codex / HANDOFF-2026-069: `releaseImage(url,{attached})`로 구분했다.
  기본 attached 경로는 Undo·백업·다른 기기 참조를 위해 보존하며, `putChoiceImage`의
  블록 종류 전환 중 업로드만 `attached:false`로 즉시 Storage delete한다. 실제 함수와
  모의 Storage로 history URL 삭제 0회·orphan URL 삭제 1회를 함께 확인했다.
