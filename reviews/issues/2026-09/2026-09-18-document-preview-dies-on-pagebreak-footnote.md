# 미리보기가 `pagebreak`·`footnote` 를 만나면 **통째로 죽는다**

- ID: `REV-2026-095`
- 날짜: `2026-09-18`
- 보고자: `Claude`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `client`
- 관련 인계: `HANDOFF-2026-144`

## 요약과 영향

`document-editor.html` 의 `render()` 가 `pagebreak` 와 `footnote` 를 모른다. 두 블록이
마지막 `else` 로 떨어지는데, 그 가지는 **목록 블록(bullets·numbered)이라고 가정하고**
`b.items` 를 훑는다. 둘 다 `items` 가 없으므로 `TypeError` 가 나고, 예외가 `render()` 밖으로
나가 **미리보기가 통째로 그려지지 않는다.**

사용자가 보는 흐름은 이렇다 — AI 가 각주나 쪽나눔이 든 문서를 (계약대로 정확히) 만들고,
`validate()` 는 통과시키고, 그 다음 화면이 **비어 버린다.** 조판 자체는 멀쩡해서 내보내면
파일은 제대로 나온다. 즉 **'검토하고 내보내라' 는 제품의 전제가 깨진 상태**였다.

⚠️ 이 결함은 `69525df`(각주·쪽나눔 도입, 2026-09-17)가 만들었다. 계약·Worker 프롬프트·
Worker 검증·브라우저 `validate()`·파이썬 조판기·JS 조판기를 **전부** 고치고 **미리보기
하나만** 빠뜨렸다. 이 저장소가 반복해 겪은 "한 곳만 고쳤다" 그대로다.

## 재현 절차

`document-editor.html` 을 띄우고 아래 JSON 으로 '검증·미리보기' 를 누른다.

```json
{"version":1,"title":"제목","blocks":[
  {"type":"paragraph","text":"앞"},{"type":"pagebreak"},{"type":"paragraph","text":"뒤"}]}
```

자동으로 재현하려면(Playwright):

```bash
node -e '
const {chromium}=require("playwright");const {pathToFileURL}=require("url");
(async()=>{const p=await(await chromium.launch()).newPage();
await p.goto(pathToFileURL(process.cwd()+"/document-editor.html").href);
console.log(await p.evaluate(()=>{try{render(validate({title:"제목",
  blocks:[{type:"paragraph",text:"앞"},{type:"pagebreak"}]}));return "그려짐";}
  catch(e){return "터짐: "+e.message}}));process.exit(0)})()'
```

## 기대 결과 / 실제 결과

- 기대: 쪽 나눔 자리가 보이고 나머지 블록이 그려진다.
- 실제: `b.items is not iterable` — 미리보기가 **한 글자도** 그려지지 않는다.
  (`footnote` 도 같다. 실측으로 둘 다 확인했다.)

## 근거

- `document-editor.html` `render()` 의 마지막 가지:
  `else{const list=document.createElement(b.type==="bullets"?"ul":"ol");for(const item of b.items)…}`
  — `else` 가 **목록이 아닌 것까지 받는 자리**였다.
- ⚠️ **검사가 왜 못 잡았나**: `scripts/check-document-blocks.mjs` 는 브라우저 쪽에서
  **`validate()` 만** 읽어 비교하고 `render()` 는 보지 않았다. 그래서 '네 경계 일치'
  가 초록불인 채로 미리보기만 빠져 있었다. **통과하는 것과 그려지는 것은 다른 경계다.**

## 처리 기록

- `2026-09-18` — `Claude`: 등록과 동시에 수정.
  - **원인**: `render()` 의 마지막 `else` 가 '나머지는 전부 목록' 이라고 가정했다.
  - **수정**:
    - `pagebreak`(쪽 나눔 표시선)·`footnote`(번호 붙은 각주 줄)를 명시로 그린다.
      각주 번호는 조판기와 같은 순서로 센다.
    - 목록 가지를 `bullets`·`numbered` **명시 조건**으로 바꿨다 — 다시는 모르는 블록이
      목록으로 취급되지 않는다.
    - `check-document-blocks.mjs` 가 **`render()` 를 다섯 번째 경계로** 대조한다.
  - **파일**: `document-editor.html` · `scripts/check-document-blocks.mjs`
  - **검증**:
    - 진짜 브라우저(Playwright)로 여섯 경우 확인 — `paragraph` · `pagebreak` · `footnote` ·
      `머리말·꼬리말` · `bullets` · `numbered` 모두 그려지고 `pageerror` 0건.
    - **깨보기**: 미리보기에서 `pagebreak` 가지를 지우니
      `❌ 브라우저 미리보기 — 빠진 블록: pagebreak` 로 빨간불이 났고, 되돌리니 통과했다.
      (검사가 실제로 일하는 것을 확인했다.)
    - `npm run check:static`(`check-document-blocks` 포함) 통과.
