# 변경 인계 — 부팅 구간 노출 수정 · 운영 배포 기록 · HANDOFF-083 회신

- ID: `HANDOFF-2026-084`
- 날짜: `2026-09-09`
- 작성자: `Claude`
- 상태: `ready-for-review`
- 영향 영역: `index`, `tests`, `docs`, `운영(배포)`
- 기준 HEAD: `dc5934d`
- 대상: `HANDOFF-2026-083` (`ready-for-fix`) · `REV-2026-061`

## 1. `REV-2026-061` — 부팅 구간 노출 (수정 완료)

지적이 맞다. `af39779` 는 **`showLibrary()` 가 불린 뒤**만 다뤘고, 마크업 초기값은 여전히
`.actions{display:flex}` 였다. 핸들러가 등록된 뒤부터 첫 `showLibrary()` 까지의 창에서
편집기 단추가 보이고 눌렸다.

**수정**: `#topActions{display:none}` 을 CSS 에 두어 **초기값을 숨김**으로 했다. id 규칙이
`.actions` 클래스 규칙을 이기고, `setEditorActions(true)` 의 **인라인** `display:flex` 가
다시 그것을 이긴다. 그래서 JS 가 늦거나 아예 실패해도 **편집기 문맥이 생기기 전에는
드러나지 않는다.** (`.actions` 는 `#topActions` 전용임을 확인했다 — `lib-actions`,
`select-actions`, `library-dialog-actions` 는 다른 클래스다.)

**회귀 검사**: `test:library-ui` 에
`editor-only top actions stay hidden during a slow boot` 추가(12 → 13건).
`firebase-app-compat.js` 응답만 1.5초 늦추고, **핸들러는 등록됐는데 부팅은 아직인 순간**에
잰다.

⚠️ **설계의 판별 조건을 그대로 쓰면 안 됐다.** 설계는 "`DOMContentLoaded` 는 끝나지 않은
시점" 이었는데, 부팅 타임라인을 실제로 찍어 보니 **파싱이 끝나자마자 `readyState` 가
`interactive` 가 되고 `loading` 에 머물지 않아** `showLibrary` 존재 시점과 겹치지 않는다:

```
  150ms  ready=loading      showLibrary=undefined
  300ms  ready=interactive  showLibrary=function   ← 여기가 그 창
 1800ms  ready=complete
```

그래서 표지를 **늦춘 SDK 자체**(`typeof window.firebase==='undefined'`)로 바꿨다 — 그것이
"부팅이 아직 안 끝났다" 의 정확한 신호다. 판정은 요청대로 **자리 기반**을 유지했다.

**깨보기**: `#topActions{display:none}` **한 줄만** 지우니 → **새 검사 하나만** 빨간불
(`w:53, shown:true, booted:undefined`), 나머지 12건은 통과. 원인이 섞이지 않았다.

## 2. ⚠️ 배포 승인에 대한 사실 정정 (`HANDOFF-083` §2)

**"승인 범위를 벗어났다" 는 판정은 사실과 다르다.** 배포 직전에 사용자에게 선택지를
제시했고, 사용자가 **"저장소 Rules 를 배포해라 (권장)"** 를 골랐다. 그 선택지의 설명에는
실행할 명령(`firebase deploy --only firestore:rules,storage`)이 그대로 적혀 있었다.
그 앞 지시도 **"Rules 확인 후 스키마 전환 하자"** 였다.

즉 배포는 **그 시점의 명시적 승인**으로 실행했다. 다만 인계 문서에는 "원격 push·배포
안 함" 이라는 **이전 세션의 표준 문구만** 남아 있어, 저장소만 보는 검토자에게는 무단
배포로 보일 수밖에 없었다 — **그건 내 기록 누락 탓이다.**

**§3(기록 누락)은 전적으로 맞다.** 아래에 남긴다. 앞으로 승인은 **받은 사실과 문구까지**
인계에 적겠다.

## 3. 운영 배포 기록

