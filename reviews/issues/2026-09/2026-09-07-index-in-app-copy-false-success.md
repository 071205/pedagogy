# 주소 복사가 거부돼도 인앱 안내가 복사 성공이라고 말한다

- ID: `REV-2026-024`
- 날짜: `2026-09-07`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `index`, `auth`, `tests`
- 관련 인계: `HANDOFF-2026-054`

## 요약과 영향

`openOutsideHint()` 는 `navigator.clipboard.writeText(url)` 이 반환한 Promise를 기다리지
않고 곧바로 "주소를 복사했어요"를 반환한다(`index.html:5872-5877`). Clipboard API가
권한·보안 문맥 등의 이유로 비동기 거부되면 바깥 브라우저로 이동해야 하는 사용자는 실제로
주소를 얻지 못하지만 성공 안내를 받는다. 거부된 Promise도 처리되지 않아 콘솔 오류가 남는다.

## 재현 절차

Chromium에서 `navigator.clipboard.writeText`를 `Promise.reject(new DOMException("denied",
"NotAllowedError"))`를 반환하도록 바꾼 뒤 `openOutsideHint()`를 호출했다.

실제 결과:

```json
{"message":"주소를 복사했어요 · 사파리에 붙여넣어 열어 주세요","rejection":"NotAllowedError"}
```

## 기대 결과 / 실제 결과

- 기대: 복사가 실제로 끝난 뒤 성공을 알린다. 실패하면 사용자가 직접 복사할 주소를 보여 준다.
- 실제: 비동기 실패 전에 성공 문구를 반환하고, 대체 경로를 보여 주지 않는다.

## 수정·검증 기준

- `openOutsideHint()`가 Clipboard Promise를 `await`하고 거부를 처리해야 한다.
- 클릭 처리도 비동기 결과가 확정된 뒤 안내해야 한다.
- Clipboard Promise가 거부되는 회귀 검사를 추가하고, 일부러 거부 처리를 제거했을 때
  빨간불이 되는지 확인한다.

## 처리 기록

- 원인: `navigator.clipboard.writeText()` 가 **Promise 를 준다**는 것을 놓쳤다. 동기
  `try/catch` 는 비동기 거부를 볼 수 없어, 거부가 오기 전에 성공 문구를 돌려주고
  거부는 처리되지 않은 채 남았다.
- 수정: `openOutsideHint()` 를 `async` 로 바꾸고 `await` 한다. 거부되면 **주소를 그대로
  보여 준다** — 사용자가 직접 복사할 수 있게. 클릭 처리도 `await` 뒤에 안내한다.
  `document-editor.html` 에도 같은 함수를 두었다(`REV-2026-026` 과 함께).
- 검증: 회귀에 "주소 복사가 거부되면 성공했다고 말하지 않는다" 를 더했다
  (클립보드를 `NotAllowedError` 로 거부시킨다). **`await` 를 빼서 빨간불을 확인**했다 —
  보고된 문구(`주소를 복사했어요 …`)가 그대로 재현됐다.
  `check:static` 도 두 파일에 `await navigator.clipboard.writeText` 가 있는지 본다.
