# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 지금 어디까지 왔나 (2026-09-03)

세 갈래가 동시에 살아 있다. 새 세션이면 **관련된 갈래의 인계 기록부터** 읽는 것이 빠르다
([`reviews/INDEX.md`](reviews/INDEX.md)).

| 갈래 | 상태 |
|---|---|
| **문제집 편집기**(`index.html`) | 안정. **지금 하는 일 = 영어 과목**(아래). 상용 준비는 `docs/COMMERCIAL-LAUNCH.md` |
| **모의고사 → 한글**(`mock_to_hwpx.py`) | 동작. 30문항·선택과목 검증 완료. **실물 조판 6단계 완료** |
| **모의고사 라이브러리**(`mock-library-store.js`) | 동작. 여러 부를 카드로 관리 + 클라우드 동기화(**2026-09-09 Rules 배포 · `mockCloudSchema`=1**). 설계는 `docs/MOCK-LIBRARY-DESIGN.md` |
| **범용 문서 → 한글**(`document_to_hwpx.py`) | 베타. 블록 11종. 실물 한글로 확인 완료. **브라우저만으로도 된다**(아래) |

### ▶ 다음에 할 일 — 영어 과목

[`docs/ENGLISH-SUBJECT-DESIGN.md`](docs/ENGLISH-SUBJECT-DESIGN.md) **부터 읽는다.**
영어는 블록 메뉴에만 있고 조판은 국어 규칙을 쓰고 있었다. 실물(`평가원 영어 양식.hwp`)이
들어와 아홉 가지를 고쳤다(테두리·각주·선지 배치·문단 들여쓰기·순서 문항 (A)(B)(C) 라벨·
듣기 답란·지문 없는 묶음 안내·안내문 상자·**표 문항**). **전부 끝났다**(② 는 `-103`).
⚠️ ⑦ 표 문항은 `HANDOFF-2026-038` 이 적어 뒀는데 설계 문서 목록으로 **옮겨지지 않아
조용히 빠져 있었다.** 인계의 '다음' 목록은 설계 문서로 옮겨야 산다.
⚠️ **실물은 굵게가 아니라 글꼴 갈래(명조↔고딕)로 강조를 가른다** — 말한이·묶음 안내를
그렇게 고쳤다(그 문서 §6). 새 요소를 조판할 때 `font-weight` 부터 올리지 말 것.
⚠️ **② 는 끝났고, 그 과정에서 설계의 가정이 틀린 것으로 드러났다**(`HANDOFF-2026-103`).
   2009 수능 영어를 재 보니 네모는 **세로 2단이 아니라 한 줄**(여섯 개 전부 5.2mm)이라
   우리 `[[a / b]]` 가 이미 실물과 같았다. **진짜 빠진 것은 '열 머리글이 있는 짝 선지'**
   (`layout:"paired"`)였고 그것을 만들었다 — 칸은 `|` 로 가르고 `……`·`(A)(B)(C)` 는
   렌더가 붙인다. ⚠️ `cols2`(선지 다섯을 두 열로 접기)와 **다른 것**이다.

### 이 컴퓨터에만 있는 자료 (저작물 — 저장소에 없다)

`.gitignore` 가 막고 있다. **없으면 관련 검사가 `⏭` 로 건너뛰고**, 실물 대조가 필요한
작업은 시작할 수 없다.

| 파일 | 무엇에 쓰나 |
|---|---|
| `평가원 수학 양식.hwpx` | 모의고사 HWPX 의 **틀**. 없으면 `test_structure`·`test_sections`·`test_page_layout`·`test_style_roles` 가 ⏭ |
| `평가원 영어 양식.hwp` | 영어 과목 조판의 근거(`docs/ENGLISH-SUBJECT-DESIGN.md`) |
| `평가원 국어 양식.pdf` | 국어 지문 조판의 근거 |
| `2025학년도 수능 수학 문제.hwp` | 틀이 없을 때 값만 읽는 대비 경로 |

⚠️ 실물에서 값을 잴 때는 한글로 PDF 를 뽑아 `PyMuPDF` 로 좌표를 읽었다
(`파일 → PDF로 저장하기` 를 `System Events` 로 누른다 — 단축키는 이 앱에 안 먹는다).
⚠️ **한글이 파일을 아예 못 여는 상태**(창 0개인데 메뉴는 살아 있다)에 빠지면 그 길이 막힌다 —
재시작해도 낫지 않았다. 그때는 **`.hwp` 를 직접 읽는다**: `olefile` 로 열어
`zlib.decompress(…, -15)` 로 풀고 `PARA_SHAPE`(들여쓰기)·`PARA_LINE_SEG`(조판된 줄의 실제 x)를
읽으면 PDF 보다 정확하다. 태그 번호와 **단위가 2배 다른 함정**은
[`docs/ENGLISH-SUBJECT-DESIGN.md`](docs/ENGLISH-SUBJECT-DESIGN.md) §5 에 적어 두었다.

**바로 해 볼 수 있는 것**

```bash
python3 serve.py --open                      # 편집기 (상단 'AI 문서' 링크)
python3 experiments/hwp-export/document_to_hwpx.py \
        experiments/hwp-export/samples/document-sample.json 결과.hwpx
```

**실물 조판 계획은 끝났다** — [`docs/MOCK-STYLE-DESIGN.md`](docs/MOCK-STYLE-DESIGN.md)
의 6단계를 모두 마쳤다(수식 앞 공백 · 그림 문단 모양 · 구획 태그 · 조건 상자 안 별행
수식 · ※ 확인 사항 · 역할 표 대조 검사).
⚠️ **조판 값은 이제 [`scripts/exam-style-roles.mjs`](scripts/exam-style-roles.mjs) 가
정답표다.** 역할 이름·상자 폭·탭 위치 같은 값을 고칠 때는 거기부터 본다 — 코드만 고치면
`check:static` 이 빨간불을 낸다. 표가 실물과 같은지는 `test_style_roles.py` 가 본다
(실물 틀이 있어야 하므로 CI 에서는 ⏭).

**열린 이슈 없음.**

▶ **범용성 작업 — 여섯 단계 모두 완료**([`docs/CROSS-PLATFORM-DESIGN.md`](docs/CROSS-PLATFORM-DESIGN.md)).
남은 것은 **코드로 답할 수 없는 제품 결정**이다 — 모의고사 편집기를 지인·상용 사용자에게
열 것인가(윈도우 사용자는 `python3 serve.py` 를 따라 할 수 없다), 시험지 HWPX 와 AI 문서의
**위상 차이**를 UI 에서 더 분명히 할 것인가(`HANDOFF-2026-059` 끝부분).

⚠️ **배포본(https)에서 `http://127.0.0.1` 부르기 — 실측(세 엔진)**: 크로미움·파이어폭스는
**된다**, **WebKit 만 막는다.** 표준상 loopback 은 신뢰 URL 이라 혼합 콘텐츠가 원인이
아니다. ⚠️ 게다가 WebKit 은 **살아 있는 서버와 죽은 포트가 똑같이 `Load failed`·0ms** 라
페이지 안에서 '막힘' 과 '서버 없음' 을 **가를 수 없다** — 그래서 안내는 두 가능성을
**함께** 말하고 UA 는 순서만 정한다. `test:cross` 가 그 문구까지 본다.
([`docs/CROSS-PLATFORM-DESIGN.md`](docs/CROSS-PLATFORM-DESIGN.md) · `-050` → 검토 `-051`(Codex)
→ 반영 `-052` → 1단계 `-053`).

**`npm run test:cross`** 가 chromium·webkit·firefox × 데스크톱·태블릿·휴대폰으로
가져오기 → 편집 → 인쇄본 조립을 돌린다(`check:fast` 에는 크로미움만 = `test:cross:fast`).
⚠️ **자기검사가 검사 안에 들어 있다** — 화면에 고장을 심고 대응 항목이 빨간불이 되는지
스스로 본다(7개). 항목을 더하면 `BREAKS` 에도 함께 더할 것.
⚠️ **CI 는 브라우저 설치를 `check:fast` 앞에 둔다.** 뒤에 두면 건너뛰기만 하고 아무것도
검사하지 않는다.
⚠️ **선택적 CDN 라이브러리는 있는지 확인하고 쓴다** — `renderEditor()` 가 `new Sortable()`
을 맨몸으로 불러 CDN 차단 망에서 **편집기가 통째로 안 그려졌다**(`REV-2026-023`).
`makeSortable()` 을 거칠 것. 편의 기능 하나가 본체를 멈추면 안 된다.
⚠️ **터치 크기는 `@media (pointer: coarse)` 로만 키운다** — 화면 **폭**으로 가르면 좁게
띄운 데스크톱 창까지 커진다. 마우스 화면은 한 픽셀도 건드리지 않았다.
⚠️ **hover 로만 나타나는 조작은 손가락에게 '존재하지 않는다'** — 블록 사이 '+' 가
그랬다(`opacity:0` + 22px). `test:cross` 가 그 둘을 함께 본다.
⚠️ **CSS 선택자와 검사 선택자를 같은 목록으로 쓰지 말 것.** 터치 크기를 `button`·
`select`·`input` 으로 고르고 검사도 같은 선택자를 썼더니, 버튼처럼 쓰는
`<a class="btn">`(52×21)을 **둘이 함께** 놓쳤다(`REV-2026-027`). 검사는 **계산된
`cursor:pointer`** 로 따로 찾는다 — 우리 규칙 목록과 무관한 신호라야 함께 안 빠뜨린다.
⚠️ **상단 바 높이를 상수로 빼지 말 것.** `calc(100dvh - 60px)` 처럼 박아 두면, 좁은
화면에서 상단 바가 줄바꿈해 커질 때(375px 에서 **215px**) 그만큼 본문이 아래로 넘친다
(`REV-2026-028` — 손가락용 44px 규칙을 넣으면서 내가 만든 결함이다). 지금은 문서가 세로
flex 이고 본문이 `flex:1` 로 남는 만큼 가진다 — **빼는 값이 없다.** 상수를 다시 들이지 말 것.
⚠️ 그래서 `@media print` 는 `body{display:block}` 으로 flex 를 **끈다** — flex 아이템
안에서는 `page-break-after` 가 제대로 안 먹는다.
⚠️ **구조로 고친 것은 구조를 되돌려야 깨진다.** 위 건에서 상수만 되돌리거나 상단 바를
강제로 늘려 보는 깨보기는 **둘 다 통과**했다(flex 가 알아서 맞춰 준다). 깨보기가 통과하면
'검사가 헛돈다' 가 아니라 **'덜 깼다'** 일 수 있다.

⚠️ **인쇄용 글꼴(7.6MB)은 인쇄 의도가 보일 때 받는다** — 인쇄 단추의 `pointerdown`·
`focus`·`mouseenter`. 부팅 때 미리 받으면 **인쇄 안 하는 모바일 방문자에게 7.6MB 를
떠안긴다.** 실측: 방문만 하면 **0MB**, 단추에 손이 닿으면 7.83MB 가 시작되고 대화상자에서
고르는 1.5초 뒤 남은 대기는 **0ms**. `test:cross` 가 양쪽을 본다.

⚠️ **화면 요소를 `visibility` 로 숨기지 말 것 — `display` 로 숨긴다**(`REV-2026-059`).
`transition:.13s` 처럼 **속성 목록 없는 shorthand 는 `all`** 이라 `visibility` 도 **이산
전이**를 타고, 그동안 **옛 값을 유지**한다. 그래서 부모를 `visibility:hidden` 으로 꺼도
자식 버튼이 **약 130ms 동안 보이고 눌린다** — 라이브러리에서 인쇄·내보내기 모달이 실제로
열렸다. ⚠️ **계산 스타일을 재면 부모는 `hidden` 인데 자식만 `visible` 이라, CSS 규칙을
전수 조사해도 원인이 안 보인다**(규칙이 아니라 전이가 원인이다 — 실측으로만 찾았다).
`display` 는 즉시 반영된다. 상단 동작은 `setEditorActions(on)` 한 곳이 가른다.
⚠️ **초기값도 숨김이어야 한다**(`REV-2026-061`). 마크업 초기값이 `display:flex` 면, 핸들러가
등록된 뒤부터 `showLibrary()` 가 처음 불릴 때까지의 **부팅 구간에 버튼이 보이고 눌린다**
(defer SDK 가 느리면 그 창이 길어진다). `#topActions{display:none}` 을 CSS 에 두고
`setEditorActions(true)` 만 인라인으로 켠다 — JS 가 늦거나 실패해도 안 드러난다.
⚠️ **판정은 시간이 아니라 자리로 한다** — `getBoundingClientRect().width` 가
`visibility:hidden` 이면 그대로이고 `display:none` 이면 0 이다. 130ms 창을 시간으로 재면
깜빡이는 검사가 된다.
⚠️ **실제 보장은 브라우저 회귀(`test:library-ui`)가 한다.** `check:static` 쪽은 **직접
대입(`.style.visibility =`)만 잡는 보조망**이다 — "visibility 숨김을 전부 막는다" 가 아니고,
우회 문법을 쫓아 정규식을 늘려 갈 것도 아니다.
⚠️ 속성 목록 없는 `transition` 은 세 화면에 **23곳**이다(index 16 · 모의고사 7).
**그걸 다시 쓰지 않았다** — 전부 시각 동작이 바뀌어 위험 대비 이득이 나쁘다. 대신
**짝을 금지한다**: `check:static` 이 세 화면에서 `.style.visibility = …` 를 막는다
(지금 0곳). 통제 실험으로 확인 — 목록 없음 `.13s` 는 숨긴 직후 `visible`, 명시하면
`hidden`, 전이 없으면 `hidden`. **지속시간이 아니라 목록 생략이 원인이다.**

⚠️ **`vh` 옆의 `dvh` 순서를 뒤집지 말 것.** `vh` 가 앞, `dvh` 가 뒤여야 폴백이 된다
(`check:static` 이 본다).
⚠️ **`viewport-fit=cover` 를 그냥 넣지 말 것 — 없던 가림을 만든다.** 기본값이 이미 안전
영역 안에 넣어 준다. 쓸 거면 `env(safe-area-inset-*)` 보정을 **함께** 해야 하고,
`check:static` 이 그 짝을 강제한다. 노치 가림은 아직 **재현할 방법이 없어** 손대지 않았다.

⚠️ **묶음 경계를 아는 곳은 `problemGroups()` 하나다.** 인쇄와 목록이 각자 훑다가
**이미 갈라져 있었다** — 인쇄는 `page` 를 보고 `spanOf()` 를 쓰는데 목록은 `page` 를 안 보고
날것 `.paired` 를 읽어, `pair·page·col` 에서 목록은 1·2 를 묶어 보여 주고 인쇄는 넷을 따로
냈다. 새 사본을 만들지 말 것.
⚠️ **'독립' 은 그 묶음만 푼다 — 뒤를 건드리지 않는다.** 예전엔 뒤를 전부 2개씩 다시
짝지어(툴팁에도 그렇게 적혀 있었다) 사용자가 손수 배치한 것이 위를 만질 때마다 사라졌다.
일괄 묶기는 `묶기 ▾`(지금 문항부터·전체)로 따로 있다.
⚠️ **여러 문항을 한꺼번에 바꾸면 `historyStep()` 으로 감쌀 것.** `pushHistory()` 는 350ms
디바운스라 그냥 두면 **⌘Z 가 그 작업을 못 되돌리고 더 옛 상태로 건너뛴다**(실측).
`historyStep` 은 앞뒤로 확정해 **대기 중이던 타이핑을 제 단계로 남긴다.**
⚠️ **검사에서 목록과 인쇄를 서로 견주지 말 것** — 둘이 같은 함수를 쓰므로 그 함수가
틀리면 함께 틀려 통과한다(실제로 그랬다). **고정 기대 묶음**과 견준다.

⚠️ **인쇄 진행은 비율을 지어내지 않는다.** 실제로 셀 수 있는 것은 그림뿐이라
`그림 확인 7/10` 만 숫자로 말하고 나머지 단계는 흐르는 막대다. `window.print()` 뒤는
브라우저 몫이라 **잴 수 없으므로** '준비 완료' 라고만 하고 인쇄 성공을 추정하지 않는다.
⚠️ **`requestAnimationFrame` 한 번은 '그려졌다' 는 보장이 아니다** — 진행 표시를 만들자마자
동기 작업을 돌리면 그 상태가 한 번도 안 보인다. `painted()` 를 쓸 것.
⚠️ 진행 토스트는 일반 토스트의 **2.4초 자동 종료를 물려받지 않는다**(부른 쪽이 `done()`).
⚠️ 인쇄는 `printing` 으로 **재진입을 막는다** — 같은 `#printDoc` 을 동시에 덮어쓴다.

⚠️ **안내는 '누를 수 있는 자리' 까지가 안내다.** 문서 편집기의 '밖에서 열기' 를 상단 바
안에 넣었더니 375px 에서 `left=388px` — **화면 밖**이었다(`REV-2026-026` 재검토).
줄바꿈 없는 한 줄(`.bar`)에 무언가를 더하면 옆으로 밀려난다. `test:cross` 가 두 화면에서
그 단추의 **네 방향**을 본다.
⚠️ **깨보기는 기여하는 것을 전부 되돌려야 한다.** 위 건에서 위치만 되돌렸더니 함께 넣은
`flex-wrap` 이 혼자서 문제를 막아 **깨보기가 통과**했다. 한 번에 두 곳을 고쳤으면 깨볼
때도 두 곳이다.

