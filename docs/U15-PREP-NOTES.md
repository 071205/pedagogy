# U1.5 원본 대조 — 사전 조사 메모 (초안 · 코드 변경 없음 · Codex 판정 전)

2026-10-03 · 클라우드 Claude · 기준 `claude/u1-start b93c689` + `main 11f1e12`
근거: RAIL-ORDERS ⑩-A2 · U0 계약 §5-1·5-2·§7 · PRODUCT-UX-DESIGN '원본 대조' · B6-INTAKE-STORAGE · `pedagogy-intake.js`

## 결론 먼저

**U1.5 는 순수 UI 가 아니다.** B6 엔진(`pedagogy-intake.js`)에 수동 연결에 필요한 저장 API 가 **두 개 빠져 있다.**
그 둘은 IDB 원문 보관·쪽 매핑 저장이라 CLAUDE.md 의 'Codex 선행'(저장·스키마) 조건에 걸리고,
B6 는 Codex(Sol high) 가 구현한 연속 레일이다. → **U2 처럼 "저장 변경은 Sol high 별도 묶음 → Opus 검토를
먼저" 를 U1.5 에도 둘지 로컬에서 Codex 에게 판정받아야 한다.** 레일(⑩-A2)은 지금 U1.5 를 Claude 단독 구현으로 적고 있다.

## 이미 있는 것 (재사용)

| 필요 | B6 에 있는 것 |
|---|---|
| 원문 Blob 보관·owner/epoch·삭제 세대 | `PM_INTAKE_V1` IDB, `sources[sourceId]` (hash·bytes·type·pageCount·generation·state) |
| 권 ↔ 원문 연결 | `linkSource(sourceId,setId,pages)` · `links[setId]` · `inheritLinks` · `detachSource` |
| 문항별 출처 | `p.intake.sources=[{sourceId,pages}]` — `normIntake` 통과, 클라우드·JSON 에는 sourceId·pages 만 |
| 원문 읽기 | `forProblem(setId,p)` → `{state,blob,pages}` · 없으면 '이 브라우저에 연결된 원본이 없습니다 · 다시 연결' |
| 같은 파일 재연결 | `reconnect(sourceId,file)` — hash/bytes/type 다르면 거절(옛 매핑 자동 이식 금지 = 계약 그대로) |
| PDF 쪽 그리기 | `browserRenderer().page(blob,n,cap)` (PDF.js 6.3.289 vendored) |
| 영속 저장 요청 | `persistence()` |
| 계정 전환 정지 | `stop()` · `onAuth` 가 `intakeClients.forEach(c=>c.stop())` |

## 빠진 것 (저장 계층 — Codex 판정 필요)

1. **수동 원문 등록 API 가 없다.** 원문을 만드는 길은 `createJob(files)` 하나뿐이다(AI 작업 전제).
   손으로 만든 문제집에 PDF 를 붙이려면 `registerSource(file, setId)` 같은 것이 필요하다 —
   §5-1 "Blob 저장과 첫 연결 기록이 **한 IDB 트랜잭션**에서 성공한 뒤만 '보관됨'", 같은 owner 안 hash 재사용,
   파일명으로 같다고 보지 않음, 쪽 수 검증.
2. **`linkSource` 의 `pages` 는 검사만 하고 버린다.** '이 문항 = n쪽' 은 어디에 저장하나?
   - 안 A: `p.intake.sources` 에 쓴다 (AI 출처와 같은 칸, 클라우드 동기화됨 — sourceId·pages 만이라 저작물은 안 나감).
     ⚠️ 그러면 수동 문항에 `intake` 객체가 생긴다 → `contentReview`/`classificationReview`(index.html:4168) 의미가
     수동 문항에도 붙는다. `normIntake` 기본값(`unknown`/`unreadable`)으로 둘지, 수동 매핑 표시(`origin:'user'`)가 필요한지.
     `library.commit` 경유 쓰기라 B3 CAS·B6 쓰기 보호(`intakeWriteAllowed`)를 탄다.
   - 안 B: IDB `links[setId].pages[problemId]` 에만 둔다 (기기 전용). 다른 기기에서 같은 파일을 다시 연결해도 매핑이 없다.
   - 계약(§5-1 표 '권 연결')은 "문항별 출처는 §3 의 `intake.sources` 에 보존" → **안 A 가 계약에 맞다.**
