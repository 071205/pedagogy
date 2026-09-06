# 변경 인계 — 범용성 설계 독립 검토와 수정 요청

- ID: `HANDOFF-2026-051`
- 날짜: `2026-09-07`
- 작성자: `Codex`
- 상태: `needs-follow-up`
- 영향 영역: `docs`
- 관련 이슈: `없음` (아직 구현 전 설계 검토)
- 검토 대상: `HANDOFF-2026-050`, `docs/CROSS-PLATFORM-DESIGN.md`

## 결론

**재현 수단부터 만든 뒤 데이터·로그인·터치·화면 순으로 고친다는 큰 방향은 승인한다.**
다만 아래 필수 수정 4건을 설계에 반영하기 전에는 구현을 시작하지 않는 편이 안전하다.
현재 문서에는 표준과 반대인 설명 1건, 지나치게 단정한 설명 2건, 빠진 제품 경계 1건이 있다.

## 구현 전 필수 수정

### 1. §2의 “크롬만 localhost 혼합 콘텐츠를 허용”은 근거로 쓸 수 없다

`http://127.0.0.1`은 Secure Contexts 표준에서 **potentially trustworthy**로 분류되고,
Mixed Content 표준은 potentially trustworthy URL을 혼합 콘텐츠로 보지 않는다. `localhost`도
해당 이름이 반드시 loopback으로 해석되는 구현에서는 신뢰할 수 있다. 따라서 “크롬은 되고
사파리·파이어폭스는 막는다”를 일반 규칙으로 두면 안 된다.

다만 WebKit에는 localhost의 secure-origin/mixed-content 처리가 서로 다르다는 공개 미해결
버그가 있고, 최신 브라우저에는 **Local Network Access/Private Network Access 권한·사전 요청**
이라는 별도 변수가 있다. 이 저장소의 `serve.py`도 이미 PNA 응답 헤더를 처리한다. 설계는
다음처럼 고쳐야 한다.

- 표준상 loopback은 신뢰 URL이지만 브라우저·버전별 구현과 로컬 네트워크 권한은 실측 전 미정.
- 세 엔진에서 `GET /health`와 커스텀 헤더가 붙는 실제 `POST`를 각각 시험한다.
- 실패를 “혼합 콘텐츠” 하나로 뭉개지 말고 mixed content / CORS / PNA permission / server 없음으로
  나눠 기록한다.