⚠️ **드래그 ↔ 스크롤 충돌은 재현하지 못했다** — 합성 이벤트도 CDP 진짜 입력도 드래그를
시작시키지 못했다. **재현이 없으므로 Sortable 옵션을 넣지 않았다.** 실제 기기 몫이다
(`HANDOFF-2026-056`). 그 과정에서 **`.q-list` 가 휴대폰에서 스크롤 컨테이너가 아니라는
것**을 알았다(문항 40개면 쪽이 2,507px).

⚠️ **인앱 브라우저(카톡 등)에서는 구글 로그인이 막힌다** — 구글이 WebView 를 막는 것이라
팝업도 리디렉션도 안 된다. `inAppBrowserName()` 이 감지해 안내를 띄우지만 **감지는 힌트일
뿐이고 로그인 버튼은 절대 없애지 않는다**(오탐 시 멀쩡한 브라우저에서 로그인이 사라진다).
최종 판정은 `authErrorMessage()` 의 오류 코드다. **목록은 `index.html` 과
`document-editor.html` 두 곳에 있고 `check:static` 이 대조한다** — 한쪽만 고치지 말 것.

⚠️ **검사에서 '시끄러운 것' 을 판정에서 빼지 말 것.** 핵심 단추 검사에 `!b.missing` 을
넣었더니 **단추가 사라져도 초록불**이 됐다(`REV-2026-025`). 줄이려면 **경고로 내리는
것**이지 판정에서 제외하는 것이 아니다.
⚠️ **사본을 견줄 때는 목록이 아니라 동작을 견줄 것.** 두 화면의 인앱 앱 이름 목록은
같은데 **갈래 순서가 달라** 같은 상황에 다른 안내를 했다(`REV-2026-026`).
`check:static` 이 두 파일의 `authErrorMessage` 를 **떼어 내 실행해** UA×오류코드 40칸을
견딘다. 목록 비교로는 못 잡는다.
⚠️ **`navigator.clipboard.writeText()` 는 Promise 다** — 기다리지 않으면 거부돼도
'복사했어요' 라고 말한다(`REV-2026-024`).

⚠️ **저장 이벤트 검사를 만들 때 디바운스(150ms)에 속지 말 것.** `pagehide` 검사를 만들고
통과를 봤는데 **소스에서 청취를 지워도 계속 통과**했다 — 250ms 기다리는 사이 디바운스
타이머가 먼저 썼기 때문이다. 이벤트를 쏘고 **기다리지 않고 바로** 읽어야 그 이벤트를 잰다.
그리고 **두 이벤트를 함께 쏘면 안 된다**(하나가 죽어도 다른 하나가 가린다).
⚠️ `visibilitychange` 는 **합성 이벤트만으로는 아무 일도 안 한다** — 핸들러가
`document.visibilityState==='hidden'` 을 보므로 그 값을 잠깐 덮어써야 한다.
⚠️ **검사가 개발 컴퓨터의 설치물에 기대지 않게 할 것.** `serve.py` 의 `/health` 는
`typst` 가 있어야 `ok:true` 를 낸다 — 내 컴퓨터엔 typst 가 있어 '서버 있음' 검사가
통과했고 **CI 에서만 6건이 빨간불**이었다. 그런 검사는 `route.fulfill()` 로 응답을
고정한다(보려는 것이 조판 능력이 아니라 **찾았을 때 무엇을 말하는가** 이므로).
⚠️ **브라우저 검사에서 고정 시간(`waitForTimeout`)으로 기다리지 말 것.** 700ms 로 두었더니
**CI 의 webkit 태블릿·휴대폰에서만** `activeQ()` 가 undefined 라 터졌다 — 느린 기기에서는
앱의 늦은 부팅이 우리가 넣은 세트를 덮는 경쟁이 일어난다. **상태를 기다릴 것**
(`waitForFunction`).

⚠️ **Playwright 의 WebKit 은 실제 iOS 사파리도 카카오 WebView 도 아니다.** 그 검사는 공통
DOM·CSS·JS 회귀를 잡는 1차선일 뿐이고, 인증·다운로드·키보드·safe-area 의 **완료 판정에는
실제 기기가 필요하다.** 자동 검사가 초록불이라고 '모바일 대응 완료' 라고 쓰지 말 것.
⚠️ 그 설계에서 **내가 `[통설]` 로 적은 넷이 검토에서 틀린 것으로 드러났다**(§2 localhost
혼합 콘텐츠 · §5 `viewport-fit=cover` 는 **반대** · §3 ITP 조건 · §4 `:hover` 개수).
재현하지 않은 것은 반드시 `[통설]` 로 표시할 것 — 그 표시가 실제로 값을 했다.

⚠️ **저장소 접근은 던질 수 있다**(사파리 '모든 쿠키 차단' 등). `localStorage` 를 맨몸으로
부르면 예외 하나로 그 뒤 줄이 전부 안 돈다 — `document-editor.html` 이 그래서 **단추가 하나도
안 듣는 죽은 화면**이 됐다(`REV-2026-022`). **화면을 살리는 코드를 먼저 실행하고 편의 기능을
나중에 얹는다.** `npm run test:cross` 가 저장소를 던지게 해 두 앱을 확인한다
(⚠️ `localStorage.clear()` 로는 재현되지 않는다 — 비어 있는 것과 던지는 것은 다르다).

⚠️ **`main` 에 아직 안 올라간 작업이 있을 수 있다.** 새 세션이면 먼저 확인할 것:
```bash
git status -sb && git log --oneline main..HEAD
```
브랜치에 쌓여 있으면 `git checkout main && git merge --ff-only <브랜치>` 로 올린다.
(푸시는 GitHub Pages 배포로 이어지므로 사람이 판단한다)

▶ **구조 분리 — 세 단계 모두 완료.** `index.html` 7,096 → **6,353줄**.
[`pedagogy-normalize.js`](pedagogy-normalize.js)(327줄 · 신뢰 경계) ·
[`pedagogy-render.js`](pedagogy-render.js)(447줄 · 안전한 HTML) ·
[`pedagogy-print.js`](pedagogy-print.js)(252줄 · 묶음 경계·번호·수식 축소).
설계와 근거는 [`docs/STRUCTURE-DESIGN.md`](docs/STRUCTURE-DESIGN.md).
⚠️ **옮기면 `window` 표면이 바뀐다** — 최상위 `function` 은 `window` 속성이지만 `const` 는
아니다. 1단계에서 이걸 놓쳐 교차 검사 여덟이 한꺼번에 터졌다(앱은 멀쩡한데 검사가
`window.normSet` 을 부팅 신호로 쓰고 있었다). **옮기기 전에 표면을 먼저 재고**
(`git show HEAD:index.html | grep '^function 이름('`) 다리에서 `Object.assign(window,{…})`
로 정확히 그만큼 되돌린다 — 예전에 `const` 였던 것을 올리는 것도 회귀다.
⚠️ **화면을 건드리는 함수는 본체에 남긴다** — `reportNormDropped`(toast) ·
`buildPrintDoc`·`fitPrintDoc`·`doPrint`(`activeSet`·`#printDoc`·`toast`). 옮기려면 의존
주입이 필요하고 그건 '옮기기 + 고치기' 다. 그래서 세 모듈은 Node 에서 그대로 돈다.
⚠️ **새 모듈은 `serve.py` 의 `STATIC` 과 `check-static.mjs` 의 대조 대상을 함께 고쳐야
한다** — 각각 404 · **조용한 통과**가 된다.
⚠️ **`const` 는 파일 밖에서 안 보인다는 말은 거짓이다** — 고전 스크립트는 global lexical
environment 를 공유한다. namespace 는 의존성을 **보이게** 하려는 선택이다.

**아직 확인 못 한 것**
- 모의고사 시험지의 **실물 인쇄 대조** — 신명 계열 글꼴이 이 컴퓨터에 없다.
- ~~규격서 저작권이 요구하는 출처 고지~~ → **2026-09-09 완료.** UI 세 화면(`index` ·
  `mock-exam-editor` · `document-editor`)과 매뉴얼(`legal.html`)에 넣었고,
  `check:static` 이 **여섯 곳**(그 넷 + `hwpx-engine.js` + `tex_to_hwp.py`)을 지킨다.
  ⚠️ `index.html` 의 고지는 푸터가 아니라 **`설정 → 정보`** 에 있다. 검사는 그 **자리까지**
  본다(주석에 들어 있어도 통과하면 안 된다) — 그리고 **닿을 수 있는지**도 본다
  (`settingsBtn`·`editorSettingsBtn`·`stTabAbout`·`settingsBack`).
  **닿을 수 없는 곳의 고지는 고지가 아니다.**

⚠️ **이 작업 폴더는 Google Drive 동기화 루트다 — `Icon\r` 이 `.git` 안에 꽂힌다.**
`git fsck` 가 `bad sha1 file: .git/objects/…/Icon` 으로 이름을 댄다. `npm run fix:icons` 는
**증상만 지운다** — 원인은 Drive 설정이고 사람이 꺼야 한다(`REV-2026-074` 에 근거 넷).
⚠️ **`.gitignore` 는 Drive 를 막지 못한다** — 저작물 `.hwp`·`.hwpx` 도 Drive 에 올라가 있다.

**이 프로젝트에서 반복된 실패 방식** — 새로 만들기 전에 한 번 읽을 것:
1. **검사가 다 초록불인데 결과물이 틀렸다.** 한글이 파일을 못 여는 것, 수식이 글자로
   찍히는 것, 표에 선이 없는 것 — 전부 검사를 통과했고 **화면을 봐야** 보였다.
2. **한 곳만 고쳤다.** 계약만 넓히고 Worker·브라우저를 두거나, 조판기만 고치고 편집기를
   두면 그 기능은 사용자에게 도달하지 못한다.
3. **베낀 것은 갈라진다.** 두 조판기, 두 화면의 CSS, 편집기와 변환기의 규칙 —
   그래서 지금은 갈라짐을 잡는 검사가 여러 개 있다. 지우지 말 것.

## What this is

PEDAGOGY — a Korean math problem-set / mock-exam (모의고사) editor, plus a general
Korean-document typesetter that writes 한글(HWPX) files. No build system, no package manager,
no framework: the product is standalone `.html` files plus plain classic-script modules (and a
dev server and test harnesses, below). Each editor is a single-page app; dependencies come from
CDNs (KaTeX, SortableJS, Firebase compat SDK, Pretendard/KoPub webfonts).

- [`index.html`](index.html) — PEDAGOGY main app: problem-set library + block editor.
- [`pedagogy-normalize.js`](pedagogy-normalize.js) — **신뢰 경계(정규화)를 떼어 낸 파일**
  (구조 1단계 · `docs/STRUCTURE-DESIGN.md`). 가져온 `.json` · AI 응답 · 클라우드 데이터가
  전부 여기를 지난다. `index.html` 은 `window.PedagogyNormalize` 에서 이름을 풀어 쓴다.
  ⚠️ **`window` 표면을 옮기기 전 그대로 유지한다** — `safeUrl` `normSubject`
  `normSheetColor` `normBlock` `normProblem` `normSet` `normLibMeta` `resetNormDropped`
  여덟은 예전에 최상위 `function` 선언이라 `window` 속성이었고, 회귀 검사 80여 곳이
  `win.normBlock(...)` 으로 부른다. 다리에서 `Object.assign(window, {...})` 로 되돌린다.
  **`uid`·`sanitize`·`str`·`normOrder`·상수들은 예전에도 `window` 에 없었으니 더하지 말 것.**
  ⚠️ **`reportNormDropped()` 는 본체에 남았다** — `toast()` 를 부르므로. 모듈이 UI 에
  의존하면 Node 에서 그대로 못 돌리고, 검사를 다시 브라우저로 끌고 가야 한다.
  ⚠️ **`serve.py` 의 `STATIC`** 과 **`check-static.mjs` 의 `SET_NAME_MAX` 대조 대상**이
  이 파일을 가리킨다. 빼먹으면 각각 404 · 조용한 통과가 된다.
  ⚠️ **평범한 고전 스크립트다(ESM 아님).** `file://` 에서 그대로 돌아야 하고
  `test:review-contracts` 가 그것을 본다.
- [`pedagogy-render.js`](pedagogy-render.js) — **안전한 HTML 렌더를 떼어 낸 파일**
  (구조 2단계 · `docs/STRUCTURE-DESIGN.md`). 정규화 모듈 뒤에 불러오며,
  `blockHTML()`의 `ctx.subject`·`ctx.range`와 `sanitize()` → `inlineMarks()` 순서를
  미리보기·인쇄의 공통 계약으로 유지한다. 옮기기 전 최상위 `function` 17개는
  `Object.assign(window, {...})` 다리로 기존 표면을 유지한다. `HSMALL`·`condLabel`·
  `circled`는 예전에도 `window` 속성이 아니므로 올리지 않는다. `serve.py`의 `STATIC`과
  `test:review-contracts`가 HTTP·`file://` 로딩과 표면을 함께 확인한다.
- [`mock-exam-editor.html`](mock-exam-editor.html) — 모의고사(mock CSAT exam) editor, embedded
  into `index.html` via an `<iframe>` (see the mock-mode IIFE around line 583 of
  `index.html`). Intentionally isolated: separate global scope, separate document — so a
  failure in one doesn't break the other.
- [`mock-library-store.js`](mock-library-store.js) — **모의고사 라이브러리 저장 계층**
  (`docs/MOCK-LIBRARY-DESIGN.md`). 모의고사를 **여러 부** 두고 라이브러리 카드로 연다.
  ⚠️ **상단 바의 전역 `모의고사` 버튼은 없어졌다** — 라이브러리 제목 자리의 세그먼트
  (`#tabSets` · `#tabMocks`)가 그 자리다. 선택은 `#library=mocks` 해시에 남아 새로고침을
  넘긴다. 옛 버튼을 되살리지 말 것(검사 넷이 새 자리를 본다).
  ⚠️ **쓰는 곳은 본체 하나다.** iframe 은 `postMessage` 로 자기 상태를 올려 보내고
  (`{ns:'pedagogy-mock'}`), 본체가 `mock-library-store.js` 로 쓴다. iframe 안에서 직접
  `localStorage` 를 쓰면 같은 항목을 서로 덮어쓴다(문제집 다중 탭 사고와 같은 모양).
  `file://` 에서는 iframe 이 **다른 출처**라 직접 접근 자체가 안 된다 — postMessage 는 된다.
  ⚠️ **`targetOrigin` 을 `'*'` 로 두지 말 것.** 이 문서는 누구나 iframe 으로 끼울 수 있어
  (`frame-ancestors` 는 메타 CSP 로 못 건다) `'*'` 면 남의 페이지가 시험지 내용을 받는다.
  같은 출처로만 보내고 출처가 없는 `file://` 에서만 `'*'` 다 — `check:static` 이 지킨다.
  ⚠️ **문항 속을 이 계층에서 정규화하지 않는다.** 그 화이트리스트는 편집기의
  `sanitize(blank(n),p)` **한 곳**이다(옮겨 적으면 갈라진다). 그래서 라이브러리는 문항을
  그리지 않고 개수만 센다 — 문항을 그리는 경로를 새로 만들면 그 전제가 깨진다.
  ⚠️ **구형 임시본(`MOCK_DRAFT_V1`)을 지우지 않는다.** 카드 하나로 옮기고 **원본은 한
  릴리스 보존**한다. 이전은 마커와 '목록이 비어 있을 때만' **두 조건**으로 멱등이다 —
  한쪽만 두면 마커 저장이 막힌 브라우저에서 카드가 매번 하나씩 늘어난다.
  ⚠️ **단독으로 연 `mock-exam-editor.html` 은 예전 그대로 임시본 하나를 쓴다.** 거기엔
  라이브러리 화면이 없어 임시본을 없애면 크래시 안전망만 사라진다.
  ⚠️ **클라우드 동기화는 문제집과 같은 계약이다** — `users/{uid}/mocks/{mockId}` 한 부 =
  한 문서 · tombstone 삭제 · `updatedAt` 병합 · `onSnapshot`. 새 모델을 만들지 말 것.
  ⚠️ **`service-config.js` 의 `mockCloudSchema` 는 지금 1 이다** — 2026-09-09 에
  `users/{uid}/mocks` 규칙을 실제로 배포한 뒤 올렸다. **구형 Rules 를 쓰는 배포에 코드를
  올릴 때는 0 으로 내릴 것**(그 규칙에는 mocks 가 없어 저장이 전부 '권한 오류' 가 된다).
  ⚠️ **그림은 Firestore 문서에 담지 않는다.** 편집기가 본체를 거쳐 Storage 로 올리고
  주소만 남긴다(`upload`/`uploaded` 메시지). 담으면 한 부가 1MiB 한도를 그냥 넘는다.
  한글 내보내기 직전에 편집기가 그 주소를 `fetch` 로 바이트화한다 — **버킷 CORS 설정이
  필요하고**(`docs/STORAGE-CORS.md` · `storage-cors.json` · 아직 안 걸었다), 못 가져오면
  조용히 자리표시로 내보내지 않고 말한다. `<img>` 미리보기는 CORS 없이도 되므로
  **화면은 멀쩡하고 내보내기만** 그림이 빠진다 — 같은 기기에서는 재현되지 않는다.
  ⚠️ **문서 크기는 글자 수가 아니라 UTF-8 바이트로 잰다**(`docBytes`). 한글은 3배라
  `.length` 로 재면 1.4MB 짜리가 한도를 통과한다(검사가 잡았다).
  ⚠️ **필드를 더하면 `firestore.rules` 의 `hasOnly` 와 tombstone 도 함께 고칠 것** —
  `check:static` 이 `mockToDoc`·tombstone·Rules 세 곳을 대조한다.
  ⚠️ **삭제에 Undo 가 없다**(문제집 Undo 는 `sets` 스냅샷 위에 서 있다). 확인창이 그렇게 말한다.
  ⚠️ **`button{display:inline-flex}` 가 브라우저 기본 `[hidden]{display:none}` 을 이긴다** —
  `hidden` 을 붙였는데 단추가 **보이고 눌렸다**(`#mockBackBtn` 이 실제로 그랬다).
  지금은 `button[hidden]{display:none!important}` 이 한 번에 막는다. 개별 예외를 늘리지 말 것.
  검사: `npm run test:mock-library`(저장 계층 · 자기검사 포함) ·
  `npm run test:mock-library-ui`(실제 브라우저 · 고장 주입 4개).
