# 변경 인계 — 라이브러리·브라우저 HWPX 독립 검토

- ID: `HANDOFF-2026-073`
- 날짜: `2026-09-08` (실행 환경의 현지 날짜)
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index`, `mock`, `server`, `rules`, `tests`, `docs`
- 기준 HEAD: `31da3eb68abb66a860bf5a468424ed6e04922be6`
- 검토 대상: `aafc257`, `42b62d8`, `2944df9`, `6fa6306`, HANDOFF-2026-071
- 관련 이슈: `REV-2026-043` ~ `REV-2026-050` (8건, 모두 재현 후 resolved)

## 결론과 변경

기존 회귀 152개가 통과하는 상태에서 시작했지만 라이브러리 세 계약은 완성되지 않았다.
재현 가능한 8건을 같은 이슈 파일에 원인·수정·검증과 함께 남겼다.

| 계약/경로 | 기준 코드에서 확인한 문제 | 최종 동작 |
|---|---|---|
| 폴더 tombstone | 소속 판정·직렬화가 tombstone을 무시, prefs 전체 덮어쓰기, 빈 소속이 옛 지도에서 부활 | 삭제 ID는 화면에서 폴더 없음, 다음 저장에서 소속 해제. transaction으로 tombstone 합집합/최댓값 보존. 원격 prefs 구독. 이관은 set 로드 뒤 수행하며 명시적 빈 값 보존 |
| A/B 분리 | capability가 없고 폴더 필드 무조건 전송. B Rules는 필드 없는 구형 저장과 기존 tombstone 거부 | 공개 `libraryCloudSchema`로 분리. 0은 로컬 지도만 변경하고 전송 필드 제외. 1은 기존 B 경로. 새 Rules는 구형 요청도 수용하며 B 삭제는 새 스키마 사용 |
| 계정 경계 | 최초 boot만 metadata를 읽어 A→B 전환에 A 폴더 잔류 | 소유자 전환 때 metadata·언어·선택·필터를 재설정, prefs 구독/타이머 해제와 세대 guard 유지 |
| 원격 삭제 Undo | 삭제가 일반 저장 큐 밖에 있고 오류를 삼킴 | 기존 cloudSaveQueue로 삭제·복원·Redo를 직렬화. Undo 시각은 tombstone보다 높임. 실패한 ID는 원본을 보존하고 선택 유지하여 재시도 |
| 다량 처리 | 삭제 실패 목록이 항상 비고 성공 안내 | 삭제는 개별 직렬 쓰기와 진행 수 표시. 401개 중 실패 ID 재시도 검증. 폴더 소속 쓰기는 400개 이하 batch; 두 번째 batch 실패 뒤 재시도 버튼/로컬 pending 유지 |
| 정적 HTTP HWPX | API 서버 없이 이미 동작 | 실제 버튼 다운로드 및 ZIP의 그림 바이너리 확인 |
| file HWPX | 시험지 틀 fetch가 차단됨 | 원본 틀에서 생성한 고전 스크립트 fallback. 원본과 생성 파일의 일치 검사 |
| 내장 그림 | 가져오기 상한이 실제 2MiB보다 큼, 바이트와 확장자가 다르면 MIME 오류 | 정규화와 두 조판기의 실제 바이트 상한/화이트리스트. 바이트에 맞는 확장자. 실패 데이터는 경고·자리표시 |

`service-config.js`의 기본값 1은 검토 대상의 기존 B 릴리스를 유지한다. 운영 Rules 배포가
완료됐다는 `42b62d8`의 커밋 설명은 이번에 원격 조회로 재확인하지 않았다. 구형 Rules에
공개할 빌드는 **공개 전에 0으로 설정**해야 한다. 실패한 쓰기를 capability 탐지로 쓰지 않는다.
이번 Rules 수정도 배포하지 않았다.

## HANDOFF-071의 세 질문에 대한 답

### 1. 정규화 분리를 먼저 하는가 — 조건부 동의

신뢰 경계를 먼저 독립 API로 만들면 제품 파일 전체를 Node에서 실행하고 브라우저와 같은
함수를 호출할 수 있다. 그러나 지금 제시된 목록이 전부 순수 함수라는 설명은 틀리다.

- `normBlock`은 `normDropped.images`를 변경한다.
- `reportNormDropped`는 `toast`라는 UI 부작용을 수행한다.
- `normProblem`, `normSet`, `normLibMeta`는 `uid()` 및 여러 whitelist/열거 상수에 의존한다.
- `safeUrl`은 `IMG_HOSTS`, `normLibMeta`는 `LIB_SORTS`에 의존한다.

1단계 전에 의존 상수와 ID 생성·진단 집계를 명시적 입력/출력 또는 모듈 내부 책임으로
정의해야 한다. toast 표시는 본체에 남기고, 호출 순서와 기존 keepId/lossless 계약을
유지한다. 독립 namespace는 IIFE 안에서 export하면 중복 lexical 선언을 피할 수 있다.

정규화 분리만으로 `check-audit-safety.mjs`의 문자열 추출을 전부 없앨 수는 없다. 그 파일은
`loadSets`, `onAuth`, `writeCloudSnapshot` 같은 저장·인증 함수도 검사한다. 정규화 부분부터
전체 제품 파일 로딩으로 바꾸고 저장/세대 경계 검사는 그대로 유지해야 한다. REV-040은
수정 대상 실제 경로 대신 검사 내부 사본을 실행한 것이 직접 원인이다. 문자열 추출 자체가
필연적으로 사본 검사를 만드는 것은 아니며, 새 파일도 실제 제품 호출과 연결하지 않으면
같은 실수가 난다. 이번에도 실제 제품을 기준 버전으로 교체하는 red 검증을 했다.

### 2. 전역 42개 상태 객체화가 먼저인가 — 이번 분리보다 뒤로 미룬다

정규화·렌더의 의존성을 명시하는 작은 분리를 먼저 하되, 저장/인증/Undo를 동시에 다시
설계하지 않는다. 상태 객체에 이름만 모아도 계정 세대·비동기 응답·원격 명령 순서는
해결되지 않는다. 이번에 고친 삭제 경쟁도 기존 **동일 큐 사용**과 timestamp 계약으로
해결했으며 객체화는 필요하지 않았다. 나중에 세션 소유 상태, 기기 설정, Undo 기록,
원격 명령 큐의 수명과 소유권을 정한 별도 변경으로 검토하는 것이 적절하다.

설계 문서의 근거는 일부 제한해야 한다. 함수 이름 교집합이 작다는 사실만으로 의미상
중복이 없다고 증명할 수 없다. 또한 REV-035는 Python 서버의 전역 조판 상태 결함이며
index의 전역 42개가 직접 원인이 아니다. 당시 줄 수·함수 수는 현재 값으로 재사용하지 않는다.

### 3. fetch/file 사실은 어디에 쓰는가 — CLAUDE.md에 기능별 지원 범위를 적는다

"파일로 열기" 전제를 폐기하거나 AI 문서만 예외라고 뭉뚱그리지 않는다. 본체 편집,
모의고사 HWPX, AI 문서 HWPX, 이름만 있는 그림, Typst 미리보기의 실행 조건을 나눈다.
이번 수정 후 모의고사 HWPX는 file에서도 내장 그림과 함께 동작한다. AI 문서는 여전히
blank.hwpx를 fetch하므로 정적 HTTP(S) 또는 기존 서버 대비 경로가 필요하다.

추가로 §7의 "const/let은 파일 밖에서 안 보인다"는 주장은 잘못됐다. 같은 문서의 고전
스크립트는 global lexical environment를 공유한다. 검사에서 첫 script의 const를 두 번째
script가 읽었고 window 속성에는 없음을 확인했다. namespace는 의존성 관리상 유익하지만
접근 불가를 해결하기 위한 필수 조건은 아니다. ESM/번들러 전환은 이번에 하지 않았다.

구조 설계는 위 조건으로 승인한다. **구조 분리 자체는 이번 작업에 포함하지 않았다.**

## 검증

- 시작: HEAD와 status 확인 후 AGENTS.md, reviews/README.md, INDEX.md, HANDOFF-072 전체 읽음.
  열린 이슈는 없었다. HANDOFF-070/071 및 실제 diff·호출 경로를 추가 대조했다.
- `npm run check:fast`: 통과. Worker, fixture, mock layout, Python HWPX 12개 실행 경로,
  JS/Python 시험지·문서 대조, Chromium 세 뷰포트, static, audit-browser, 신규 계약 검사.
  이번 실행에서는 이전 기록의 KoPub 실패가 재현되지 않았다.
- `npm run test:audit-browser`: 최종 변경 관련 재검증, **154/154**. serve.py로 실행.
- `npm run test:review-contracts`: **14개 검사**. 실제 제품 함수/페이지와 격리한 외부 경계를
  사용하며 실제 계정에 연결하지 않는다. HTTP/file 실제 다운로드는 PNG 바이너리 존재까지 확인.
  직접 Writer 검사에서는 PNG/JPEG 이름·manifest MIME, 깨진 데이터 경고를 확인한다.
- `npm run check:rules`: Java 21 로컬 emulator 통과. 타인/비로그인/알 수 없는 키/상한,
  기존 스키마 저장·tombstone 및 B 폴더 필드를 검사한다.
- 실패 주입: `REVIEW_RED=1 node scripts/check-review-contracts.mjs`는 `31da3eb`의 실제 제품
  코드를 HTTP/file 요청에 공급한다. tombstone, capability, 계정 잔류, 삭제 경쟁·실패,
  이미지 상한·형식, file 다운로드가 실패했다. 정적 HTTP 성공 대조군은 그대로 통과했다.
- Rules 실패 주입: `REVIEW_RED=1 npm run check:rules`는 원 Rules를 emulator에 로딩한다.
  새 구형 스키마 성공 검사에서 실제 PERMISSION_DENIED/exit 1을 확인했다.
- regression-test의 신규 두 검사에도 원 index를 주입해 별도로 red 검증했다. 캐시 방지 query가
  있는 iframe URL까지 route에 포함해야 실제로 교체된다. 첫 route 패턴은 query를 놓쳤고,
  그때의 초록불은 검증 근거에서 제외했다.
- `npm run test:worker`, `npm run check:static`, `git diff --check`: 통과.

브라우저 실행에는 sandbox 밖의 로컬 포트·Chromium 권한이 필요했다. Python은
`/Users/huryul/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`,
Rules는 `/opt/homebrew/opt/openjdk@21/bin`을 사용했다. 검사에서 운영 Firebase/Worker를
호출하거나 배포하지 않았다.

## 위험과 다음 검토자에게

- 이번 검증은 격리된 Firestore 경계와 emulator/브라우저 산출물 구조 검증이다. 실제 두
  계정·두 기기의 운영 동기화, 한글 데스크톱에서의 시각적 재개방은 이번에 실행하지 않았다.
- 폴더 ID는 삭제 후 재사용하지 않는다. 500개 tombstone 한도에 도달하면 새 폴더 삭제를
  거절하며 기록을 잘라내지 않는다. 장기 GC/서버 수명 정책은 별도 설계가 필요하다.
- Rules의 prefs 검사는 컨테이너 타입·개수 및 updatedAt 타입 중심이다. 개별 폴더 항목과
  tombstone 값의 정규화는 앱에서 수행한다. 이 한계까지 서버에서 강제하는 스키마 변경은
  이번 호환성 수정에 포함하지 않았다.
- `.tmp.driveupload/` 아래 자료는 읽거나 수정·삭제·스테이징하지 않았다. 작업 중 그 경로의
  untracked 항목이 바뀌었지만 다른 작업자의 것으로 그대로 두었다. 기존 추적된 자료와
  Icon 파일도 건드리지 않았다.
- 로컬 커밋만 만들며 원격 push, Firebase Rules/Worker 배포는 하지 않는다.