3. `forProblem` 은 **첫 출처 하나**만 돌려준다 — §7 의 "여러 원문/여러 쪽" 은 목록을 돌려줘야 한다(읽기 전용 확장이라 위험 낮음).

## UI 쪽 (Claude 몫 — 저장 API 가 정해진 뒤)

- U1 지면 보기(`#sheetPane`) 옆 **원본 패널**: 켜고 끄기, 좁은 화면은 U1 의 탭 방식(`pane-tab`) 재사용.
- 선택 문항(`selectSheetProblem`) → `forProblem` → 해당 쪽 그리기. 매핑 없으면 자유 탐색(쪽 넘기기).
- 수동: '원본 연결'(파일 선택) → 등록 → 현재 문항에 '이 문항 = n쪽' 지정. 여러 원문·여러 쪽.
- 없음/삭제/유실: 문구 그대로 + '다시 연결'. 다른 내용 파일은 새 원문 · 옛 매핑 자동 적용 금지.
- 계정 전환: 패널 비우기·object URL 해제·읽기 중단(epoch 검사).
- 지면 위 직접 타이핑 없음 — 수정은 문항 편집으로.
- 원문 관리(설정: 목록·용량·삭제·`persist` 상태)는 §5-1 이 요구 — `impact/deleteSource` 연결. U1.5 범위인지 확인 필요(⑩-A2 에는 '원문만 삭제' 검증이 있다 → 범위 안으로 본다).

## 검사 계획 (§7 U1.5 수용 증거)

수동 PDF/이미지 연결 · 여러 원문·여러 쪽 · 자유 탐색 · 다른 기기 missing(IDB 비운 컨텍스트) ·
내용 다른 재연결은 새 ID(옛 매핑 미적용) · 원문 삭제 뒤 문항·결과 유지 · 계정 전환 시 패널 정지 ·
B6 저장소만 사용(새 IDB 이름/키 없음 정적 검사). 각 항목 깨보기. PDF.js·KaTeX 가 CDN/벤더라
클라우드에서는 chromium 실제 PDF 렌더 검사를 CI 에 맡긴다(`vendor/pdfjs` 는 로컬이라 PDF 는 여기서도 됨).

## 로컬에 넘길 질문 (Codex — Astra high 또는 Sol high)

1. U1.5 의 저장 변경(수동 원문 등록 · 문항 쪽 매핑 저장 · `forProblem` 다중화)을 B6 연속 레일의 **Sol high 별도 묶음 → Opus 검토**로
   먼저 할지, Claude 구현 안에 넣고 Sol medium 검토로 충분한지.
2. 쪽 매핑 저장 위치: 안 A(`p.intake.sources`, 계약 §5-1 문구) 확정 여부와, 수동 문항에 생기는 `intake` 의 review/origin 의미.

---

## 부록 — 클라우드 세션 환경 메모 (2026-10-03 실측)

로컬 세션이 클라우드에 일을 넘길 때 알아 둘 것. 세션 분담 표(DEV-TOKEN-ROADMAP)에 없는 세부만 적는다.

- **막힌 호스트**(프록시 403): `cdn.jsdelivr.net`(KaTeX·KoPub·Pretendard·Sortable) · `sonarcloud.io` · `api.openai.com`·`chatgpt.com`.
  npm 레지스트리·PyPI·GitHub 는 열려 있다. 해리가 환경 설정 Network access → Custom 에 더하면 풀린다.
- **Playwright 브라우저 버전 불일치**: 저장소 `playwright@^1.62` 는 chromium build **1234** 를 찾는데 컨테이너에는
  **1194** 만 있다(`/opt/pw-browsers`). 저장소를 고치지 않고 scratchpad 에 심볼릭 링크 폴더를 만들어
  `PLAYWRIGHT_BROWSERS_PATH` 로 돌렸다. → **R6 의 Dependabot playwright PR 판단 때** 클라우드 실행 환경도 함께 볼 것.
- CDN 이 막혀 있어 KaTeX·글꼴 의존 브라우저 검사(예: `test:sheet` ⑨-a)는 클라우드에서 판정할 수 없다 — CI 가 판정한다.
- 이 초안은 U1.5 를 시작할 때 레일 문서·인계로 옮기고 지운다(일회용).