- [`serve.py`](serve.py) — optional local Python dev server that compiles the mock editor's
  generated Typst source to PNG page previews with the real exam font/layout, so the
  in-browser approximate preview can be swapped for a pixel-accurate one.
- [`document-editor.html`](document-editor.html) — **범용 문서 조판(베타).**
  ⚠️ **화면에서 입구를 뺐다(2026-09-09).** `index.html` 은 더 이상 여기로 링크하지 않는다 —
  제품의 의의(문제집·모의고사를 한글로 뽑는다)가 흐려졌기 때문이다. **파일과 엔진은
  지우지 않았다**: 주소로 열면 동작하고, **모의고사 한글 내보내기가 같은 엔진을 쓴다.**
  이유와 남긴 것 목록은 [`docs/AI-DOCUMENT-SCOPE.md`](docs/AI-DOCUMENT-SCOPE.md).
  `check:static` 이 두 방향을 함께 본다 — index 가 다시 링크하지 않는지, `serve.py` 에서
  파일·엔진이 빠지지 않았는지. 한쪽만 보면 '입구를 뺀다' 가 어느새 '지운다' 가 된다.
  ⚠️ **로그인 결함이 열려 있다**(`REV-2026-075`) — 재현 절차가 아직 없다. 사용자가 한국어로
  요청하면 AI(Worker)가 제한된 문서 JSON을 만들고, 브라우저에서 검증·미리보기한 뒤
  `serve.py`의 `POST /document-hwpx`로 한글 파일을 받는다. 모의고사와 **다른 흐름**이다 —
  자세한 것은 아래 '범용 문서(HWPX)' 절.
- [`tests/regression-test.html`](tests/regression-test.html) — browser-based regression suite covering
  both apps (see "Testing" below). Not part of the shipped product; only reachable through
  `serve.py`.

Git remote: `origin` → https://github.com/071205/pedagogy (branch `main`, GitHub Pages로
**`https://071205.github.io/pedagogy/`** 에 배포됨 — 프로젝트 페이지라 **저장소 이름이 경로에
붙는다.** `https://071205.github.io` 만 열면 404 다(실측).
⚠️ **저장소를 비공개로 바꾸면 Pages 가 함께 죽는다 — 무료 플랜에서는 되살릴 수 없다.**
2026-09-13 에 실제로 그랬다: 사이트가 404 였고 원인은 코드가 아니라 visibility 였다.
게다가 **Pages 설정 자체가 삭제되므로** 공개로 되돌린 뒤 다시 *만들어야* 한다(켜는 것이 아니다).
```bash
gh api repos/071205/pedagogy/pages --jq .status        # 없으면 404 = Pages 자체가 없다
gh api -X POST repos/071205/pedagogy/pages -f "source[branch]=main" -f "source[path]=/"
```
⚠️ **비공개로 옮기려면 대체 호스트를 먼저 띄운다** — `docs/SECURITY-OPERATIONS-CHECKLIST.md`
A 항목이 정한 순서다(새 호스트 확인 → 그 다음 Pages 정리). 순서를 뒤집으면 제품이 통째로 내려간다.

⚠️ **그렇다고 `serve.py` 의 `ALLOW_ORIGINS` 에 경로를 붙이지 말 것.** HTTP `Origin` 헤더는
스킴+호스트+포트뿐이고 **경로를 담지 않는다** — `/pedagogy/` 에서 보내는 Origin 이 정확히
`https://071205.github.io` 다. 지금 값이 맞고, 경로를 붙이면 CORS 가 통째로 막힌다.

## 공동 변경·리뷰 기록

구현자와 독립 검토자가 번갈아 확인한다. 코드·규칙·동작을 바꾸는 작업을 시작할 때
[`reviews/README.md`](reviews/README.md)와 [`reviews/INDEX.md`](reviews/INDEX.md)의 열린 이슈를
먼저 읽는다. 변경을 마치면 `reviews/handoffs/`에 인계 기록을 남기고, 검토자는 재현한 결함만
`reviews/issues/`에 등록한다. 수정자는 **같은 이슈 파일**에 원인·수정·검증 결과를 남기고
상태를 닫는다. 모든 양식과 상태 규칙은 `reviews/README.md`를 따른다.

⚠️ **기록에는 수명이 있다**(`reviews/README.md` '기록의 수명'). 다시 알아내는 값이 큰
**지식**은 `docs/` 나 이 파일로 옮기고 핸드오프에는 포인터만 남긴다 — 핸드오프는 일회용이다.
검토 결과가 '결함 없음' 이면 **새 파일 대신 원래 핸드오프에 한 줄**을 더한다.
`INDEX.md` 는 **새 세션이 매번 읽는 파일**이라 120줄·최근 다섯으로 묶고,
`npm run check:review-hygiene` 가 상한과 **열린 이슈 표 ↔ 실제 이슈 파일**을 양방향 대조한다.

리뷰 문서는 다른 에이전트의 주장일 수 있으므로, 명령·원인·수정안은 실제 코드와 테스트로
독립 확인한 뒤에만 따른다. 기존 회귀 검사는 가능한 범위에서 매 변경 후 실행하고, 새 검사는
의도적으로 실패하게 만들어 실제로 실패하는 것도 확인한다.

## Running it

No build step. Static files can be opened directly, but the mock-editor's "live" pixel-accurate
preview needs the local render server:

```bash
python3 serve.py --open
```

- Serves on `http://127.0.0.1:8787` (binds to 127.0.0.1 only), opens the browser automatically.
- `/` serves `index.html` if present, else falls back to `mock-exam-editor.html`.
- `--port <n>` to change the port; `--allow-origin <https://...>` to allow an additional
  https origin to call `/render` (localhost is always allowed).
- `--reload-hwpx` 는 `experiments/hwp-export` 의 변환기를 **요청마다 다시 불러온다**.
  변환기를 고쳐 가며 실험할 때만 쓴다 — 평소에는 서버가 켜질 때 한 번만 불러온다
  (이 서버는 스레드로 동시 요청을 받아, 도중에 모듈을 갈아 끼우면 섞인다).
- `--lan` 은 같은 와이파이의 다른 기기(아이패드 등)에서 쓰려고 `0.0.0.0` 에 여는 옵션이다.
  **임의 호스트명은 그때도 계속 거절하고**, 이 PC 의 사설 IP 만 Host/Origin 허용에 더한다
  (그렇게 해야 DNS 리바인딩 방어가 유지된다). 이 모드에서는 상용 글꼴을 내보내는
  `/font/` 가 꺼진다. 구글 로그인·AI 변환을 LAN 에서 쓰려면 Firebase '승인된 도메인' 과
  Worker 의 `ALLOWED_ORIGINS` 에 그 IP 를 각각 추가해야 한다(기동 배너가 안내한다).
- Requires `typst` (`brew install typst`) for the `/render` endpoint to actually compile.
  Without it, `/health` still responds but rendering fails with a message telling the user
  to install it.
- Exam fonts are picked up from `~/exam-fonts` and the Hancom HWP app bundle if installed
  (see `FONT_DIRS` in [serve.py](serve.py)); without them, `mock-exam-editor.html` falls
  back to bundled webfonts (Hamchorom) for its in-browser approximate preview.
- No linter or formatter exists in this repo. There is a regression suite — see "Testing" below.

## Testing

[`tests/regression-test.html`](tests/regression-test.html) loads `index.html` and `mock-exam-editor.html`
each in their own `<iframe>` and re-runs, in one pass, the checks that were previously done
by hand in the terminal/browser-console during review (security/XSS, trust-boundary
normalization, account-scoped storage keys, choices-preservation logic, responsive
breakpoints, dead-code-should-stay-dead). Run it via:

```bash
python3 serve.py --port 8799
```

then open `http://127.0.0.1:8799/regression-test.html`. **Opening the file directly (`file://`)
does not work** — Chrome treats `file://` documents as cross-origin from each other, so the
test page can't reach into the iframes; it shows a banner explaining this instead of failing
silently. (URL 은 `/regression-test.html` 그대로이고 파일만 `tests/` 밑에 있다 — `STATIC` 이
둘을 이어 준다. **파일을 옮기거나 이름을 바꾸면 `serve.py` 의 `STATIC` 도 같이 고칠 것** —
그 목록은 정확히 일치해야 하고, 낡은 항목은 그냥 404 가 된다.)

The AI Worker quota state machine has a dependency-free Node test. The commercial deployment
uses only the Wrangler entry point—there is deliberately no dashboard paste-in copy that can
drift from production—so run it after changing `worker/index.js` or `worker/wrangler.toml`:

```bash
node worker/quota.test.mjs
```

한글(HWPX) 내보내기 검사는 `npm run test:hwpx` 로 돈다(`check:fast` 에 포함).
변환기 의존성(`jakal-hwpx`)은 **제품 의존성이 아니라** `experiments/hwp-export/requirements.txt`
에만 있으므로, 없는 환경에서는 **건너뛴다고 출력하고 통과**한다.

**건너뜀은 통과가 아니다.** 러너가 셋을 구분해 찍는다 — `✅` 실행·통과 / `⏭` 건너뜀 /
`❌` 실패. 검사 스크립트는 종료코드로 이유를 알린다:

| 코드 | 뜻 | `HWPX_REQUIRE=1` 에서 |
|---|---|---|
| `0` | 통과 | 통과 |
| `2` | 저장소에 둘 수 없는 자료가 없어 건너뜀 (실물 틀 — 저작물) | 통과(갖출 방법이 없다) |
| `3` | 설치·파일로 해결 가능한 건너뜀 (의존성·표본) | **실패** |

CI 는 `.github/workflows/verify.yml` 의 **`hwpx` 작업**에서 `HWPX_REQUIRE=1` 로 돈다.
제품 검사(`verify`)와 **분리된 작업**이라 베타 의존성이 제품 검사 환경에 섞이지 않는다.
CI 에는 실물 틀이 없으므로 `test_structure` · `test_sections` · `test_page_layout` ·
`test_style_roles` 는 `⏭` 로 남는다 — **그 넷은 사람이 로컬에서 돌려야 한다.**

⚠️ 그래서 변환기에 **경고를 더할 때는 틀 없이 도는 경로를 함께 확인할 것.** 틀이 없을 때도
그 경고가 나오면 '경고 없음' 을 보는 검사(`test_image_paths`·`test_endpoint`)가 **CI 에서만**
빨간불이 된다(실제로 그랬다). 틀을 잠시 치우고 `HWPX_REQUIRE=1 npm run test:hwpx` 를 돌려 본다.

⚠️ 이 검사들은 한동안 **어떤 실행 경로에도 걸려 있지 않았다.** 편집기 규칙을 옮겨 적은
사본이 어긋나도 아무도 모르는 상태였다. 새 검사를 만들면 러너에 거는 것까지 해야 한다.

**선지 배치 정답표.** `experiments/hwp-export/samples/choice-layout-truth.json` 은 **진짜
편집기를 브라우저에 띄워 받아 적은 답**이고, `test_layout.py` 가 파이썬 변환기를 그것과
대조한다. 다시 재려면 `npm run update:hwpx-truth`.

⚠️ 그 정답표는 **낡을 수 있다.** 그래서 파일에 편집기 규칙의 지문(`_editorRules`)을 함께
적어 두고 `check:static` 이 맞춰 본다(브라우저도 파이썬도 필요 없어 CI 에서 항상 돈다).
편집기의 `SPEC`·`measureCh`·`layoutOf`·`hasGND`·`choiceItems` 를 고치면 빨간불이 나며 다시
재라고 알려 준다 — 규칙 조각의 **모양**을 바꿨다면 `scripts/editor-layout-rules.mjs` 의
패턴도 함께 고쳐야 한다.

**실물 한글로 열어 보는 검사 — `npm run test:hwpx-opens -- 파일.hwpx`**

```bash
npm run test:hwpx-opens -- experiments/hwp-export/out/결과.hwpx
```

⚠️ **이것이 없으면 같은 실수를 반복한다.** 우리 검사가 전부 초록불인데 한글이 파일을 열지
못하는 일이 두 번 있었다. 규격서에도 "한글이 열어 주는가" 는 적혀 있지 않다 — 열어 보는
수밖에 없다. 맥 + 한글 + **손쉬운 사용 권한**이 필요해 CI 에는 걸 수 없다
(시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용).

**그리고 '열린다' 다음 단계가 하나 더 있다 — 한글로 PDF 를 뽑아 눈으로 본다.**
파일 → PDF로 저장하기 를 `System Events` 로 눌러 뽑으면 조판 결과를 **그림으로 직접**
볼 수 있다(단축키 ⌘S·⌘P 는 이 앱에 먹지 않는다 — 메뉴를 눌러야 한다).
구획 태그·확인 사항 상자가 실물 자리에 찍혔는지는 그렇게 확인했다.

이 검사를 만들며 겪은 함정들. 고칠 때 되돌리지 말 것:

- ⚠️ **창 개수로 판정하면 안 된다.** 오류 대화상자도 창으로 세어져 **거부당한 파일을
  ✅ 로 보고했다.** 대화상자의 글("파일을 읽거나 저장하는데 …")을 직접 읽어야 한다.
  거짓 통과는 검사가 없는 것보다 나쁘다.
- ⚠️ **한글을 `quit` 시키고 다시 띄우면 그 뒤로 아무 파일도 못 연다**(여러 번 재현).
  검사는 앱을 끄지 않는다. 전부 실패로 나오면 파일이 아니라 한글을 의심할 것.
- ⚠️ **같은 이름의 문서가 이미 열려 있으면 `open` 은 다시 읽지 않는다.** 고친 파일을
  보면서 옛 내용을 판정하게 된다. 판정 전에 같은 이름 창을 닫는다.
- ⚠️ **`⌘W`·`⌘⌥W` 는 한글에 먹지 않는다.** 창의 닫기 단추를 눌러야 닫힌다.
- 파일 이름의 자모 분해(NFD)와 창 제목(NFC)이 달라 비교 전에 정규화한다.

**그리고 이 검사도 "열리는가" 까지만 답한다.** 조판이 맞는지는 눈으로 봐야 한다 —
탭으로 이어 붙인 선지가 수식 변환을 안 타서 `$\dfrac32$` 가 글자로 찍힌 버그를,
파일은 멀쩡히 열렸고 검사도 ✅ 였는데 화면을 보고서야 찾았다.

**시각 회귀(`npm run test:visual`)의 기준 시각본은 OS 별로 있다** —
`test-fixtures/visual-baseline/<platform>/`. 글리프 래스터화가 OS 마다 달라
**다른 OS 의 기준본과는 견줄 수 없다**(맥 기준본 ↔ CI 리눅스 = 쪽의 1.843% 차이인데,
본문이 3px 밀린 진짜 회귀는 1.492% 다 — 잡음이 신호보다 크다). 그 OS 의 기준본이
없으면 ⏭ 로 건너뛴다. 지금 저장소에는 `darwin/` 만 있어 CI(리눅스)에서는 비교를
건너뛰고, 인쇄 경로가 도는지와 칸 넘침만 확인한다(`REV-2026-018`).
표본은 일곱이고 **과목별 조판 규칙이 하나씩 걸려 있다** — `05-english-order` 가 영어
(무테 지문·각주 우측 정렬·2열 선지·(A)(B)(C) 인라인 라벨·듣기 답란 밑줄·묶음 안내)를,
`06-english-notice` 가 안내문 상자와 **표 문항**(칸 합친 제목 줄·안 굵은 머리글)을,
`07-math-image-choices` 가 그림 선지(3+2 · 라벨은 그림 위)를 지킨다. 지우지 말 것.
⚠️ 판정은 픽셀 비율이 아니라 **행 먹 분포**다. 쪽 대부분이 흰 여백이라 픽셀 비율로는
**글줄 하나가 통째로 사라져도 0.038%** 라 옛 허용치 0.5% 를 그냥 통과했다.
매 실행 끝에 기준본의 글줄을 지워 '지금 설정으로 잡히는가' 를 자기검사한다.

⚠️ 브라우저로 실제 폭을 재는 대조(`npm run test:hwpx-parity`)는 **일부러 CI 에 걸지
않았다.** `measureCh()` 는 글꼴 실측이라 CI 리눅스와 개발 컴퓨터의 값이 다르고, 임계값에
1mm 차로 붙은 선지가 있어(문항 28의 마지막 선지 21.2mm vs 한도 22.2mm) 쉽게 깜빡인다.
깜빡이는 검사는 없느니만 못하다. 대신 지문으로 '낡음' 을 잡는다.

**A check that always passes is worse than no check.** Every trap below was found by
deliberately breaking the thing under test and confirming the suite went red — do that for any
new check you add, because three separate "all-green while testing nothing" bugs happened here:

- **`const`/`let` top-level bindings in `index.html`/`mock-exam-editor.html` are invisible via
  `iframe.contentWindow.xxx`** — only `var`/`function` declarations become `window` properties;
  `const sanitize=...`, `const MAX_UPLOAD_BYTES=...`, `const ICON=...` etc. live in a lexical
  scope private to that document's own scripts. `eval`-ing inside the iframe to reach them is
  not an option either — both apps' CSP has no `unsafe-eval` (deliberately; do not add it for
  testing convenience). The working fix, `installHooks()` in `regression-test.html`: inject a
  real `<script>` element into the iframe's own document (allowed — CSP `script-src` already
  has `'unsafe-inline'`, which is a separate grant from the event-handler-attribute block) that
  assigns the names it can see into `window.__HOOKS__`, then read that object from the parent.
