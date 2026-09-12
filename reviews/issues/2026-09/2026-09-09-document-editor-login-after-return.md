# AI 문서에 들어갔다 나오면 로그인이 안 된다

- ID: `REV-2026-075`
- 날짜: `2026-09-09`
- 보고자: `해리 (실사용)`
- 상태: `open`
- 심각도: `P2`
- 영향 영역: `index | document-editor`
- 관련 인계: `HANDOFF-2026-100`
- 처리 요청: `미정`

## 요약과 영향

`index.html` 에서 AI 문서(`document-editor.html`)로 갔다가 본체로 돌아오면 로그인이
되지 않는다고 보고됐다. 두 화면은 별도 문서이고 각자 Firebase SDK 를 초기화한다.

⚠️ **화면에서 입구를 뺐다고 이 결함이 사라지지 않는다**(`docs/AI-DOCUMENT-SCOPE.md`).
주소로 직접 여는 사람은 여전히 만난다. 그래서 닫지 않고 열어 둔다.

## 좁혀 둔 것 (2026-09-10 · 두 가설이 **틀렸다**)

재현은 아직 못 했지만 **후보를 둘 지웠다.** 지운 것을 적어 두는 편이 다음 사람에게 낫다.

| 가설 | 실측 | 결과 |
|---|---|---|
| **bfcache** — 뒤로가기로 돌아오면 `DOMContentLoaded` 가 다시 안 돌아 `initFirebase()` 가 건너뛰어진다 | `document-editor.html` 로 갔다가 `goBack()` — `navigation.type=back_forward` 확인. 그런데 `fbReady=true`, `window.firebase` 살아 있음, 로그인 단추 정상 | ❌ **아니다** |
| **AI 문서가 인증 저장소를 건드린다** | index → AI 문서 → index 로 오가며 `localStorage` 의 firebase/auth 키와 IndexedDB 목록을 비교 — `firebaseLocalStorageDb` 그대로, 사라진 키 **0개** | ❌ **아니다** |

⚠️ **둘 다 비로그인 상태에서 잰 것이다.** 남은 유력한 조건은 **로그인된 세션**인데,
실제 구글 계정 없이는 만들 수 없다(만들어서도 안 된다).

## 다음 사람에게 (남은 후보)

- 로그인된 상태에서 오갔을 때 `onAuthStateChanged` 가 두 문서에서 어떻게 도는가.
- `document-editor.html` 은 **`getRedirectResult()` 를 부르지 않는다**(index 는 부른다).
  거기서 리디렉션 로그인을 시작했다가 돌아오면 무슨 일이 나는가.
- 인앱 브라우저(카톡 등)에서 오갔을 때. 그쪽은 구글이 WebView 를 막는 것이라 별개일 수 있다.

⚠️ **AI 문서 입구는 화면에서 뺐다**(`HANDOFF-2026-100`). 주소로 직접 여는 사람만 남으므로
노출은 줄었지만 **결함은 그대로다.**

## 아직 재현하지 못했다

보고만 있고 **재현 절차를 확정하지 못했다.** 재현 없이 원인을 적으면 틀린 것이 맞아
보이므로, 아래는 **추측이며 확인 전이다.**

- [추측] 리디렉션 로그인(`signInWithRedirect`)이 두 문서를 오가며 상태를 잃는다.
- [추측] 두 문서가 같은 출처의 인증 저장소를 쓰는데, 한쪽의 `authEpoch`·구독 정리와
  다른 쪽의 초기화가 엇갈린다.
- [추측] 뒤로 가기로 돌아오면 bfcache 에서 되살아난 문서가 SDK 를 다시 초기화하지 않는다.

## 다음 사람에게

1. **재현부터 만든다** — 어느 브라우저에서, 로그인 상태로 갔다 오는지 아닌지,
   뒤로 가기인지 링크 클릭인지, 팝업/리디렉션 중 무엇이었는지.
2. 재현되면 `initFirebase()`·`onAuth`·`authEpoch` 경로와 `document-editor.html` 의
   같은 자리 코드를 함께 본다(두 화면은 **사본**이고 사본은 갈라진다).
3. 고친 뒤에는 두 화면을 오가는 회귀를 남긴다 — 지금 그 경로를 보는 검사가 없다.

## 2026-09-11 후속 검토 (Codex)

별도 재현 가능한 인증 결함 두 건을 수정했다: 문서 CSP의 Firebase popup helper/auth iframe 차단(`REV-2026-086`), App Check 초기화 예외가 Auth도 중단하는 경로(`REV-2026-087`). 문서의 getRedirectResult 오류 처리도 추가했다. SDK 경계를 대체한 Chromium·WebKit·Firefox의 index→document→index, A→B→A 계정 격리는 통과했다.

원래 실계정에서 본체로 돌아온 뒤 로그인이 실패한 신고와 같은 원인인지는 아직 입증되지 않았다. 이 이슈를 추측으로 닫지 않고 `open`으로 유지한다. 실제 계정·iPad/WebView의 popup/redirect 결과가 남은 확인이다.
