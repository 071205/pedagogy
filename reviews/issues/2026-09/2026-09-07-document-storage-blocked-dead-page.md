# 저장소가 막히면 문서 편집기가 통째로 죽는다 (오류 표시도 없다)

- ID: `REV-2026-022`
- 날짜: `2026-09-07`
- 보고자: `Claude`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `document`, `tests`
- 관련 인계: `HANDOFF-2026-050`(설계) · `HANDOFF-2026-051`(검토) · `HANDOFF-2026-052`(반영)

## 요약과 영향

`document-editor.html` 의 `init()` 은 Firebase 만 `try` 로 감싸고, 그 **다음 줄**에서
`localStorage.getItem("PEDAGOGY_DOCUMENT_BETA")` 를 맨몸으로 부른다. `init()` 을 감싸는
`try` 도 없다. 저장소 접근이 던지는 환경(사파리 '모든 쿠키 차단', 일부 사생활 보호 창,
기업·학교의 저장소 차단)에서 예외 하나로 **`init()` 의 나머지가 통째로 실행되지 않는다.**

`parseAndRender()` 도, 네 개 단추의 `onclick` 도 붙지 않는다. **화면은 정상으로 보이는데
아무것도 동작하지 않고 오류 안내도 없다.**

## 재현 절차

1. 저장소 접근이 던지게 만든다(사파리의 '모든 쿠키 차단' 과 같은 상태):
   ```js
   Object.defineProperty(window,'localStorage',{configurable:true,
     get(){throw new DOMException('The operation is insecure.','SecurityError')}});
   ```
2. `document-editor.html` 을 연다.
3. `document.getElementById('validateBtn').onclick` 과 `#json` 의 값을 본다.

## 기대 결과 / 실제 결과

- 기대: 저장을 못 해도 편집기는 동작한다(본체 `index.html` 이 그렇다).
- 실제: `SecurityError` 하나로 핸들러가 붙지 않고 입력칸이 비어 있다.

실측(Chromium · Playwright):

| | 버튼에 핸들러 | 입력칸 |
|---|---|---|
| 문서 편집기 · 저장소 정상 | ✅ | ✅ |
| **문서 편집기 · 저장소 차단** | **❌** | **❌** |
| 본체 · 저장소 정상 | ✅ | — |
| 본체 · 저장소 차단 | ✅ | — |

**본체는 멀쩡하다** — `try/catch` 를 곳곳에 둔 규율이 실제로 값을 했다. 문서 편집기만
그 규율에서 빠져 있었다.

## 처리 기록

- 원인: `init()` 의 `try` 가 Firebase 만 덮고 있었고, 그 뒤 저장소 접근·화면 조립·핸들러
  등록이 전부 보호 밖이었다.
- 수정: 저장소 읽기·쓰기를 `readDraft()`/`writeDraft()` 로 감싸 `try/catch` 를 두고,
  **단추 등록을 저장소 접근보다 앞으로** 옮겼다. 저장소가 막혀도 편집기는 그대로 쓰인다
  (다만 초안이 기억되지 않으므로 그때만 안내를 띄운다).
  ⚠️ **순서가 핵심이다.** `try` 를 씌우기만 하고 순서를 그대로 두면, 다음에 그 앞줄에서
  다른 예외가 나면 같은 사고가 난다. **먼저 동작하게 만들고, 그 다음에 편의 기능을 얹는다.**
- 검증: `scripts/check-cross-platform.mjs` 를 새로 만들어 저장소 정상/차단 두 경우에
  두 앱을 띄우고 **핸들러가 붙었는지**를 본다. `npm run test:cross` 에 걸었다.
  일부러 되돌려 빨간불을 확인했다(아래 인계 참고).