- **XSS-probe `<img onerror>` markers need the test `<div>` attached to `document` *and* a short
  `await` before checking the flag.** A detached `div.innerHTML = "<img onerror=...>"` never
  fires in current Chrome (image loading is deferred until the element is connected), and even
  once attached, `onerror` arrives asynchronously — checking the marker synchronously right
  after the assignment always reads `0`. Both were verified by deliberately feeding the helper
  a real unescaped payload and confirming it correctly reported "unsafe" before trusting it to
  test the app.
- **A probe that writes must use a value unique per run, and must restore what it overwrote.**
  The `wiping` check works by setting the flag, calling `writeLocalNow()`, and asserting nothing
  reached `localStorage`. Two ways that went wrong: a *fixed* marker string meant that once the
  guard genuinely broke and the marker leaked, the leftover kept the check red on every later
  run even after the fix (looked like a caching problem for a while); and the leaked probe had
  overwritten the real `PM_SETS_V7:*` key — a test that destroys user data when it fails. It now
  uses a timestamped marker and restores the original value in every path.
- **The iframes are loaded with a `?t=<now>` cache-buster.** Without it the suite happily
  re-tests a stale cached copy of `index.html`, so edits appear to have no effect.
  (`serve.py` strips the query string before its exact-match `STATIC` lookup, so this is safe.)

The suite never calls anything that persists (`saveSets`, `flushToCloud`, `saveJSON`, ...), so
it's safe to run against a signed-in profile with real data — it only calls pure functions
(`sanitize`, `normSet`, `processText`, `tex`, ...) or mutates throwaway fixture objects
(`blank(1)` in the mock editor), never the live `sets` / `state.problems` arrays. The one
exception is `showLibrary()` (used for a layout check), which is a pure navigation call with no
data side effect beyond clearing the "last opened set" pointer — the same thing that happens
when a real user clicks the logo.

## Architecture

### index.html (PEDAGOGY main editor)

Vanilla JS, no modules/bundler — everything lives in two inline `<script>` blocks. Key
pieces to know before editing:

- **Data model**: a problem set is `{ id, title, problems: [...] }`; a problem
  (`newProblem()`) is `{ id, title, desc, answer, answerImg, numLabel, paired, blocks: [...] }`.
  Each block is `{ type, data }` where `type` is one of `statement | passage | conditions |
  examples | boxed | choices | image` (see the `#blockType` `<select>` and `blockHTML()`).
- **지문 세트 (국어·영어)**: `passage` 블록 + 문항의 `groupSpan`.
  **2025 수능 국어 실물(`평가원 국어 양식.pdf`)에 맞춘 구조다.**
  `passage.data = { lead, boxed, parts:[{label, kind, text, source, notes}] }`.
  · 안내문(`lead`)은 **상자 밖 위**에 온다 — 상자 안에 넣으면 실물과 다르다.
  · **지문은 기본이 상자다**(`boxed` 기본 true). 독서·문학·소설 모두 테두리가 있다.
    처음에 무테로 만들었다가 실물을 보고 고쳤다 — 무테는 사설 자료용 예외다.
  · **(가)(나)(다)는 상자 하나 안에** 나란히 들어간다 → 조각마다 별도 상자를
    만들면 안 된다. 그래서 `parts` 배열이다.
  · 각 조각은 `source`(– 장석남, 「배를 밀며」 –, 우측정렬)와 `notes`(* 치병: …,
    줄당 하나)를 가진다. 앞뒤 `–` 와 `*` 는 렌더가 붙이므로 입력에 넣지 않는다.
  · 한 줄이 통째로 `(중략)`·`(하략)`·`(전략)` 이면 가운데 정렬한다(`isEllipsisLine`).
  · 예전 형식(`{text,kind,label}`)은 `normBlock` 이 `parts` 하나로 자동 이관한다.
  ⚠️ **운문(verse)은 `processText()` 를 그대로 쓰면 안 된다** — 그 함수는 줄바꿈을
  6pt 문단 간격으로 바꿔서 시 행 사이가 문단처럼 벌어진다. `verseHTML()` 이 행마다
  따로 조판하고 빈 줄에서만 연 간격을 준다(각 행은 여전히 `processText()` 를 태워
  이스케이프·수식 처리를 동일하게 받는다).
  `boxed` 는 평가원 정본(무테)과 사설 문제집(테두리) 양쪽을 지원하려는 것이다.
  · **조각 라벨의 자리는 과목이 정한다**(두 실물 `.hwp` 를 직접 읽어 확인).
    국어 `(가)(나)(다)` 는 **자기 혼자 있는 문단**이고 본문은 다음 문단 → 별도 줄.
    영어 순서 문항(36·37번)의 `(A)(B)(C)` 는 **본문과 한 문단**이고 그 문단이
    내어쓰기 7.62mm(본문 11.5pt → **1.88em**)를 갖는다 → 인라인 + 행잡기(`psg-p-lab`).
    ⚠️ **라벨의 `text-indent:0` 을 빼지 말 것.** `text-indent` 는 상속되고 라벨은
    `inline-block` 이라 음수 들여쓰기를 한 번 더 먹어 글자가 단 밖으로 나가고,
    `.pq{overflow:hidden}` 에 잘려 **라벨이 통째로 안 보인다.** HTML·계산된 스타일·요소
    자리는 전부 정상이라 **인쇄물을 눈으로 봐야만** 보인다(실제로 그렇게 찾았다).
  · **영어는 국어와 조판 규칙이 다르다**(2025 수능 영어 실물에서 잼).
    지문이 **무테**이고(국어는 상자), 첫 줄을 **0.87em 들여쓰며**(실물 3.72mm ÷ 본문
    12.2pt), 각주는 **오른쪽 끝에 붙고 여러 개가 한 줄에** `*`·`**` 로 나란히 온다
    (국어는 왼쪽·줄당 하나). 새 지문 블록의 테두리 기본값도 과목이 정한다.
    ⚠️ 갈래는 `blockHTML(blk, ctx)` 의 `ctx.subject` 로 넘긴다 — **미리보기와 인쇄 두
    곳이 모두 넘겨야 한다.** 한쪽만 넘기면 화면과 인쇄가 갈라진다.
- **안내문 상자 (`notice`)**: 영어 27·28번의 '다음 안내문' 형식. 줄이 네 갈래다 —
  `text`(도입문) · `head`(굵은 소제목) · `bullet`(∙ 항목) · `note`(※ 줄) + 상자 제목.
  ⚠️ **`∙` 와 `※` 는 렌더가 붙인다** — 출처의 `–`, 각주의 `*` 와 같은 규칙이다.
  ⚠️ **소제목은 실물에서도 진짜 bold 다.** '실물은 굵게를 안 쓴다' 는 말한이·묶음 안내
  이야기이고, 요소마다 재어 보고 갈라야 한다.
  ⚠️ 실물의 상자는 1×1 표 한 칸이지만 우리는 CSS 테두리를 쓴다(같은 그림이다).
  상자 안에 표가 들어가는 27번 형식은 아직 못 만든다.
  · **지문 산문은 문단마다 요소(`psg-p`)** 이고 첫 줄을 0.87em 들여쓴다. 실물이 그렇다
    (국어 3.56mm · 영어 3.72mm — 둘 다 약 한 글자. 우리 단이 좁아 mm 가 아니라 em 으로 쓴다).
    ⚠️ 예전에는 `processText()` 가 `\n` 을 6pt 간격 span 으로 바꿔 **문단이라는 상자가
    없었다** — 그래서 들여쓸 곳이 없었다. 지금은 `proseHTML()` 이 문단으로 나누고
    그 6pt 는 CSS(`.psg-p + .psg-p`)가 준다. **빼면 문단이 붙는다.**
    ⚠️ **`$$…$$` 안의 줄바꿈에서 쪼개면 안 된다** — 표시 수식이 두 조각으로 깨진다.
    `splitParagraphs()` 가 `$$` 밖의 `\n` 만 경계로 삼는다.
    ⚠️ 운문(verse)에는 이 규칙이 가면 안 된다(시 행이 밀린다). `verseHTML()` 이 따로 그린다.
- **탐구 (사회·과학)**: 조판 근거는 [`docs/INQUIRY-SUBJECT-DESIGN.md`](docs/INQUIRY-SUBJECT-DESIGN.md)
  (2025 수능 **사회·문화**·**화학Ⅰ** 두 부에서 쟀다 — 탐구 전체로 일반화한 값이 아니다).
  본문·발문·`<보기>`·선지는 **국어와 같은 11.5pt** 라 바꿀 것이 없었다. 다른 것은 둘뿐이다.
  ⚠️ **자료 표는 과목으로 가른다**(`.tbl-inq` 0.87em) — 두 실물이 9.5~10.0pt 로 **일치**한다.
  범위의 큰 쪽을 골랐다. 사이의 값을 규칙이라고 지어내지 말 것.
  ⚠️ **자료 상자는 과목으로 강제하지 않는다** — 사회·문화 9.5pt vs 화학Ⅰ 11.5pt 로
  **어긋나서**, 하나로 정하면 둘 중 하나는 반드시 틀린다. `boxed`·`table` 의 **'작게'**
  (0.83em)로 사용자가 정한다. **실물이 갈리면 규칙이 아니라 선택지를 준다.**
  ⚠️ **표 칸에 그림이 들어간다**(`table.images[r][c]`) — 실물 그림 20개 중 17개가 표 안이다.
  `rows` 는 **문자열 배열 그대로** 두고 그림은 같은 모양의 별도 배열이다(객체로 바꾸면
  `blockExcerpt`·`setHasContent` 가 터진다 — 대화문 `items` 사고와 같다).
  ⚠️ **그 자리도 `blockImageSlots()` 를 거친다** — 안 거치면 `REV-2026-019`·`-020` 이 재현된다.
  ⚠️ **칸 합치기도 있다**(`spans[r][c]=[가로,세로]`) — 실물 자료표 7건 근거이고 **세로도**
  쓰인다. 행을 더하거나 지울 때 `rows`·`images`·`spans` **셋을 함께** 움직일 것.
  덮인 칸을 건너뛰는 곳은 렌더의 `taken` **하나**다. 값은 정수로 조인다 — 가져온 `.json`
  의 큰 값 하나가 덮기로 표를 통째로 지운다.
  ⚠️ **화학식은 재 보니 하나만 없었다** — 아래첨자·전하·상태·반응 화살표·가역·이온·섭씨·
  범위·분수는 전부 이미 됐고, 없던 것은 `\ce{}`(mhchem)뿐이라 **넣었다**.
  ⚠️ **mhchem 의 자리가 계약이다** — KaTeX **뒤**, auto-render **앞**. 뒤바뀌면 `\ce` 가
  조용히 "Undefined control sequence" 가 된다. `check:static` 이 순서·SRI 를,
  `regression-test.html` 이 **실제 렌더**를 본다(해시가 틀리면 조용히 차단되므로 실행해야 안다).
  ⚠️ `25\,^\circ\mathrm{C}` 는 실패한다 — `25^\circ\mathrm{C}` 로 쓸 것(LaTeX 함정이다).
  ⚠️ **첨자 앞에 밑글자가 없으면 한글이 수식을 통째로 버린다**(2026-09-17 · 실물로 쟀다).
  조합·순열의 앞머리 아래첨자 `_6\mathrm{C}_2`(₆C₂)가 `_{6}rm {C}_{2}` 로 나가면 한글이
  **오류도 없이 빈 것으로** 조판해 **발문이 통째로 빈칸**이 됐다. 확률과 통계에서 계속
  나오는 기호다. 지금은 변환기가 `{}` 를 밑글자로 세운다 — 네 후보(`{}`·`""`·`~`·없음)를
  한글로 찍어 보고 `{}` 만 간격 없이 제 모양을 내는 것을 확인했다.
  ⚠️ **파이썬과 JS 양쪽을 고쳤다**(`_has_base` ↔ `hasBase`). 한쪽만 고치면 갈라진다.
- **과목 (`set.subject`)**: 문제집마다 과목을 두고 **블록 '메뉴' 만 거른다**
  (`SUBJECTS` · `allowedBlockTypes()`). 파일을 과목별로 쪼개지 않은 이유 —
  저장·병합·인쇄·되돌리기·이미지·인증이 전부 공유라, 과목 전용 코드(200줄 남짓)를
  떼어내려고 기반 4,500줄을 복제하게 된다.
  ⚠️ **이건 방어선이 아니라 UI 필터다.** 실제 검증은 `normBlock()` 이 한다 —
  그래서 과목을 바꿔도 이미 넣어 둔 블록은 지워지지 않는다.
- **대화문 (`dialogue`) · 표 (`table`)**: 화법과작문·언어와매체 서식 + **영어 10번 표 문항**.
  ⚠️ **표 머리글은 굵지 않다** — 두 실물 모두 `bold=False`(영어 `Kit` 11.5pt · 국어
  `양순음` 10.5pt). **그런데 제목 줄(`data.title`)은 굵다.** 요소마다 재어 보고 갈라야 한다.
  `title` 은 표 **안** 맨 위에 칸을 합쳐 놓는 줄이다(실물 `Plant Seed Kits`).
  안내문 상자와 같은 필드 이름이라 `blockExcerpt`·`setHasContent` 를 또 늘리지 않아도 된다.
  ⚠️ **말한이는 굵게가 아니라 고딕이다**(국어 실물 태고딕 10.5pt = 0.913em · 본문은
  중명조 11.5pt). **영어 말한이는 본문과 완전히 같다** — `.dlg-en` 이 되돌린다.
  **말한 내용을 비우면 답란(밑줄 한 줄)** 이 된다 — 영어 듣기 13·14·15번 형식이다.
  실물은 밑줄 속성이 걸린 묶음 빈칸을 단 끝까지 채우지만 **그 개수를 베끼지 않는다**
  (우리 단 폭이 다르다) — 남은 폭을 채운다. ⚠️ 밑줄은 CSS 가 그리므로 마크업만 보는
  검사로는 사라진 것을 못 잡는다(계산된 `border-bottom` 을 재는 검사가 따로 있다).
  ⚠️ `dialogue` 의 `items` 는 **문자열이 아니라 `{who,text}` 객체 배열**이다.
  `qExcerpt()`/`setHasContent()` 처럼 블록 내용을 훑는 곳이 문자열로 가정하면
  터지거나(문항 목록이 통째로 죽었다) 내용 없음으로 오판한다(병합에서 빠져
  데이터가 사라진다). **새 블록을 추가하면 `blockExcerpt()` 와 `setHasContent()`
  두 곳을 반드시 같이 볼 것.**
- **선지의 그림 (`choices.data.images`)**: 교과서의 그래프 이동 문항처럼 **선지 자체가
  그림**인 형식. `items`(글)와 **같은 자리끼리 짝**을 이루는 별도 배열이고 둘 다 길이 5다.
  ⚠️ **`items` 를 객체 배열로 바꾸지 말 것.** `convertBlock`(조건↔보기↔선지)과 내용을
  훑는 곳들이 전부 문자열을 가정한다 — 대화문 `items` 가 객체라서 겪은 것과 같은 사고가 난다.
  ⚠️ **두 배열은 늘 함께 움직인다.** 한쪽만 `splice` 하면 그림이 옆 선지로 옮겨간다.
  ⚠️ **그림이 블록의 어디에 담기는지 아는 곳은 `blockImageSlots()` 하나다.** 수집
  (`blockImageUrls`·`storagePathsOf`) · base64 감지(`blockDataUrls`) · 이관
  (`migrateBase64ToStorage`) · 저장 전 판정(`saveSets`)이 **전부 그것을 거친다.**
  ⚠️ 이 규칙을 안 지켜 **같은 사고가 두 번** 났다. `blockImageUrls()` 만 만들고 다른
  호출자를 두었더니 —
    · `releaseImage()` 가 **다른 문제집이 아직 쓰는 파일을 지웠다**(`REV-2026-019`)
    · base64 선지 그림이 이관되지 않아 **Firestore 1MB 한도를 넘겼다**(`REV-2026-020`)
  둘 다 블록 단위 검사는 전부 초록불이었다. 회귀가 이제 **관계**를 본다 —
  블록 단위 ⊆ 문제집 단위, 그리고 네 곳이 모두 `blockImageSlots()` 를 거치는지.
  · 3+2 는 **`cols3` 이 그대로 만든다**(5개를 3열에 넣으면 3+2). 새 배치를 만들지 않았다.
  · 라벨은 그림 **위 줄**에 온다 — 3열 칸이 좁아 옆에 두면 그래프가 그만큼 눌린다.
    ⚠️ 그 CSS 는 반드시 `.choice{display:flex}` **뒤**에 와야 한다. 앞에 두면 같은 점수라
    나중 규칙이 이겨 라벨이 옆에 붙는다(실제로 그랬다 — 마크업은 멀쩡해 화면을 봐야 보인다).
  · 그림은 **파일 선택**으로도 **글 칸에 붙여넣기(⌘V)** 로도 넣는다 — 교과서 캡처를
    바로 붙일 수 있게. 둘 다 `putChoiceImage()` 한 곳을 쓴다(베끼면 갈라진다).
    ⚠️ **글을 붙여넣은 것이면 가로채지 않는다** — `pastedImageFile()` 이 `kind==="file"` 과
    `getAsFile()` 두 가드로 거른다. 하나만 있어도 동작은 맞지만 **둘 다 두었다**.
  · 편집기는 **그림을 처음 붙일 때만** 5열 → 3열로 옮긴다. 5열에 그림 다섯이면 한 칸이
    20mm 남짓이라 그래프를 알아볼 수 없다. **`normBlock` 은 배치를 건드리지 않는다** —
    저장된 값은 사용자의 결정이므로 그대로 둔다(일부러 5열을 고른 사람이 있다).
  ⚠️ **실물 평가원 수학에는 이 형식이 없다**(선지 안 개체 165개가 전부 수식이다).
  배치·크기는 실물에서 잰 값이 아니라 **정한 값**이다 — 근거가 생기면 다시 잴 것.