근거: [W3C Secure Contexts](https://www.w3.org/TR/secure-contexts/),
[W3C Mixed Content](https://www.w3.org/TR/mixed-content/),
[WebKit localhost 일관성 버그](https://bugs.webkit.org/show_bug.cgi?id=281149).

### 2. §5의 safe-area 설명은 반대다

WebKit은 기본 `viewport-fit=auto`에서 기존 사이트의 콘텐츠를 안전 영역 안으로 자동 배치한다.
`viewport-fit=cover`를 넣으면 화면 끝까지 확장되며, **그때** 중요한 UI에
`env(safe-area-inset-*)` 보정을 해야 한다. 따라서 “`viewport-fit=cover`가 없어서 노치에
가린다”는 현재 설명대로 일괄 추가하면 오히려 가림을 새로 만들 수 있다.

- 먼저 실제 기기/시뮬레이터에서 가림을 재현한다.
- 전체 폭 배경이 꼭 필요할 때만 `cover`를 쓰고, 고정 헤더·하단 버튼 등 중요 UI에
  `max(기존여백, env(...))`를 적용한다.
- `dvh`와 safe-area는 별개 항목으로 검사한다. iOS 26에도 관련 WebKit 회귀가 보고돼 있으므로
  Playwright WebKit 한 번으로 완료 판정하지 않는다.

근거: [WebKit — Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/),
[Apple WWDC21 — Design for Safari 15](https://developer.apple.com/videos/play/wwdc2021/10029/).

### 3. §3의 “7일”과 `pagehide` 역할을 정확히 제한한다

WebKit 문구는 단순히 “7일간 방문하지 않으면”이 아니라 **Safari를 사용한 7일 동안 해당 사이트에
사용자 상호작용이 없으면**이다. 상호작용은 클릭·탭·키 입력이며 스크롤은 제외된다. 홈 화면에
설치한 웹 앱의 first-party 도메인은 이 7일 제한에서 제외된다. 위험 자체는 맞지만 모든 iOS
사용자의 데이터가 일주일 뒤 반드시 지워진다고 표현하면 안 된다.

또한 `pagehide`와 `visibilitychange`도 모바일에서 완전한 종료 보장이 아니다. 현재 코드는 편집할
때 150ms 안에 로컬 저장하고 `visibilitychange=hidden`에서 `flushLocal()`까지 하므로, `pagehide`는
**동기 로컬 저장의 보조 경로**로 추가하는 것이 맞다. 그 이벤트 안에서 비동기 Firestore 저장이
끝난다고 가정하지 않는다. 데이터 안전의 주 수단은 편집 중 잦은 저장, 저장 상태 표시, 로그인,
JSON 내보내기다.

근거: [WebKit Tracking Prevention](https://webkit.org/tracking-prevention/),
[MDN Deferred Fetch 안내](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Deferred_Fetch).

### 4. 로그인·다운로드 범위를 세 앱 전체로 넓힌다

Google이 개발자가 통제하는 embedded user-agent로 OAuth 요청을 보내지 못하게 한다는 전제는
공식 정책으로 확인된다. 그러나 user-agent 문자열만으로 “로그인 가능”을 정확히 판정할 방법은
없다. **UA 감지는 안내를 일찍 보여 주는 힌트**로만 쓰고 로그인 버튼은 남기며, 실제 실패 코드를
잡아 외부 브라우저 열기·주소 복사 안내로 이어져야 한다.

현재 설계는 `index.html`의 팝업/리디렉션만 봤지만 `document-editor.html`도 로그인이 필요하고,
그쪽은 `signInWithPopup()` 예외를 잡지 않는다. 두 화면이 같은 실패 분류와 안내를 써야 한다.

또한 모바일·인앱 브라우저에서는 HWPX를 **만드는 것**과 Blob 파일을 **저장하는 것**이 별개다.
연기 검사는 브라우저 엔진이 ZIP을 만들었다는 데서 끝내지 말고 실제 다운로드 이벤트, 파일명,
크기, 가능하면 Web Share 파일 공유 대안까지 확인해야 한다.

근거: [Google OAuth 2.0 정책](https://developers.google.com/identity/protocols/oauth2/policies),
[Google OAuth 권장사항](https://developers.google.com/identity/protocols/oauth2/resources/best-practices).

## 설계 질문 5개에 대한 답

1. **인앱 브라우저 감지:** 확실한 capability API는 없다. 알려진 UA는 사전 경고용, 실제 인증
   오류는 최종 판정용으로 함께 쓴다. 오탐 시에도 로그인 버튼을 남기는 현재 방침은 맞다.
2. **글꼴 7.6MB:** 화면 폭이나 `saveData`만으로 나누지 말고 **인쇄 의도**가 생길 때 받는 것이
   낫다. 인쇄 메뉴를 열거나 버튼에 pointerdown/focus가 들어올 때 선로드하면 1.2초 대부분을
   선택 과정 뒤로 숨길 수 있다. `navigator.connection`은 모든 브라우저에 있지 않으므로 보조
   조건일 뿐이다. 자체 WOFF2/서브셋은 라이선스와 조판 동일성을 별도 검증한 뒤 결정한다.
3. **모의고사 모바일:** 시험지 캔버스는 A4 비율과 측정값을 유지하고 재배치하지 않는다.
   주변 편집 UI만 반응형으로 만든다. 태블릿은 편집 지원, 휴대폰은 열람·간단 수정부터 지원하는
   단계적 범위가 정직하다. “모바일 대응”과 “시험지 자체를 좁게 재조판”을 섞지 않는다.
4. **연기 검사 판정:** 가로 스크롤·겹침·콘솔 오류 외에 핵심 버튼의 화면 내 위치와 터치 가능성,
   44px 터치 목표, 키보드 표시 뒤 입력칸 가시성, 터치 드래그와 스크롤 충돌, 편집 직후
   visibility/pagehide 저장, CDN 실패 폴백, 느리거나 깨진 그림 인쇄, JSON 가져오기/내보내기,
   HWPX 실제 다운로드를 본다. 모든 요소 교차를 자동 판정하면 의도한 메뉴·모달도 실패하므로
   **핵심 요소 쌍만** 정한다.
5. **빠진 환경:** iOS Safari와 홈 화면 웹 앱, iOS의 Chrome·카카오·네이버 인앱 브라우저,
   Android Chrome·삼성 인터넷·카카오 WebView, Windows Chrome·Edge, Chromebook/관리형 학교
   브라우저, 터치 노트북, 200% 확대·큰 글자, 느린망·오프라인·CDN/Google 차단 환경을 포함한다.

## 1단계 검사 계획에 대한 추가 제한

- Playwright의 desktop WebKit은 **실제 iOS Safari나 카카오 WebView가 아니다.** 세 엔진 연기
  검사는 공통 DOM·CSS·JS 회귀를 잡는 1차선이고, 인증·다운로드·키보드·safe-area 완료 판정에는
  실제 기기 표가 별도로 필요하다.
- SortableJS에 터치 옵션이 없다는 사실만으로 고장이라고 단정하지 않는다. 기본 터치 지원은
  있으므로 실제 touchscreen 컨텍스트에서 스크롤과 드래그 충돌을 재현한 뒤 값을 고른다.
- `:hover` 규칙 개수는 판정 기준이 아니다. 현재 코드에서 실제로 hover에만 숨겨진 후보는
  `.blk-insert-btn`이고, `.q-actions`는 선택·focus 경로도 있다. 기능별로 대체 진입 경로를
  확인한다.

## 다음 작업자에게

먼저 `docs/CROSS-PLATFORM-DESIGN.md`의 §2·§3·§5 문구와 1단계 검사표를 위 내용으로 고친다.
그 뒤에만 세 엔진 연기 검사 구현을 시작한다. 이 검토는 제품 코드를 바꾸지 않았으므로 회귀
검사는 실행하지 않았다.