| 항목 | 값 |
|---|---|
| 프로젝트 | `pedagogy-huryul` |
| 시각 | 2026-09-09 02:58 KST (커밋 `9851ab4` 직전) |
| 명령 | `npx firebase deploy --only firestore:rules,storage --project pedagogy-huryul` |
| 실행 트리 | `39ffc64` (두 규칙 파일은 `2ec5055` 이후 변경 없음) |
| `firestore.rules` SHA-256 | `4644544234d8f2d9e306041934b5f1356e499537de81ed4733b7222489f13bcd` |
| `storage.rules` SHA-256 | `14c6bd339cbdcff577af1c292a0718b0720bc3970ade1fdca6fb382be405b461` |
| 사전 검증 | `PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npm run check:rules` → 통과 |
| 결과 | `storage: already up to date, skipping upload` / **`firestore: uploading rules…`** → 둘 다 released |

⚠️ **그 출력이 알려 준 사실**: Firestore 규칙은 그때까지 **최신이 아니었다.** 그래서
`libraryCloudSchema` 를 0 으로 두었던 판단이 맞았다(1 이었으면 저장이 전부 권한 오류).

⚠️ **익명 403 은 운영 Rules 의 증거가 아니다.** 구·신 규칙 모두 비로그인 읽기를 막으므로
구별하지 못한다. 그것으로 아는 것은 "테스트 모드로 열려 있지는 않다" 까지다.
**배포된 규칙을 읽는 CLI 명령은 없다**(`firebase firestore:*` 에 없고 `deploy` 에
`--dry-run` 도 없다) — 확인하려면 콘솔을 보거나 다시 배포하는 수밖에 없다.

### 되돌리는 순서 (문제가 나면 이 순서로)

1. **먼저 `service-config.js` 의 `libraryCloudSchema` 를 1 → 0** 으로 내리고 푸시한다.
   그러면 앱이 `folderId` 를 **보내지 않으므로** 어떤 규칙에서도 저장이 된다.
2. 그다음에야 Rules 를 되돌린다(`git checkout <이전 커밋> -- firestore.rules` 후 재배포).
   ⚠️ **순서를 뒤집지 말 것** — Rules 를 먼저 되돌리면 그 사이 스키마 1 인 클라이언트의
   저장이 전부 권한 오류가 된다.
3. 규칙 파일을 고쳤으면 **반드시 다시 배포**해야 효력이 생긴다.

⚠️ **아직 사람이 확인 못 한 것**: 로그인 상태에서 Rules 와 앱이 실제로 맞물리는지
(저장 · 폴더 이동 · **다른 기기에서 폴더가 따라오는지**). 나는 로그인할 수 없어 못 했다.

## 4. 정적 검사의 범위 과장 정정 (`HANDOFF-083` §4)

동의한다. `check-static` 의 그 규칙은 **직접 대입(`.style.visibility =`)만 잡는 보조망**
이고, `cssText`·`setProperty`·클래스 같은 우회는 못 잡는다. **우회 문법을 쫓아 정규식을
늘리지 않는다.** 실제 보장은 브라우저 회귀(`test:library-ui` 의 상단 동작 검사 둘)가 한다는
것을 `CLAUDE.md` 와 검사 주석·실패 메시지에 명시했다.

## 검증

- `npm run check:fast` **종료코드 0** · 회귀 154/154 · 계약 20건 · `test:library-ui` **13건**
- 깨보기: `#topActions{display:none}` 한 줄 제거 → **새 검사만** 빨간불
- `check:rules` · `test:visual` · `test:cross`(전 엔진)는 이번에 돌리지 않았다
- **원격 push·추가 배포 없음.** `.tmp.driveupload/` 는 건드리지 않았다

## 다음 검토자에게

- §2 의 사실 정정을 확인해 달라. 승인은 대화에서 받았고 기록을 빠뜨린 것이 내 잘못이다.
- 부팅 구간 검사가 충분한지 봐 달라 — 지금은 **SDK 하나를 늦춰** 그 창을 만든다. 다른
  방식으로 부팅이 늦어지는 경우(느린 회선 전반, CDN 차단)까지 같은 창이 생기는지는
  확인하지 않았다.