- **선지 배치 (`choices.layout`)**: `horizontal`(5열) · `cols3` · `cols2` · `vertical`.
  실물 수능 영어가 넷을 다 쓴다(3열 8·17번 · 2열 5·19·31·36번 · 나머지는 세로).
  ⚠️ 값은 `CHOICE_LAYOUTS` 화이트리스트를 거친다 — 가져온 `.json` 의 모르는 값은
  5열로 떨어진다. 인쇄 넘침 보정(`fitPrintDoc`)도 **네 배치를 모두** 본다.
- **지문 안 인라인 서식**: `**굵게**` · `__밑줄__` · `[[네모]]`.
  실물 N제(이감 간쓸개)에서 계속 쓰이는 세 가지다. 기호(㉠ⓐ)는 밑줄 '밖' 에
  둔다 — 실물이 그렇다(`㉠__뱃머리__`).
  `[[네모]]` 앞에 `(A)` 같은 라벨이 붙어 있으면 **한 덩어리로 묶는다**(`wbox-set`) —
  묶지 않으면 줄 끝에서 라벨과 상자가 다른 줄로 갈린다(영어 어휘 문항에서 실제로 그랬다).
  ⚠️ **`inlineMarks()` 는 반드시 `sanitize()` 를 통과한 문자열에만 적용할 것.**
  순서를 바꾸면 우리가 만든 태그까지 이스케이프돼 서식이 글자로 보이고,
  반대로 본문의 `< >` 가 살아남아 주입이 뚫린다. 회귀가 이 순서를 검사한다.
- **구간 표시 (`[A]` `[B]`)**: 한 줄이 통째로 `<<A` 면 시작, `>>` 면 끝.
  `splitRanges()` 가 산문·운문 공용으로 토막 내므로 '어디서 끊을지' 는 한 곳에만 있다.
  ⚠️ 산문에서 구간을 처리할 때 앞 문단을 늦게 흘려보내면 **글 순서가 뒤집힌다**
  (실제로 그랬다). 라벨은 영숫자 3자까지만 받는다(style/HTML 로 들어가므로).
- **`<보기>` 상자**: `bogi` 블록. `examples`(ㄱㄴㄷ)에 `label` 을 주면 그것도 같은
  상자 모양이 된다 — 국어 문법 문항이 ㄱㄴㄷ를 `<보기>` 안에 넣는 형식이라서다.
  라벨은 `<자료>`·`<조건>` 으로도 바꿔 쓴다.
  **묶음은 두 가지다.** ① 지문을 함께 쓰는 묶음(국어 전부·영어 41~42·43~45) ②
  **안내만 함께 쓰는 묶음**(영어 16~17·31~34·36~37·38~39 — 뒤 셋은 문항마다 제 지문을
  갖는다). ②는 문항의 `groupLead` 에 안내 글을 적으면 `grp-head` 한 줄이 그려진다.
  ⚠️ `groupSpanOf()` 는 지문이 없을 때 **안내 글이 있어야** 묶음으로 센다 — 안 그러면
  지문 블록을 지우고 남은 옛 `groupSpan` 이 갑자기 범위를 그려 예전 데이터의 뜻이 바뀐다.
  ⚠️ 지문이 있으면 지문 블록이 이미 그리므로 `grp-head` 를 또 그리지 않는다(두 번 나온다).
  ⚠️ 묶음 설정 UI 는 **문항 편집기에 하나만** 둔다 — 블록이 아니라 문항의 값이고,
  지문 블록 안에만 두면 지문 없는 묶음은 손댈 수가 없다(실제로 그랬다).
  지문 블록을 가진 문항이 세트의 첫 문항이고, `groupSpan` 은 그 지문을 함께 쓰는
  문항 수(자기 포함, 1~10)다. 뒤 문항에는 지문 블록을 넣지 않는다 — 지문은 첫
  문항의 블록으로 한 번만 그려지고, `computeNums()` 가 `[01~03]` 범위 라벨을
  만들어 `blockHTML(blk, ctx)` 의 `ctx.range` 로 넘긴다(블록 혼자서는 자기가 몇
  번부터 몇 번까지를 대표하는지 알 수 없다). 범위 끝은 배열 밖으로 못 나가게
  자른다 — 큰 `groupSpan` 을 두고 뒤 문항을 지우면 없는 번호를 가리킨다.
- **시험지 선 색**: 문제집의 `lineColor`. `SHEET_COLORS` 목록 안의 값만 쓰고
  실제 색은 `sheetHex()` 가 준다. 이 값은 `style` 의 `--sheet-line` 으로 들어가므로
  ⚠️ **자유 문자열을 받으면 안 된다**(가져온 .json 으로 임의 CSS 가 섞인다).
- **Persistence, three tiers**: localStorage (`setsKey()`, per-uid) is the always-on cache;
  Firestore is the source of truth when signed in via Firebase Google auth.
  **한 문제집 = 한 문서**: `users/{uid}/sets/{setId}`. 예전처럼 `users/{uid}` 문서 하나에
  `sets` 배열을 통째로 넣지 않는다 — 1MB 한도에 걸리고, 다른 탭이 같은 순간에 저장하면
  그쪽 작업이 통째로 사라졌다. `flushToCloud()` 는 `cloudSynced` 와 비교해 **바뀐 문제집만**
  올린다. 삭제는 실제 삭제가 아니라 `deleted:true` tombstone 이다(다른 기기의 오래된
  사본이 되살리는 것을 막는다). 구버전 `users/{uid}.sets` 문서는 `loadSets()` 가 처음
  한 번 서브컬렉션으로 이관하고, **안전망으로 지우지 않고 남긴다.**
  병합은 `mergeSets(cloudEntries, localSets, localStamps)` 가 **문제집별 `updatedAt`** 을
  비교한다(로컬 시각은 `PM_STAMPS:{uid}` 에 따로 둔다 — `sets` 안에 넣으면 내보내기
  JSON 과 되돌리기 스냅샷까지 오염된다). `watchCloud()` 가 `onSnapshot` 으로 다른 탭·기기
  변경을 받아 반영한다.
  `snapshotLocalBackup()`/`window.restorePedagogyBackup()` keep an extra local safety copy.
- **데이터 관리 (라이브러리 → '데이터 관리' 버튼 · `#dataModal`)**: 백업 되돌리기 ·
  모든 문제집 삭제 · 계정 삭제. 되돌릴 수 있는 것과 없는 것을 UI 에서도 코드에서도
  갈라 둔다 — **'모든 문제집 삭제'는 계정을 남기고 로컬 백업을 남겨 복구 가능**,
  **'계정 삭제'는 백업까지 지우고 Auth 계정까지 없앤다(복구 불가)**.
  건드릴 때 반드시 지켜야 하는 것들:
  - ⚠️ **`wiping` 플래그**. 삭제 중 `saveSets()`/`writeLocalNow()`/`flushToCloud()` 를
    전부 막는다. 없으면 디바운스 저장·`visibilitychange`·`beforeunload` 가 끼어들어
    방금 지운 걸 도로 쓴다(계정 삭제 중이면 곧 사라질 uid 앞으로 문서를 만들어 고아가 된다).
    새 저장 경로를 추가하면 이 가드도 같이 걸 것.
  - ⚠️ **삭제 전에 `setsUnsub()` 로 구독을 끊는다.** 안 끊으면 우리가 쓴 tombstone 을
    `watchCloud()` 가 도로 읽어 `sets` 를 건드리고, 끝에 '비었으니 새 문제집 하나'
    로직이 돌아 빈 문제집이 되살아난다. `finally` 에서 다시 구독한다.
  - ⚠️ **계정 삭제 순서**: 재인증 → 이미지 → 문제집 문서 → `users/{uid}` → **Auth 계정(마지막)**.
    재인증을 맨 앞에 두는 이유는 `auth/requires-recent-login` 이 데이터를 지운 *뒤에*
    터지면 '데이터는 날아갔는데 계정은 남은' 상태가 되기 때문이고, Auth 를 마지막에
    두는 이유는 계정이 먼저 사라지면 규칙의 `request.auth.uid` 가 안 맞아 남은 데이터를
    영영 못 지우기 때문이다.
  - 삭제 대상은 **로컬 `sets` 가 아니라 클라우드 컬렉션을 실제로 읽어서** 정한다
    (다른 기기에서 만들고 아직 안 내려온 문제집이 남지 않게). Firestore 배치는 400개씩 끊는다.
  - 이미지는 `sets` 안의 URL 이 아니라 `users/{uid}/images` 를 `listAll()` 로 훑어 지운다
    (정리에 실패해 남은 고아 파일까지 포함하려면 폴더를 직접 봐야 한다).
  - ⚠️ **`firestore.rules` 의 `users/{uid}` 는 `create, update` 와 `delete` 를 나눠 뒀다.**
    예전처럼 `allow write` 하나로 묶으면 삭제 요청에는 `request.resource` 가 null 이라
    `hasOnly(...)` 가 평가되지 못해 거부된다 — 계정 삭제가 이 문서만 못 지우고 남긴다.
  **로컬 키는 전부 계정별로 갈라져 있다** — `setsKey()`, `backupKey()`, `lastQKey()`,
  `stampsKey()`, `lastSetKey()`. 새 로컬 키를 추가할 때도 반드시 uid 를 붙일 것(공용 키로 두면 한 브라우저에서
  계정을 바꿨을 때 데이터가 샌다).
  Firebase project config (`firebaseConfig`) is a public web API key, not a secret.
  ⚠️ **`firestore.rules` 의 필드 화이트리스트를 함께 고칠 것** — `sets/{setId}` 문서에
  필드를 추가하면 `hasOnly([...])` 목록에 넣어야 저장이 '권한 오류' 로 실패하지 않는다.
- **Undo/redo**: `pushHistory()`/`doUndo()`/`doRedo()` snapshot the *entire* `{sets,
  currentSetId, currentQId}` state as JSON strings — simple but means any state field that
  should be undoable must go through `sets`, not a side channel.
- **Image handling**: `storeImageFile()` uploads to Firebase Storage
  (`users/{uid}/images/...`) and stores just the download URL when signed in (keeps
  Firestore docs under the 1MB limit); when signed out it falls back to a
  resized/compressed base64 data URL via `compressDataUrl()`. `migrateBase64ToStorage()`
  lazily upgrades old base64-embedded images to Storage URLs on next save.
  `isStorageUrl()`/`isDataUrl()` distinguish the two representations wherever images are read.
  Answer images and block images (`type:"image"`) both go through this path.
  **업로드 상한은 5MB 이고 `storage.rules` 의 값과 반드시 같아야 한다**
  (`MAX_UPLOAD_BYTES` ↔ 규칙의 `request.resource.size`). 클라이언트 검사는 편의일 뿐
  실제 방어선은 규칙이다. 압축(`dataUrlToJpegBlob`)이 실패하면 **원본을 올리지 않고
  거절한다** — 예전엔 폴백으로 원본을 그대로 올려서, 확장자만 이미지인 파일이나
  크롬이 못 읽는 HEIC 가 크기 제한 없이 Storage 로 들어갔다.
  AI 로 보낼 때는 `prepImageForAI()` 가 긴 변 1568px·JPEG 0.8 로 줄인다. 1568 은
  모델이 실제로 보는 해상도 상한이라 그 이상 보내도 화질·토큰이 같고 업로드 시간만
  버린다. canvas 를 거치므로 아이폰 HEIC 도 JPEG 로 바뀌어 공급자가 받는다.
  ​Never inline real API keys/secrets for third-party services other than the already-public
  Firebase web config; the `AI_PROXY_URL` Cloudflare Worker endpoint exists specifically so
  the actual AI provider key stays server-side.
- **신뢰 경계 (중요)**: 가져온 `.json`, **AI 응답, 클라우드에서 읽은 데이터** 모두 신뢰하지
  않는다. `normSet()`/`normProblem()`/`normBlock()`이 화이트리스트로 정규화하고, 이미지
  URL은 `safeUrl()`이 Firebase Storage / `data:image` 로만 제한하며, `sanitize()`가
  `& < > " '`를 모두 이스케이프한다. `aiBlocksToProblem()` 도 `normProblem()` 을 거친다.
  `normSet(s, opts)` 의 `maxProblems` 기본값 500 은 **가져오기 전용 방어선**이다 —
  클라우드 데이터에 그 값을 쓰면 N제 문제집이 조용히 잘린다. `docToSet()` 처럼
  `{keepId:true, maxProblems:CLOUD_MAX_PROBLEMS}` 를 넘길 것.
  **새 렌더 경로를 추가하거나 사용자 값을 HTML 속성에 넣을 때는 반드시 이 헬퍼들을 거칠 것** —
  과거 이게 없어서 악성 문제집 파일 하나로 로그인된 Firestore 데이터를 읽어갈 수 있었다.
  블록 타입·`layout`·이미지 `size` 같은 열거값은 렌더 시점에도 한 번 더 고정한다.
  ⚠️ **가장 조심할 곳은 `processText()` 의 `$$…$$` 복원 단계다.** 본문은 `sanitize()` 를
  거치는데 수식 블록만 따로 빼놨다가 되돌려 넣기 때문에, 여기서 `sanitize()` 를 빠뜨리면
  `$$</div><img src=x onerror=…>$$` 한 줄로 XSS 가 뚫린다(실제로 그랬다).
  KaTeX 는 `textContent` 를 읽으므로 이스케이프해도 `cases` 의 `&`, 부등호, `array` 표가
  전부 정상 렌더된다 — **수식이 깨질까 봐 이스케이프를 빼면 안 된다.**
- **CSP · SRI**: `<head>` 에 CSP `<meta>` 가 있어 인라인 **이벤트 핸들러 속성**(`onerror=`)이
  차단된다(렌더 경로에 구멍이 생겨도 실행되지 않는 2차 방어선). CDN 태그에는 전부
  `integrity` 해시가 붙어 있다 — **버전을 올리면 해시도 반드시 다시 계산할 것**
  (`openssl dgst -sha384 -binary <파일> | openssl base64 -A`). 새 외부 호스트를 부르게 되면
  CSP 의 `connect-src`/`img-src`/`font-src` 에도 추가해야 한다.
  Pretendard 는 `<link>` 로 부른다 — `<style>` 안 `@import` 는 CSS 규격상 `@font-face` 보다
  뒤에 오면 통째로 무시되어, 예전엔 본문이 계속 시스템 고딕으로 렌더됐다.
- **AI-assisted problem entry**: `aiGenerateFromImage()` posts a photographed problem image
  to a Cloudflare Worker proxy (`AI_PROXY_URL`), which returns structured `blocks`;
  `aiBlocksToProblem()` converts the response into the normal problem shape and appends it
  to the current set.
- **Render pipeline**: `renderPreview()` builds live HTML preview from a problem's blocks;
  `processText()`/`autoDisplayStyle()` do LaTeX/typography preprocessing (auto `\displaystyle`,
  spacing rules) before KaTeX renders `$...$` spans (KaTeX auto-render is re-run after each edit).
  `buildPrintDoc()` builds a separate print-specific DOM (`#printDoc`) consumed by
  `doPrint()`/`window.print()` for the "인쇄/PDF 저장" export flow — this is a **distinct**
  layout pass from the on-screen preview (multi-column typesetting, answer-key toggling), so
  changes to block rendering usually need to be made in both places.

### mock-exam-editor.html (모의고사 editor)

