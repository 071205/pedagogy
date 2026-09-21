# 문제집 크기 고장 주입 검사가 하네스 실패도 성공으로 판정한다

- ID: `REV-2026-099`
- 날짜: `2026-09-21`
- 보고자: `Codex / GPT-6 Astra high`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-156`

## 요약과 영향

`SETS_SIZE_RED=1` 고장 주입 모드는 크기 방어 assertion 실패뿐 아니라 Chromium 기동 같은
하네스 실패도 성공으로 취급한다. 앱이나 실행 환경이 고장 나 검사가 하나도 실행되지 않아도
"깨보기 OK"와 종료 코드 0을 내므로 회귀 검사의 실패 주입 증거를 잘못 신뢰할 수 있다.

## 재현 절차

다음 명령으로 존재하지 않는 Playwright 브라우저 경로를 지정한다.

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/pedagogy-review-no-browsers SETS_SIZE_RED=1 node scripts/check-sets-cloud-size.mjs
```

## 기대 결과 / 실제 결과

- 기대: Chromium 기동 실패는 하네스 실패로 종료 코드가 0이 아니어야 한다. 정해진 크기 방어
  assertion이 실행되어 실패했을 때만 고장 주입 성공으로 인정해야 한다.
- 실제: 실행 파일 없음으로 검사 0건이 실행됐지만 `깨보기 OK — 방어 없는 33af005 에서 1건 실패`를
  출력하고 종료 코드 0으로 끝난다.

## 근거

- `scripts/check-sets-cloud-size.mjs:149` 부근은 최상위 예외도 `failures`에 넣는다.
- 같은 파일의 `SETS_SIZE_RED` 종료 분기는 실패 종류나 실행된 assertion 수를 구분하지 않고
  `failures.length > 0`만으로 성공 처리한다.
- 정상 환경의 `npm run test:sets-cloud`는 현재 코드 5건 통과와 과거 코드 대상 assertion 2건
  실패를 확인했다. 따라서 정상 고장 주입 결과와 이 하네스 오판은 별개다.

## 처리 기록

- `2026-09-21` — `Codex / GPT-6 Astra high`: 브라우저 실행 파일을 의도적으로 찾지 못하게 해
  검사 0건·종료 코드 0을 재현하고 등록.
- `2026-09-21` — `Codex`: 브라우저·페이지 준비 실패를 assertion 실패와 분리하고, 6건이 전부
  실행된 경우에만 깨보기를 성공 처리하도록 수정했다. 존재하지 않는 브라우저 경로는 이제 exit 1,
  정상 `npm run test:sets-cloud`는 현재 코드 6건 통과와 `33af005` assertion 4건 실패를 확인한다.
- `2026-09-21` — `Codex / GPT-6 Astra high`: 1차 수정에서 `stub()` 같은 fixture 실행 오류가
  여전히 assertion 실패로 집계될 수 있음을 재현했다. 후속 수정은 `ERR_ASSERTION`만 기대된
  깨보기 실패로 집계한다. `SETS_SIZE_HARNESS_RED=1 SETS_SIZE_RED=1`로 fixture 오류를 넣으면
  `FAIL 하네스`와 exit 1이 나오는 것을 확인했다.
