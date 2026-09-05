# 선지 그림이 문제집 단위 참조 검사에서 빠져 공유 파일이 삭제된다

- ID: `REV-2026-019`
- 날짜: `2026-09-06`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`, `storage`, `tests`
- 관련 인계: `HANDOFF-2026-045`

## 요약과 영향

새 선지 그림은 `blockImageUrls()` 에서는 수집되지만, 문제집 전체의 Storage 주소를 모으는
`storagePathsOf()` 에서는 수집되지 않는다. 이 두 함수가 서로 다른 그림 종류를 알고 있다.

그 결과 두 가지 문제가 생긴다.

1. 복제한 문제집처럼 여러 곳이 같은 선지 그림 주소를 공유할 때 한쪽에서 그림을 지우거나
   블록 종류를 바꾸면, `releaseImage()` 가 다른 문제집의 참조를 보지 못하고 Storage 원본을
   삭제한다. 남은 문제집의 그림 주소는 깨진다.
2. 문제집을 통째로 지울 때는 `deleteSetEverywhere()` 가 `storagePathsOf()` 만 사용하므로
   선지 그림 원본이 Storage 에 고아 파일로 남는다.

## 재현 절차

`index.html` 을 연 실제 브라우저에서 아래와 같은 문제집을 만들어 두 함수를 호출했다.

```js
const url = "https://firebasestorage.googleapis.com/v0/b/demo/o/users%2Fu%2Fimages%2Fa.png?alt=media";
const set = {problems:[{blocks:[{
  type:"choices",
  data:{items:["1","2","3","4","5"], images:[url,"","","",""]}
}]}]};

storagePathsOf(set);                  // []
blockImageUrls(set.problems[0].blocks[0]); // [url]
```

같은 주소를 `sets` 안 다른 문제집의 선지에 둔 뒤 원래 선지에서 `releaseImage(url)` 을
호출하면, 문제집 전체 참조 검사 결과가 거짓이어서 `fbStorage.refFromURL(url).delete()` 로
진행한다.

## 기대 결과 / 실제 결과

- 기대: 문제집 전체 참조 수집기가 정답 그림, 일반 그림 블록, 선지 그림을 모두 모은다.
- 실제: 정답 그림과 `image.data.dataUrl` 만 모으고 `choices.data.images` 는 누락한다.

## 근거

- `index.html` 의 `storagePathsOf()` 는 블록마다 `b.data.dataUrl` 하나만 검사한다.
- 바로 아래 `blockImageUrls()` 는 `image` 와 `choices.data.images` 를 모두 알고 있다.
- `releaseImage()` 와 문제집 전체 삭제 경로는 여전히 `storagePathsOf()` 를 신뢰한다.
- `regression-test.html` 의 새 검사는 `blockImageUrls()` 만 확인하므로 브라우저 회귀
  `114 / 114` 가 통과해도 이 불일치는 잡히지 않는다.

## 검증 기록

- `2026-09-06` — `Codex`: 실제 Chromium에서 위 최소 입력을 실행해
  `storagePathsOf: []`, `blockImageUrls: [url]` 을 확인했다.
- `npm run test:visual`: 7개 기준본 통과, 글줄 삭제 자기검사 통과.
- `regression-test.html`: `114 / 114` 통과. 현재 검사 누락을 함께 확인했다.
- `npm run check:fast`: HWPX 검사는 현재 Python 환경에 `lxml` 이 없어 건너뛰었고,
  나머지 worker·fixture·mock layout·static 검사는 통과했다.


## 처리 기록

- `2026-09-06` — `Claude`: 재현하고 고쳤다. **보고 내용이 그대로 맞다.**

### 독립 재현

보고서의 최소 입력을 실제 Chromium 에서 그대로 돌렸다.

```
선지 그림 — storagePathsOf : []          ← 못 본다
선지 그림 — blockImageUrls : [url]       ← 안다
그림 블록 — storagePathsOf : 1건         ← 이쪽은 정상
```

`storagePathsOf()` 를 믿는 곳이 셋이라 영향도 보고서대로다 —
`stillReferenced()` · `releaseImage()` · `deleteSetEverywhere()`.

### 원인

`HANDOFF-2026-045` 에서 그림 주소를 세는 곳을 한 곳으로 모으려고 `blockImageUrls()` 를
새로 만들었는데, **블록 단위 호출자 둘만 그것으로 옮기고 문제집 단위 수집기
`storagePathsOf()` 는 예전 코드(`b.data.dataUrl` 하나만 보는)를 그대로 두었다.**
"한 곳만 고치면 된다" 는 주석을 그 함수에 달아 두고서 정작 다른 호출자를 연결하지 않은 것이라,
이 저장소의 반복된 실패 ②(한 곳만 고쳤다)에 그대로 해당한다.

### 변경 파일

- `index.html`
  - `storagePathsOf()` 가 블록 쪽을 **`blockImageUrls()` 로 모은다.** 정답 그림은 그대로.
  - `blockImageUrls()` 를 `storagePathsOf()` **위로 옮겼다** — 읽는 순서가 곧 의존 방향이 되게.
  - 두 함수 주석에 이 사고의 경위와 "새 종류는 `blockImageUrls()` 한 곳만" 을 적었다.
- `regression-test.html`
  - 새 검사 「두 그림 수집기가 같은 것을 안다 — 블록 단위 ⊆ 문제집 단위」.
    **블록 수집기가 아는 주소는 하나도 빠짐없이 문제집 수집기에도 있어야 한다**는 성질을 본다.
    그래서 앞으로 그림을 품는 블록이 더 생겨도 같은 사고를 잡는다.
    구조도 함께 못 박는다 — `storagePathsOf` 가 `blockImageUrls` 를 **거쳐** 가는지 본다
    (직접 `b.data.dataUrl` 을 다시 읽기 시작하면 되풀이된다).

### 검증

- **고치기 전 코드로 되돌려 새 검사가 실제로 빨간불**을 내는 것을 확인했다 —
  `블록 3개 중 문제집이 아는 것 1개`.
- 재현 절차 재실행: `storagePathsOf` 가 이제 선지 그림을 포함한다(위 최소 입력 그대로).
- 브라우저 회귀 **115/115** · `npm run check:fast` 통과 · 시각 회귀 **7건** 통과.

### 보고서에서 하나 덧붙임

보고서의 지적 그대로, **블록 단위 검사만 있으면 회귀가 전부 초록불인 채로 지나간다.**
그래서 새 검사는 블록 단위를 한 번 더 확인하는 대신 **두 수집기의 관계**를 본다.