Also vanilla JS, single inline script, fully self-contained (own KaTeX include, own state,
own save/load — does not share PEDAGOGY's Firebase storage).

- **Data model**: `state.problems` is a fixed array of 30 (extendable to 60) slots from
  `blank(n)` — `{id, num, sect, type, pts, stmt, conds, useCond, choices, layout, figure,
  breakAfter}` — pre-seeded with Korean-CSAT-style scoring (`PTS`) and section rules
  (문항 1–22 공통, 23–30 선택; 문항 1–15/23–28 5지선다, 나머지 단답형).
- **Persistence**: no localStorage — `saveJSON()`/`#loadInput` export/import a `.json` file
  directly (there's a `beforeunload` guard warning about unsaved changes instead).
- **Two-stage rendering**:
  1. `renderPreview()` (backed by `layoutOf()`/`renderProb()`/`buildPages()`) — an
     in-browser approximate layout using CSS/canvas text measurement (`measureCh()`) to
     mimic the real exam's column/character-count rules.
  2. `typstSource()`/`probTypst()`/`sheetTypst()` — convert the same state into actual Typst
     markup (`texToTypst()` converts LaTeX to Typst math syntax), sent to `serve.py`'s
     `/render` endpoint by `doRender()` when "실시간 정본 미리보기" (live mode) is on
     (`pingServer()` checks `serve.py` is reachable first, `LIVE.cache` avoids
     re-transferring unchanged page images by hash).
  Both paths must stay in sync with the state model; the Typst path is the one that produces
  the actual exportable/printable document, the CSS path is only an approximation for when
  the local server isn't running.
- **그림 경로**: `probTypst()` 는 `#image("/파일명")` 처럼 **앞에 `/` 를 붙여** 낸다.
  Typst 에서 `/` 는 '루트 기준' 이라, 실시간 렌더에서는 `--root` 인 `work/` 를,
  내보낸 `.typ` 을 직접 컴파일할 때는 그 `.typ` 이 있는 폴더를 가리켜 **양쪽 다 맞는다**.
  상대경로로 두면 실시간에서 절대 못 찾는다 — `serve.py` 가 `main.typ` 을 `work/` 밑
  **임시 폴더**에 쓰기 때문에 `work/fig.png` 를 둬도 `work/tmpXXXX/fig.png` 를 뒤진다.
- Keyboard shortcuts: ⌘S save JSON, ⌘E export Typst, ⌥↑/↓ move between problems.
- **한글(HWPX) 내보내기 — 베타.** 툴바의 `한글 내보내기` 가 `serve.py` 의 `POST /hwpx` 를
  부르고, 변환은 `experiments/hwp-export/` 의 파이썬이 한다(**제품이 아니다**).
  실물 시험지 `.hwpx` 를 '틀' 로 읽어 머리말·2단·스타일을 그대로 물려받고 본문만 채운다.
  Typst 경로와 달리 **글꼴을 배포하지 않으므로** 상용 글꼴 라이선스 문제가 없다 —
  사용자가 자기 한글로 열어 PDF 로 뽑는다.
  ⚠️ `/hwpx` 는 `/render` 와 **같은 보안 관문**(Host·Origin·`X-Exam-Client`·본문 크기)을
  지난다. 새 POST 경로를 만들 때 그 검사를 건너뛰지 말 것.
  ⚠️ 변환기는 편집기의 `probUnits()`·`buildPages()`·`layoutOf()` 를 **옮겨 적은 사본**이다.
  편집기 쪽 규칙이 바뀌면 `experiments/hwp-export/mock_to_hwpx.py` 도 같이 고쳐야 한다
  (`test_layout.py` 가 그 일치를 검사한다).
  - **공통과 선택은 서로 다른 구역(section)이다.** 틀 파일에 구역이 둘 있고
    (`section0` 공통 · `section1` 선택), 선택 구역의 머리말이 `수학 영역(확률과 통계)` 이며
    쪽번호가 1 부터 다시 매겨진다. 편집기의 `buildPages()` 도 공통→선택에서 반드시 새 쪽
    왼쪽 단부터 시작한다. `build()` 가 `CUR["sec"]` 로 어느 구역에 쓸지 정하고,
    **모든 `doc.*` 호출이 그 값을 함께 넘긴다** — 하나라도 빠지면 그 조각만 공통 구역으로
    떨어져 선지나 그림만 앞 쪽에 남는 식으로 조용히 깨진다(`test_sections.py`).
    선택과목 이름은 `template.set_masthead_elective()` 가 넣는다. 안 하면 사용자가 미적분을
    골라도 틀에 박힌 `확률과 통계` 가 인쇄된다.
  - **선지 배치는 편집기가 정해서 보낸다.** 편집기는 KaTeX 로 실제 렌더 폭을 재지만
    (`measureCh`) 파이썬은 못 잰다. 그래서 `toHwpx()` 가 `hwpxPayload()` 로 문항마다
    `layoutResolved`(`'1'|'2'|'v'`)를 실어 보내고, 변환기는 그 값을 최우선으로 쓴다.
    ⚠️ `hwpxPayload()` 는 **반드시 사본을 만들어** 필드를 붙인다. `currentData()` 의
    `problems` 는 `state.problems` 그 자체라, 여기에 쓰면 저장 JSON 과 임시저장까지 오염된다.
    변환기의 어림(`_text_mm`/`_math_mm`)은 CLI·손으로 쓴 JSON 용 대비책이다 — `$…$` 는
    마크업이 아니라 **조판된 모습**으로 재야 한다(글자를 그대로 세면 분수 하나가 30mm 를
    넘어 멀쩡한 선지가 세로로 떨어진다).
  - **변환기는 서버가 켜질 때 한 번만 불러온다**(`serve.py` 의 `load_hwpx()`).
    ⚠️ 요청마다 `importlib.reload()` 하면 안 된다 — 이 서버는 `ThreadingHTTPServer` 라
    한 요청이 `build()` 를 도는 사이 다른 요청이 모듈을 갈아 끼울 수 있다. 변환기를 고쳐
    가며 실험할 때만 `python3 serve.py --reload-hwpx` 로 예전 동작을 켠다.
  - **문항 번호 뒤는 공백이 아니라 탭이다**(`num_prefix_xml()`). 실물은 한 자리에 탭
    하나(636), 두 자리에 탭 둘(132·671)을 써 발문 시작 위치를 맞춘다. 공백으로 두면
    한 자리·두 자리 문항의 발문이 어긋나 번호만 삐뚤어 보인다.
  - **쪽나눔을 직접 내보낸다**(`page_starts()` — 편집기 `buildPages()` 와 같이 '단 두 개가
    한 쪽'). 한글의 자동 흐름에 맡기면 편집기와 쪽이 어긋나고, 무엇보다 **이어지는 쪽
    머리말을 붙일 자리를 알 수 없다.**
    ⚠️ **쪽나눔을 준 문단에 단나눔까지 주지 말 것** — 한글이 둘 다 수행해 새 쪽의 왼쪽
    단이 통째로 빈다.
  - **이어지는 쪽 머리말은 masterpage 가 아니라 본문에 있다.** 실물은 2쪽 첫 문단의
    `<hp:ctrl><hp:header>` 에 한 번 두고 뒤 쪽이 물려받는다. `clear_body()` 가 그 문단을
    지우므로 `template.capture_page_headers()` 가 **비우기 전에** 떠 두었다가 `build()` 가
    구역마다 첫 쪽나눔 문단에 도로 넣는다. 안 넣으면 **2쪽부터 시험지 형식이 사라진다.**
    ⚠️ `set_masthead_elective()` 는 `수학 영역(…)` 을 **모두** 고쳐야 한다 — 첫 것만
    고치면 표지만 미적분이고 이어지는 쪽 머리말은 틀의 `확률과 통계` 로 인쇄된다.
    머리말은 문항을 다 쓴 뒤에야 문서에 들어가므로 그때 **한 번 더** 불러야 한다.
  - **문항별 단 배치는 실물에서 가져왔다**(편집기 `COL_SOLO`). 실물은 앞쪽 쉬운 문항만
    둘씩 묶고 뒤로 갈수록 한 단에 하나씩 둔다 — 둘씩인 것은 {1,2} {3,4} {5,6} {8,9}
    {16,17} {18,19} 뿐이고 나머지는 단독이다(선택 23~30 은 전부 단독). 공통 8쪽 +
    선택 4쪽 = 12쪽으로 실물과 같다.
    ⚠️ `blank(n)` 이 `breakAfter` 를 그 값으로 초기화할 뿐이다 — **기본값이고**, 사용자가
    순서도에서 켜고 끌 수 있다. 표를 변환기에 베끼지 말 것(`breakAfter` 가 JSON 에 실려
    온다). `samples/full-exam.json` 도 같은 값이어야 CLI 와 편집기가 같은 배치를 낸다.
  - **한 단 안에서 문항을 벌린다.** 실물도 편집기도 단을 균등하게 나눠 각 문항을
    **자기 칸 맨 위**에 둔다(편집기 CSS `repeat(n,1fr)` · Typst `rows: (1fr,) * n`).
    파이썬은 글꼴 실측을 못 하므로 **편집기가 `measureProblemHeights()` 로 재어
    `heightMm` 으로 보내고**, 변환기 `pad_lines()` 가 `칸 − 문항` 을 빈 문단으로 메운다.
    ⚠️ **높이가 없으면 벌리지 않는다**(CLI 대비책). 어림으로 넣으면 하나만 많아도 다음
    문항이 다음 단으로 밀려 배치가 통째로 어긋난다 — 없는 것보다 나쁘다.
    ⚠️ 내림으로 자르고 `emit_problem()` 이 늘 붙이는 빈 문단 한 줄을 뺀다. 단의 마지막
    문항 뒤는 벌리지 않는다. 한 줄 높이는 틀에서 읽는다(`read_body_line_mm()`).
  - **조건 상자 안에서 수식만 있는 줄은 별행 수식**이다(발문과 같은 규칙).
    유닛을 나누지 않고 `cond` 유닛 안에서 `kinds:['text','eq',…]` 로 표시한다 —
    ⚠️ 따로 유닛을 내면 **상자가 쪼개진다**(`cond` 유닛 하나 = 상자 하나).
    `items` 는 문자열 배열 그대로 둘 것(원소를 객체로 바꾸면 내용을 훑는 곳이 터진다).
    ⚠️ Typst 에서 **`#align(left)` 로는 별행 수식이 왼쪽에 안 붙는다** — 블록 수식은
    스스로 가운데로 간다. `TYPST_FRAME` 의 `condeq`(show 규칙)를 거칠 것.
  - **구획 태그(`단답형`)와 `※ 확인 사항` 은 문단이 아니라 표 개체다.**
    ⚠️ 크기·테두리를 지어내지 말 것 — `template.capture_marks()` 가 `clear_body()` **전에**
    실물 표를 통째로 떠 두고 변환기가 도로 심는다(머리말과 같은 방식).
    `5지선다형` 은 **틀의 표제부에 이미 있다** — 다시 넣으면 두 번 나온다.
    · 태그는 첫 단답형 문항 **앞** 문단에 오고 그 문단이 단나눔·쪽나눔·이어지는 쪽
      머리말을 안는다. 태그가 단 위에서 먹는 **15.9mm** 는 그 단의 위 여백이 된다
      (⚠️ `read_column_tops_mm()` 과 이중으로 세지 말 것 — 그쪽 값은 태그 문단 자리다).
    · `※ 확인 사항` 은 **쪽 기준 절대배치**라 흐름에 자리를 차지하지 않는다. 어느 문단에
      매다느냐가 '몇 쪽에 나오는가' 만 정하므로 **그 구역 마지막 쪽**의 문단에 매단다.
    ⚠️ 상자 글은 실물 것을 그대로 쓰고 **과목 이름만** 갈아 끼운다. `※` 는 기호 글꼴로
      찍힌 `*` 라 유니코드로 바꾸면 모양이 달라지고, `「」` 와 과목 이름은 **다른 run** 이라
      `「선택과목(…)」` 을 통째로 찾으면 못 찾는다.
  - **발문 아래 별행 수식은 탭 하나로 14.11mm 에서 시작한다**(`EQ_TAB_WIDTH`).
    실물 `21 문제다음 별행` 문단의 왼쪽 여백은 4.06mm 인데 탭 정지점이 LEFT 14.11mm
    하나뿐이고, **수식으로 시작하는 그 문단 19개가 전부** 탭을 앞에 둔다(직접 세었다).
    ⚠️ **상자 안(`condeq`)에는 탭이 없다** — 같은 별행 수식이라도 쓰임이 다르다.
    ⚠️ 같은 스타일의 **산문 이어짐 줄에도 탭이 없다.** '스타일이 같으면 조판도 같다'
       고 보면 틀린다 — 문단의 **내용이 무엇으로 시작하는가**가 가른다.

### 범용 문서(HWPX) — `document-editor.html` · `experiments/hwp-export/document_*.py`

모의고사와 **별개의 흐름**이다. 학습지·보고서·안내문처럼 시험지가 아닌 한글 문서를 만든다.

```
사용자 요청 → Worker(AI) → 문서 JSON → 브라우저 검증·미리보기 → .hwpx
```

**한글 내보내기는 브라우저가 직접 한다 — 로컬 서버가 필요 없다.**
`hwpx-engine.js`(엔진·수식 변환) + `hwpx-document.js`(블록 → 문단)가 파이썬을 옮긴 것이고,
`serve.py` 의 `/document-hwpx` 는 이제 대비책이다(브라우저 조판이 실패할 때만 탄다).
빈 골격은 `templates/blank.hwpx` 를 **fetch 로 받아** 쓴다 — 그래서 `serve.py` 의 `STATIC`
에 그 경로가 있어야 하고, 빼면 로컬에서 404 로 죽는다.

⚠️ **JS 는 파이썬의 사본이다. 사본은 갈라진다.** `npm run test:hwpx-browser` 가 같은 문서
JSON 을 진짜 브라우저(Playwright)와 파이썬에 넣어 결과를 대조한다(CI 의 `hwpx` 작업에
`HWPX_REQUIRE=1` 로 걸려 있다). 한쪽만 고치지 말 것.

⚠️ **시험지도 브라우저가 직접 만든다 — 서버가 필요 없다.**
`hwpx-exam-template.js`(틀 읽기·떠 두기) + `hwpx-exam.js`(문항 방출·배치·조립)가
`mock_to_hwpx.py` 를 옮긴 것이고, `serve.py` 의 `/hwpx` 는 이제 **대비책**이다.
틀(`templates/exam-math.hwpx`)은 저장소에 있고 `fetch` 로 받는다 — 그래서 `serve.py` 의
`STATIC` 에 그 경로와 두 `.js` 가 있어야 하고, 빼면 로컬에서 404 로 죽는다.
⚠️ **편집기의 `probUnits()` 를 그대로 쓴다** — 파이썬은 `prob_units` 사본을 안고 있지만
브라우저는 그럴 이유가 없다. `hwpxPayload()` 가 `units`·`ptsAt` 을 함께 실어 보낸다.
⚠️ **그림은 문서에 담아 보낸다.** 편집기의 그림 블록이 파일을 골라 **데이터 URL**
(`data`)로 들고 있고, 두 조판기가 **데이터를 먼저** 본다 — 그러면 서버가 필요 없다.
파일 이름(`src`)은 그대로 둔다: Typst 실시간 미리보기는 여전히 `work/` 안 파일을 쓴다.
⚠️ **이름만 있고 데이터가 없는 그림은 서버로 넘긴다**(`PedagogyExam.needsServer()`) —
그 파일은 서버만 읽을 수 있다. 안 가르면 그림이 빠진 시험지가 **조용히** 나간다.
⚠️ 데이터 URL 은 **화이트리스트**(PNG·JPEG)로만 받고 크기 상한(2MB)을 정규화에서 다시 본다
— 가져온 `.json` 은 신뢰하지 않는다.
⚠️ **`imageSize()` 의 모양이 양쪽에서 다르다** — JS 는 `{width,height}` 객체, 파이썬은
튜플이다. 파이썬처럼 `size[0]` 으로 읽었더니 그림이 늘 자리표시로만 나갔다(대조가 잡았다).
⚠️ 사본은 갈라지므로 `npm run test:hwpx-exam` 이 같은 payload 를 양쪽에 넣어 **완성된
section XML 을 통째로** 견준다(틀 읽기 22값 · 문단 13개 · 배치 7표본 · 표 개체 · 시험지 한 부).

⚠️ **틀을 다시 만들 때 `clear_body()` 를 쓰면 안 된다.** 변환기가 본문에서 떠 가는
이어지는 쪽 머리말·구획 태그 표가 사라지고, 발문 문단이 없어져 **문항 번호가
13.5pt → 11.5pt** 로 작아진다(실측: `charPrIDRef 23` → `12`). `strip_to_frame()` 이
**run 단위로** 갈라 틀 개체가 든 run 만 남긴다 — 표제부 표와 1번 발문이, 이어지는 쪽
머리말과 5번 발문이 **같은 문단**에 있어서 문단 단위로는 못 가른다.
⚠️ **구조 표시(`1.`·`①`)를 채움글자로 덮지 말 것** — `classify()` 가 그 글자로 문단
갈래를 읽는다. 낱말만 '가' 로 바꾸고 숫자·마침표·①~⑤ 는 남긴다.
⚠️ **`<hp:script>`(수식)도 지워야 한다.** 처음엔 `<hp:t>` 만 봐서 **원본 수식 522개가
그대로 남았다**(`REV-2026-030`) — 글자가 아니라고 내용이 아닌 것이 아니다.
⚠️ **이 노드 API 는 `.iter()` 마다 새 래퍼를 만들어 `id()` 가 매번 다르다.** '개체 안쪽
노드' 를 `id()` 집합으로 모으려다 **모든 `<hp:t>` 가 안쪽으로 판정돼** 아무것도 안 지워졌다.
정체성이 아니라 **내려가며 깃발을 들고 가는 구조 순회**로 가를 것.
⚠️ **'찾을 것을 나열하는' 검사는 나열하지 않은 것을 통과시킨다.** `leftovers()` 가 금칙어
네 개만 찾아 **빈 목록을 돌려주면서** 위 522개를 놓쳤다. 지금은 뒤집어서 **허용한 것
말고는 전부 실패**로 본다. 선택과목이 **세 갈래 다**(확률과 통계·미적분·기하) 들어 있으니
과목 이름은 패턴으로 받을 것.
⚠️ **만드는 것을 검사한다고 배포되는 것이 검사되지는 않는다.** 기능 검사 11건이 전부
초록불인데 틀 파일 자체가 더러웠다. `test_template_content.py` 가 **배포용 틀 자체**를 보고,
원본 조각을 심어 빨간불이 되는지 스스로 확인한다.
⚠️ 만든 사람 이름은 본문이 아니라 **개체마다 `<hp:shapeComment>`** 에 박혀 있다(532곳).
미리보기 글(`PrvText.txt`)에는 **문제 전문**이, 썸네일에는 첫 쪽이 들어 있다.
`strip_identity()` 가 그 셋과 작성자 메타를 지운다. `make_exam_template.py` 가 만든 뒤
**다시 훑어 확인한다**(만드는 코드와 확인하는 코드를 갈라 둔다).
⚠️ 검증: 벗긴 틀로 만든 시험지가 실물 틀로 만든 것과 **section0·section1·header·
masterpage 전부 바이트까지 같다.** 오히려 **실물 틀로 뽑으면 결과물의 `Preview/` 에
원본 2025 수능 문제 전문과 썸네일이 실려 나간다** — 결과물로 봐도 벗긴 틀이 낫다.

- **계약이 제품이다.** `document_schema.py` 가 받는 블록만 조판된다. 지금 11종:
  `heading` `paragraph` `equation` `quote` `bullets` `numbered` `table` `image` `box`
  `examples`(ㄱㄴㄷ 보기) `choices`(①②③④⑤ 선지).
  아직 없는 것: 각주 · 쪽 나눔 · 머리말꼬리말 · 상자 안의 표·그림 · 지문(passage).
- **엔진은 우리 것이다.** `pedagogy_hwpx.py` 가 HWPX 를 직접 만든다. 런타임 의존성은
  `lxml` 하나뿐이고, `test_internal_runtime.py` 가 `jakal_hwpx` import 를 막은 채로
  내보내기가 되는지 확인한다(예전에 그 라이브러리를 쓰다 걷어냈다).
- 모의고사(`mock_to_hwpx.py`)와 **엔진·수식 변환기(`tex_to_hwp.py`)·라벨(`MARKS`·`HGND`)을
  공유**한다. 선지 **배치**는 공유하지 않는다 — 시험지는 2단 폭(111mm)에 맞춰 실물에서 잰
  탭 위치를 쓰고 일반 문서는 기본 탭을 쓴다.

⚠️ **새 블록 하나는 네 곳을 함께 고쳐야 실제로 쓸 수 있다.**
`document_schema.py`(계약) · Worker 프롬프트 · Worker 검증(`validateDocumentResponse`) ·
`document-editor.html`(검증 + 미리보기). 한 곳만 늘리면 **AI 가 정확히 만들어도 Worker 가
502 로 버리고 브라우저에서도 막힌다**(`REV-2026-013` 에서 실제로 그랬다).
`npm run check:static` 안의 `check-document-blocks.mjs` 가 네 곳을 대조한다.
⚠️ 넷이 **똑같지는 않다** — `image` 는 계약·브라우저에만 있다. AI 가 base64 그림을 만들 수
없기 때문이고, 그 예외는 그 검사에 명시돼 있다.

⚠️ **그림은 base64 로만 받는다. 파일 경로를 받지 않는다.** `/document-hwpx` 의 보안 전제다
(모의고사 `/hwpx` 는 서버가 허용한 `work/` 안 파일만 읽는다 — 전제가 다르다).
형식은 확장자가 아니라 **바이트를 보고** 정한다. 크기 상한(`MAX_IMAGE_BYTES`)은
`serve.py` 의 `MAX_BODY` 에서 **역산한 값**이다 — base64 가 4/3 로 커지므로 둘을 따로 정하면
"계약은 통과했는데 413" 이 된다(`REV-2026-014`).

⚠️ **두 화면의 디자인 토큰은 같아야 한다.** 빌드 단계가 없어 각 `.html` 이 CSS 를 통째로
안고 있고, 베낀 것은 갈라진다. `check-shared-design.mjs` 가 `index.html` 과
`document-editor.html` 의 `:root` 토큰과 **테마 저장 키(`PM_THEME`)** 를 대조한다.
키가 다르면 본체에서 어둡게 해 두고 넘어왔을 때 갑자기 밝아진다.

#### 빈 문서 골격은 실물 파일이다 — 코드로 만들지 말 것

`HwpxDocument.blank()` 는 `templates/blank.hwpx`(한글이 직접 저장한 빈 문서)를 연다.

⚠️ **코드로 지어 만들면 한글이 열지 못한다.** 두 번 시도했고 두 번 다 실패했다. XML 문법은
완벽하고 우리 검증도 전부 통과하는데 한글은 **"파일을 읽거나 저장하는데 오류가 있습니다"**
한 줄만 말한다. 국가표준(KS X 6101)을 확보해 규격대로 다시 만들어 봐도 열리지 않았다
(`fontfaces` 제거 / `type="HFT"` / 최소 헤더 세 변형 모두 실패). 자세한 것은
[`docs/HWP-SPEC.md`](docs/HWP-SPEC.md).

골격을 바꿔야 하면 **한글에서 직접** 새 빈 문서를 `.hwpx` 로 저장해 갈아 끼우고 개인정보를
지운다. `template.py` 가 시험지 틀에 대해 내린 것과 같은 결론이다.

#### 새 요소는 '알아내는 방법' 이 정해져 있다 — 추측으로 XML 을 짓지 말 것

[`docs/HWPX-ELEMENT-SPECS.md`](docs/HWPX-ELEMENT-SPECS.md) 에 **요소별 근거와 알아내는
절차**를 모아 뒀다. 요약 — ① 그 요소가 든 `.hwpx` 를 만든다(한글 UI 또는 `python-hwpx`)
② `npm run test:hwpx-opens` 로 **한글이 받아 주는지** 본다 ③ 통과했을 때만 XML 을 근거로
삼는다(`blank.hwpx` 와 요소 집합을 차집합하면 금방 찾힌다) ④ 우리 엔진으로 같은 것을 낸 뒤
다시 열어 보고 **PDF 를 뽑아 눈으로 본다.**
⚠️ ④ 를 건너뛰지 말 것 — 조합 기호가 **열리는데 빈칸으로 인쇄되던** 결함이 그 단계에서만
드러났다. 지금 근거가 확보된 것은 **쪽나눔**(`pageBreak="1"`)과 **각주**(`<hp:ctrl><hp:footNote>`)다.
⚠️ **새 블록 하나는 여덟 곳을 고쳐야 쓸 수 있다**(파이썬·JS 각 네 곳). 그 표도 그 문서에 있다.

#### 규격서가 공개돼 있다 — 추측하지 말 것

[`docs/HWP-SPEC.md`](docs/HWP-SPEC.md) 에 받는 곳과 배포 조건을 적어 뒀다.
HWPX 는 **KS X 6101 국가표준**이고 한컴이 수식·차트 규격서를 무료 배포한다.
`tex_to_hwp.py` 의 대응표는 이제 그 규격서 기반이다(추측으로 만들었던 것이 실제로 네 군데
틀렸다 — `vmatrix` 는 없는 명령, **9자 넘는 낱말은 두 항으로 쪼개진다** 등).

⚠️ 수식 규격서의 저작권 조항이 **출처 고지를 요구한다.** 소스에는 넣었고(`tex_to_hwp.py`
첫 주석) **화면·매뉴얼에도 넣었다(2026-09-09).**
⚠️ **문구를 바꾸지 말 것** — 규격서가 문장을 그대로 지정한다:
「본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.」
조항은 **유저인터페이스·매뉴얼·도움말·소스에 모두** 요구하므로, `check:static` 이 여섯 곳을
대조한다 — 한 곳만 지워도 빨간불이다.

### serve.py

Deliberately locked down (see the security comment block at the top of the file) since it
executes a subprocess (`typst compile`) based on user-supplied source: binds to 127.0.0.1
only, checks `Origin` against an allowlist, requires a custom `X-Exam-Client` header on
`POST /render`, caps body size and compile time, restricts `typst --root` to the `work/`
directory, and never uses `shell=True`. Preserve these constraints when modifying it —
they're the whole reason this is safe to run as a local dev server that a remote GitHub
Pages–hosted `index.html` can also call into (via `--allow-origin`).

## 남은 일 — 문제집 편집기 쪽 (2026-08-24 감사 기준)

⚠️ 이 절은 **문제집 편집기(`index.html`) 이야기**다. HWPX 쪽 현황은 맨 위
'지금 어디까지 왔나' 와 `reviews/INDEX.md` 를 볼 것.

2026-08-24 감사에서 지적된 항목은 아래 '처리 완료'를 빼고 모두 반영했다.

⚠️ `ANALYSIS.md`(2026-08-20 코드 분석)는 **지웠다**(2026-09-06). 줄 수가 2.8배 어긋났고
(`index.html` 2073줄이라고 적혀 있는데 실제 5902줄), 무엇보다 **버려진 저장 구조**
(`users/{uid}` 문서 하나에 `sets` 배열)를 설명하고 있었다 — 1MB 한도와 다중 탭 덮어쓰기
때문에 일부러 서브컬렉션으로 옮긴 그 구조다. 낡은 문서는 없는 것보다 나쁘다.
필요하면 `git log -- ANALYSIS.md` 로 꺼내 볼 수 있다.

### 코드 밖 — 반드시 해야 할 것 (남은 최우선 항목)

- ✅ **`firestore.rules` / `storage.rules` 배포 완료 (2026-09-09).**
  `firebase deploy --only firestore:rules,storage --project pedagogy-huryul` 로 올렸고,
  올리기 전에 `npm run check:rules`(에뮬레이터)로 검증했다.
  ⚠️ **그때까지 Firestore 규칙은 실제로 배포돼 있지 않았다** — 배포 출력이 갈라 말해 준다:
  `storage: already up to date, skipping upload` / **`firestore: uploading rules…`**.
  그래서 `libraryCloudSchema` 를 보수적으로 0 으로 두었던 판단이 맞았다(1 이었다면 로그인
  사용자의 저장이 전부 '권한 오류' 로 실패했다). 배포 뒤 **1(B단계)로 올렸다.**
  ⚠️ **배포된 규칙을 읽는 CLI 명령은 없다**(`firebase firestore:*` 에 없고 `deploy` 에
  `--dry-run` 도 없다). 상태를 알고 싶으면 콘솔을 보거나 그냥 다시 배포하는 수밖에 없다.
  비로그인 REST 읽기로 `403 PERMISSION_DENIED` 인 것은 확인할 수 있다(테스트 모드로 열려
  있지 않다는 것까지만 알려 준다).
  - 콘솔: Firestore Database → 규칙 / Storage → 규칙
  - CLI: `firebase deploy --only firestore:rules,storage`

  ⚠️ **아래 두 가지는 배포로 이미 해소됐다** — 규칙을 또 고치면 다시 올려야 한다.

  ⚠️ **`firestore.rules` 가 크게 바뀌었었다** — 저장 구조가
  `users/{uid}` 문서 하나에서 `users/{uid}/sets/{setId}` 서브컬렉션으로 옮겨졌다.
  **새 규칙을 배포하지 않으면 로그인 사용자의 저장이 전부 '권한 오류' 로 실패한다.**
  배포 후 반드시 이 순서로 확인할 것:
  로그인 → 문제집 저장(✓ 저장됨 확인) → 이미지 첨부 → 새로고침 후 내용 유지 →
  문제집 삭제 → 새로고침해도 되살아나지 않는지.

  ⚠️ **'계정 삭제' 기능을 넣으면서 `firestore.rules` 가 또 바뀌었다.**
  `users/{uid}` 의 `allow write` 를 `allow create, update` + `allow delete` 로 쪼갰다
  (이유는 위 '데이터 관리' 항목 참고 — 안 쪼개면 계정 삭제가 이 문서를 못 지운다).
  **이 규칙을 배포하기 전까지는 계정 삭제가 `users/{uid}` 문서 하나를 남긴다.**
  문제집·이미지·Auth 계정은 정상적으로 지워지므로 데이터가 새지는 않지만,
  빈 문서가 콘솔에 남는다. 배포 후 확인:
  계정 삭제 → Firestore 콘솔에서 `users/{그 uid}` 가 통째로 사라졌는지 · Storage
  `users/{그 uid}/images` 가 비었는지 · 그 구글 계정으로 다시 로그인하면 새 계정처럼
  빈 상태로 시작하는지.

- **첫 로그인 시 자동 이관이 일어난다.** 기존 `users/{uid}.sets` 배열을 읽어
  서브컬렉션으로 복사한다. **구버전 문서는 지우지 않는다**(안전망).
  이관이 잘못돼도 콘솔에서 예전 문서를 그대로 볼 수 있다.

- **AI Worker 를 다시 배포할 것.** `worker/index.js` 의 배포 안내가 `AI_API_KEY` 로
  적혀 있었는데 코드는 `ANTHROPIC_KEY` 를 읽는다. 문서만 고쳤으므로 동작에는 영향이
  없지만, 그 안내를 보고 secret 을 새로 넣었다면 이름을 확인할 것.

### 자료 추가 필요
- **브랜드 글꼴 파일이 레포에 없다**: `Adobe Caslon Pro Bold.ttf`.
  `serve.py` 화이트리스트 등록과 `local()` 폴백은 끝났으므로, 시스템에 설치돼 있으면
  이미 정상 표시된다(없으면 콘솔에 404 하나가 뜬다 — 기능에는 영향 없음).
  파일을 레포에 넣으면 배포본(GitHub Pages)에서도 적용된다.
  넣지 않을 거면 `index.html` 의 `@font-face` 와 `serve.py` 의 STATIC 항목을 지울 것.

### 글꼴 라이선스 (코드 밖 · 미해결)
- `docs/FONT-LICENSE.md` 의 견적 문의를 아직 보내지 않았다. 상용화 전 필수.
  참고: serve.py 의 `/font/` 는 이제 Host 검사로 외부에서 못 받아간다 —
  "글꼴 파일이 사용자에게 전송되지 않는다"는 견적 전제가 이제 실제로 참이다.

### 의도적으로 하지 않은 것 (이유 포함)
- **Undo/Redo 를 문항 단위 diff 로 재작성하지 않았다.** 실측해 보니 문항 하나가
  약 568 B 라 300문항이어도 한 스냅샷이 ~170 KB, `JSON.stringify` 는 1~2 ms 수준이다.
  체감 지연의 원인이 아니었다. 핵심 문제였던 **메모리 상한이 `redoStack` 에
  적용되지 않던 버그**는 고쳤다(`trimHistory()` 가 두 스택을 합쳐서 센다).
  실제로 타이핑 지연이 관찰되면 그때 diff 로 가는 게 맞다.
- **ES module 로 파일을 쪼개지 않았다.** ES module 은 `file://` 에서 CORS 로 막혀,
  "파일을 그대로 열어서 쓴다"는 이 저장소의 전제가 깨진다. 대신 파일 안에서
  이스케이프 정책을 한곳으로 모으고 저장 계층을 분리했다.
  쪼갤 거라면 로컬 서버 사용을 전제로 바꾸는 결정이 먼저다.

### 더 깊게 손보고 싶다면 (선택)
- ~~**모의고사 편집기의 근사 미리보기와 Typst 정본**: 두 경로가 여전히 별도 코드다.~~
  → **해결됨.** `paintProblem(p, 팔레트)` 이 유닛 순회를 한 곳에서 맡고,
  `PAINT_HTML` / `PAINT_TYPST` 가 '칠하는 법' 만 내놓는다. 새 유닛 종류가 생기면
  팔레트에 메서드 하나씩만 더하면 된다(순회 로직을 양쪽에 베끼지 않는다).
  ⚠️ **최종 마크업까지는 합칠 수 없다** — HTML 과 Typst 는 문법이 다른 조판
  엔진이라 한 문자열이 양쪽에서 동작하지 않는다. 합칠 수 있는 건 여기까지다.
  ⚠️ 이 통합을 되돌리지 말 것. 회귀 스위트가 팔레트에 빠진 메서드와
  `renderProb`/`probTypst` 가 `paintProblem` 을 거치는지를 검사한다.
- **AI Worker 의 일일 한도**는 `DailyQuota` Durable Object가 예약·사용 확정으로 직렬화한다.
  외부 AI 요청 전에 사용량을 세고, 48시간 alarm·계정 삭제로 기록을 파기한다.
  `worker/wrangler.toml`의 Durable Object 바인딩과 migration을 지우거나 KV 방식으로
  되돌리면 병렬 호출이 상한을 넘길 수 있으니, 변경 뒤에는 `node worker/quota.test.mjs`를
  반드시 실행할 것. 상용 배포 전에는 `docs/COMMERCIAL-LAUNCH.md`와
  `npm run check:launch`도 확인한다. 운영 시작 뒤 매일·매주 볼 것은
  [`docs/OPERATIONS-RUNBOOK.md`](docs/OPERATIONS-RUNBOOK.md) 에 있다.
- **본체 인쇄 경로와 미리보기의 축소 로직**이 여전히 별개다
  (`fitPrintDoc()` vs `fitMathIn()`) — 선지 줄바꿈 보정은 인쇄에만 있다.

### 2026-08-25 (6차) — 라이트하우스 (모바일)
`Performance 69 / A11y 90 / Best Practices 73 / SEO 91` 에서 출발.

- **렌더 차단 제거가 제일 컸다(실측 2,010ms).** Firebase SDK 4개와 SortableJS 가
  `defer` 없이 `<script src>` 라 파싱을 막고 있었다. LCP 요소는 '문제집 라이브러리'
  라는 h2 한 줄인데 6.3초가 걸렸다.
  ⚠️ **`defer` 를 붙이면 인라인 스크립트가 SDK 보다 먼저 돈다.** 그래서
  `firebase.initializeApp` 을 `initFirebase()` 로 빼고 `DOMContentLoaded` 에서
  `startApp()` 이 부른다. 이걸 안 하면 항상 오프라인 모드로 떨어진다.
- **흰 글자 위 파란 배경**(`#3182F6`)이 대비 3.71:1 로 AA(4.5:1) 미달이었다.
  `--blue-on-white-text:#2B6FD6`(4.83:1)를 따로 두고 글자가 얹히는 4곳에만 쓴다.
  테두리·포커스링은 브랜드색 `--blue` 를 그대로 둔다.
- `<main id="appMain">` 으로 세 뷰를 묶었다(랜드마크 없음 지적). `#printDoc` 은 밖.
- `meta description` 추가, 없는 `Adobe Caslon Pro Bold.ttf` 의 `url()` 제거
  (404 콘솔 오류 + 낭비 요청).

**고칠 수 없는 것 — 점수만 보고 쫓지 말 것**
- `third-party-cookies` 10개는 전부 `apis.google.com` 것이다. Firebase 구글 로그인이
  쓰는 iframe 이라 **인증 도메인을 자체 도메인으로 옮기지 않는 한 없앨 수 없다.**
- 콘솔 오류 3건 중 2건은 **크롬 확장 프로그램**이 blob: 스크립트를 주입하려다
  우리 CSP 에 막힌 것이다. 우리 코드 문제가 아니다(시크릿 창에서 재측정하면 사라진다).
  CSP 에 `blob:` 을 열어 주는 건 확장 하나 때문에 방어를 푸는 것이라 하지 않았다.

### 2026-08-25 (5차) — 성능 (실측 기반)
숫자는 전부 브라우저에서 잰 것이다. 추정치가 아니다.

| 대상 | 전 | 후 |
|---|---|---|
| 타이핑 1글자 로컬 저장 (2.9MB, 비로그인 이미지) | 6.1ms | **0.005ms** |
| 모의고사 타이핑 1글자 · 전체보기 | 78.4ms | **0.0ms** |
| 모의고사 타이핑 1글자 · '이 문항'(기본) | 8.2ms | **1.7ms** |
| 인쇄 보정 `fitPrintDoc` (300문항·수식 2100) | 1616ms | **265ms** |

- **로컬 저장 디바운스(150ms).** 예전엔 키를 칠 때마다 `sets` 전체를 동기로 썼다.
  텍스트만이면 0.1~0.5ms 라 문제없지만 base64 이미지가 섞이면 6.1ms 로 올라간다.
  **`flushLocal()` 로 창 닫기·탭 숨김·되돌리기·수동 저장·클라우드 업로드 직전에는
  즉시 쓴다** — 디바운스가 데이터 안전을 해치지 않게 하는 게 핵심이다.
  타이핑 경로(`saveSets`)만 `persistLocal()` 을 쓴다.
- **모의고사 전체보기 디바운스(220ms).** 한 글자마다 8쪽·30문항을 통째로 다시
  조립하고 있었다. LIVE 모드가 이미 하던 것과 같은 방식으로 미룬다. 모드 전환과
  순서도 클릭은 디바운스를 우회해 즉시 그린다. 순서도(`renderOutline`)도 문항마다
  `measureCh()` 로 KaTeX 를 105회 돌려 함께 미뤘다.
- **레이아웃 스래싱 제거.** 요소마다 '스타일 쓰기 → 크기 읽기' 를 번갈아 하면
  브라우저가 매번 레이아웃을 다시 계산한다. `shrinkWideMathAll()` 이 **전부 지우고
  → 전부 재고 → 전부 적용**한다. `fitPrintDoc()` 의 네 단계도 모두 읽기·쓰기를
  분리했다. **새 보정을 추가할 때 이 순서를 깨지 말 것.**
  참고: 미리보기(`fitMathIn`, 수식 25개)에서는 0.1ms 라 원래 병목이 아니었다 —
  이 최적화가 값어치를 하는 곳은 문서 전체를 한 번에 처리하는 인쇄다.

### 2026-08-25 (4차) — 인쇄 보정이 아예 동작하지 않던 문제
**가장 큰 것: `fitPrintDoc()` 은 지금까지 한 번도 실행된 적이 없었다.**
`#printDoc` 은 평소 `display:none` 이고 `@media print` 에서만 `block` 이 되는데,
`doPrint()` 는 `window.print()` **전에** 폭·높이를 잰다. `display:none` 이면
`clientHeight`·`scrollWidth`·`getBoundingClientRect()` 가 전부 0 이라 모든
보정이 조용히 건너뛰어졌다(실측 확인). 그래서 넘치는 수식·긴 문항이
`overflow:hidden` 에 그냥 잘려 나갔다.
→ 잴 때만 `#printDoc.measuring` 으로 화면 밖(`left:-10000px`)에 실제 크기로
   펼친 뒤 측정하고, `finally` 로 반드시 되돌린다.

그 위에 얹힌 문제 둘:
- **가로 넘침 판정이 틀렸다.** `getBoundingClientRect().width` 는 '칸에 맞춰
  이미 잘린 폭' 이라 칸 폭을 절대 넘지 않는다(실측: rect 334 / 실제 555).
  `scrollWidth` 로 재야 한다. 화면용 `fitMathIn()` 은 원래 맞게 하고 있었고
  인쇄용만 틀렸다 — 미리보기와 인쇄가 달랐던 이유. 이제 두 경로가
  **`shrinkWideMath()` 하나**를 공유한다.
- **축소만 하면 내용이 잘린다.** `scale` 은 그리는 크기만 줄이므로 박스 폭이
  칸에 묶여 있으면 내용은 여전히 그 폭에서 잘린다. 실제 내용 폭을 `width` 로
  준 뒤 `scale` 해야 전체가 보인다. 높이는 `scale` 만큼 다시 지정해 유령 여백을 없앤다.
- **세로 넘침도 못 잡았다.** `.slot` 이 flex 컨테이너라 자식이 `flex-shrink` 로
  눌려 `slot.scrollHeight === clientHeight` 가 된다(실측: 둘 다 979, 실제 3565).
  자식들의 `scrollHeight` 합으로 재고, 하한(72%)으로도 안 담기면 **토스트로 알린다**
  — 예전엔 잘린 시험지가 아무 말 없이 인쇄됐다.
- `@page` 에 `size:A4` 명시(없으면 Letter 기본 환경에서 빈 쪽이 딸려 나온다),
  인쇄 모달에 용지·배율·여백·머리글 설정 안내, `doPrint()` 에 강제 reflow +
  120ms 대기(폰트 적용 전 측정 방지).

### 2026-09-06 — 인쇄가 느리다는 신고 (실측)

**우리 코드는 느리지 않았다.** 실제 `index.html` 로 재면 200문항(100쪽)에 준비 0.47초 ·
크롬의 PDF 생성 0.65초다. **체감 대기의 대부분은 크롬의 인쇄 미리보기가 쓰는 시간이고
쪽 수에 비례한다** — 우리가 줄일 수 있는 건 우리 몫과 쪽 수뿐이다. 자세한 표는
`HANDOFF-2026-047`.

그래도 우리 몫에서 셋을 고쳤다.
- ⚠️ **글꼴은 부팅 뒤 한가할 때 미리 받는다**(`warmPrintFonts()`). 예전엔 인쇄 버튼을
  누른 뒤에 KaTeX 15벌 + KoPub 3벌을 받아, **그 세션의 첫 인쇄만 1,172ms** 를 여기에
  썼다(둘째부터는 25ms). 준비 시간 1,391ms → 278ms.
  ⚠️ 부팅 경로에서 직접 부르지 말 것 — 첫 화면 그리기를 밀어낸다(2026-08-25 6차).
- 인쇄 본문은 **300(Light)** 인데 미리 깨우는 목록은 400·700 이었다. 화면도 300 이라
  사고는 없었지만 목록이 인쇄와 어긋나 있었다. 300 을 넣었다.
- ⚠️ **그림이 도착하기 전에 재고 있었다 — 이쪽이 진짜 결함이다.** 미리보기는 지금
  문항 하나만 그리므로 인쇄본의 나머지 그림은 `buildPrintDoc()` 때 **처음** 받아 온다.
  아직 안 온 `<img>` 는 `height:auto` 라 **높이가 0** 이고, 그 상태로 `fitPrintDoc()`
  을 부르면 세로 넘침 보정이 통째로 헛돈다(실측: 장당 1.5초 걸리는 회선에서 그림 60장이
  측정 시점에 **전부 높이 0**, 넘침 0건). `awaitPrintImages()` 가 `fitPrintDoc()`
  **앞에서** 기다린다 — **상한 8초**를 두고, `load` 와 `error` 를 **둘 다** 듣는다
  (`error` 를 빼면 깨진 그림 하나에 8초를 기다린다).
- 준비가 끝나면 `console.info("인쇄 준비 NNNms · N쪽", {구간별})` 를 남긴다.
  **그 줄까지가 우리 시간이고 그 뒤는 전부 크롬이다.** 또 "느리다" 는 말이 나오면
  이 한 줄로 어느 쪽인지 가른다.

⚠️ **자동 페이지네이션은 넣지 않았다.** 이 앱은 문항별 `span`(pair/col/page)으로
사용자가 배치를 직접 정하는 모델이라, 넘칠 때 다음 단으로 자동 이월하면 그
의도를 덮어쓴다. 대신 담기지 않으면 '한 쪽 배치로 바꾸거나 내용을 나누라' 고
안내한다. 자동 이월을 원하면 배치 모델 자체를 바꾸는 결정이 먼저다.

### 2026-08-25 (3차) — 경합·데이터 소실 방어
- **AI 변환 중 화면 이동**: `aiGenerateFromImage()` 가 요청 시점의 문제집을 캡처해
  두고 완료 시 그대로 밀어 넣어, 그 사이 다른 문제집으로 옮기면 `currentSetId` 와
  `currentQId` 가 서로 다른 문제집을 가리켰다(`activeQ()` 가 undefined). 이제
  결과는 '요청한 문제집' 에 넣되 **포커스는 그 문제집을 보고 있을 때만** 옮기고,
  아니면 어디 들어갔는지 토스트로 알린다. 그 문제집이 삭제됐으면 안내하고 버린다.
- **Storage 고아 이미지**: 이미지 블록을 다른 종류로 바꾸거나 블록·문항을 지우면
  Firestore 에서만 사라지고 Storage 원본은 영영 남았다. `releaseImage()` /
  `releaseBlockImages()` / `releaseProblemImages()` 가 정리한다.
  **다른 문제집이 같은 주소를 쓰면 지우지 않는다**(복제본 보호).
- **선지 소실**: 모의고사 순서도에서 문항을 단답형 자리에 스치기만 해도
  `syncChoicesBlock()` 이 선지 블록을 `splice` 로 없애 5개가 영구 삭제됐다.
  이제 **지우지 않고 숨긴다** — `probUnits()` 가 단답형일 때 선지 유닛을 건너뛰고,
  편집기에는 '시험지에는 안 나와요' 안내를 단다. 객관식으로 되돌리면 그대로 살아난다.
- **임시저장**: 복구 확인창에서 '취소'(또는 ESC)를 누르면 `clearDraft()` 로 즉시
  영구 삭제했다. 이제 백업을 남기고 툴바에 `↩︎ 임시저장 복구` 버튼을 띄운다.
- **로그인 직후 빈 화면**: 클라우드에서 읽는 몇 초 동안(첫 로그인은 이관까지 하느라
  더 길다) '아직 문제집이 없어요' 가 떠서 데이터가 날아간 줄 알았다.
  `showLibraryLoading()` 으로 '불러오는 중' 을 보여 준다.

### 마지막 문제집 기억은 sessionStorage 다
`rememberSet()`/`readLastSet()` 만 **sessionStorage** 를 쓴다(나머지 로컬 키는 전부
localStorage). 원하는 동작이 '새로고침은 이어서, 탭 닫았다 들어오면 라이브러리' 인데,
그 둘을 가르는 경계가 정확히 sessionStorage 의 수명이기 때문이다.
localStorage 로 두면 며칠 뒤 다시 들어와도 편집기로 바로 떨어진다(그랬다).
계정 삭제의 `clearLocalKeys()` 는 두 저장소를 모두 훑는다.

### 본문 글꼴 굵기 — KoPub 의 400 은 Regular 가 아니다
KoPub Batang 은 **300=Light · 400=Medium · 700=Bold** 다. `font-weight:400` 이
'보통' 일 거라 생각하고 두면 Medium 이 나와 본문이 두껍게 조판된다(실제로 그랬다).
실제 시험지(신명조 계열)에 가까운 건 Light 라 `.preview .content` 와 `.pq .content`
모두 **300** 을 쓴다. 미리보기와 인쇄는 같은 값을 유지할 것.

### 2026-08-25 (2차)
새로고침하면 편집 중이던 문제집에서 라이브러리로 튕기던 동작 수정.
`lastSetKey()` 로 마지막에 연 문제집을 계정별로 기억하고 `bootLibrary()` 가
복원한다. 라이브러리로 나가면(`showLibrary()`) 기억을 지우므로, 로고를 눌러
나간 뒤 새로고침하면 라이브러리로 남는다. 문제집이 사라졌으면 안전하게
라이브러리로 떨어진다(`showEditor()` 가 `activeSet()` 없음을 먼저 확인 —
예전엔 여기서 TypeError 로 화면이 빈 채 멈출 수 있었다).

### 2026-08-25 추가 반영
AI 전송 이미지 자동 축소(`prepImageForAI`, 1568px/JPEG 0.8 — 모델 해상도 상한과 일치,
HEIC 도 함께 해결), Storage 업로드 5MB 상한 + 압축 실패 시 원본 업로드 차단,
`storage.rules` 10MB→5MB, 가져오기에서 외부 이미지가 조용히 사라지던 문제에 안내 추가
(`normDropped`/`reportNormDropped`), 모의고사 그림이 실시간 렌더에서 아예 안 나오던
버그(`#image` 경로) 수정, `serve.py --lan` (사설 IP 만 허용 · `/font/` 차단 · 경고 배너).

### 2026-08-24 감사에서 처리 완료
`$$` 블록 XSS 차단(가장 위험했던 항목), `numLabel` 미리보기 XSS, CSP + CDN SRI 전면 적용,
Pretendard `@import` 무시되던 버그, Firestore 문제집 단위 문서 전환(1MB 한도·다중 탭
덮어쓰기 동시 해결), `updatedAt` 기반 병합, 삭제 tombstone, `onSnapshot` 다중 탭 반영,
`setHasContent` 의 `d.src`→`dataUrl`(이미지 전용 문제집 소실), 계정별 로컬 키 분리
(`PM_BACKUP`/`PM_LAST_Q`/`PM_STAMPS`), `beforeunload`·`visibilitychange` 저장 보장,
undo/redo 후 클라우드 반영, `redoStack` 메모리 상한, AI 응답 `normProblem()` 통과,
JSON 가져오기 크기·개수 상한, Storage 고아 이미지 정리, serve.py Host 검사(DNS 리바인딩),
`/health` 로컬 경로 노출 제거, Typst `//` 주석 버그(`tq()`), 모의고사 `esc()` 따옴표 방어,
죽은 `gauge()` 제거, Worker 키 이름 문서 불일치.


### 2026-09-08 독립 검토: 실행 방식별 지원 범위

- 일반 `<script src>` 분리는 `file://`에서도 가능하다. 다른 고전 스크립트의 최상위
  `const`/`let`도 같은 global lexical environment에서 접근할 수 있다(`window` 속성은 아니다).
  명시적 namespace는 의존성·중복 선언을 관리하기 위한 선택이다.
- 정적 HTTP(S): 모의고사 및 AI 문서 HWPX는 변환 API 서버 없이 템플릿을 fetch한다.
- `file://`: 본체 편집과 모의고사 HWPX(내장 PNG/JPEG 포함)는 지원한다. 모의고사 틀은
  `exam-template-data.js`를 사용한다. **AI 문서 골격도 `blank-template-data.js` 로 같이 인라인했다**
  (2026-09-17) — 그래서 `file://` 예외가 사라졌다. 원본 틀을 바꾸면
  `node scripts/build-hwpx-templates.mjs` 로 **둘 다** 재생성하고 `--check` 로 낡음을 확인한다
  (`test:review-contracts` 안에서 돈다). ⚠️ 틀이 늘어도 스크립트를 새로 만들지 말 것 —
  그 파일의 `TEMPLATES` 표에 한 줄만 더한다.
- ~~AI 문서 HWPX는 `file://` 예외다~~ → **2026-09-17 해소.** `blank-template-data.js` 를
  인라인해 `file://` 에서도 한글 내보내기가 된다(`blankSource()` 가 프로토콜로 가른다).
  ⚠️ HTTP(S) 에서는 계속 실물 파일을 fetch 한다 — 인라인은 `file://` 전용 경로다.
- 파일 이름만 있는 모의고사 그림 및 Typst 정본 미리보기에는 로컬 서버가 필요하다.
- 라이브러리 클라우드 스키마는 `service-config.js`의 `libraryCloudSchema`로 명시한다.
  **지금 값은 `1`(B단계)이다** — 2026-09-09 에 새 Rules 를 실제로 배포한 뒤 올렸다.
  1에서는 소속이 문제집 문서의 `folderId` 로 올라가 **계정을 따라 기기 간에 따라다닌다.**
  ⚠️ **구형 Rules 를 쓰는 배포에 코드를 올릴 때는 0으로 내릴 것** — 구형 Rules 는 `hasOnly`
  목록에 folderId 가 없어 로그인 사용자의 문제집 저장이 **전부 '권한 오류' 로 실패한다.**
  0에서는 소속을 계정별 로컬 metadata에만 쓰고 저장 요청에 folderId를 넣지 않는다.
  ⚠️ **검사가 이 배포 플래그를 물려받게 하지 말 것**(`REV-2026-051`). 예전에는 두 검사
  묶음의 7건이 `service-config.js` 값을 그대로 썼다 — "공개 전에 0으로 내려라" 는 지시를
  따르는 순간 P1 회귀들이 **잘못된 이유로** 빨간불이 되어, 제품이 깨진 건지 검사가 깨진
  건지 가를 수 없었다. 지금은 `check-review-contracts.mjs` 의 `app()` 이 단계 선언을
  **강제하고**(안 하면 던진다), `tests/regression-test.html` 은 `withSchema()` 로 걸었다
  되돌린다. 규칙 허용 필드 대조는 **두 단계를 함께** 본다.

구조 분리 승인 조건·검사 근거는 HANDOFF-2026-073을 따른다.
