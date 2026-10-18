# 변경 인계 — H1-e 사이트 시험지 조판 적용 조사·설계

- ID: `HANDOFF-2026-192`
- 날짜: `2026-10-15`
- 작성자: `Codex` (주 조사/설계, 독립 Codex 2명 + Claude 검토)
- 상태: `ready-for-review`
- 영향 영역: `docs`, `tests`
- 관련 이슈: `REV-2026-129`, `REV-2026-130` (confirmed, 미수정)

## 변경 내용

사용자가 한글 분석을 페다고지 사이트 모의고사/문제집의 글꼴·화면·출력에도 적용하도록 범위를 확장했다.
실제 입력→CSS/Typst/HWPX 경로와 기존 우회·측정 전달을 조사하고,
[사이트 조판 적용 계약](../../../docs/HWP-WEB-TYPESETTING-DESIGN.md)을 만들었다.

- 새 설계: 폰트 누락/대체·줄폭/높이·수식/인쇄 차이 구분, 역할/폰트·템플릿·측정 정체성,
  출력별 근거/unknown, REA의 다음 F01~F04 질문, H1-f1/f2/g/h의 작은 구현과 RED/완료 기준.
- 사이트 선지 측정 컨텍스트129와 글꼴 도착 전후 payload130을 자체 Chromium에서 재현했다.
  public `research/h1-web-typography-audit.json`에 소스/시험용 기존 폰트 hash·관찰/범위·정확한 fixture를 보존했다.
- `docs/DEV-TOKEN-ROADMAP.md`·`RAIL-ORDERS.md`·`HWP-RESEARCH-DESIGN.md`·`reviews/INDEX.md`와
  조판 스킬의 `references/research-workflow.md`를 갱신했다. 첫 구현은129/130의 준비/측정(H1-f1).
- 191의 구역 진단 완료는 유지하고 다음 요청의 사이트 적용 포인터를 추가했다.
  현재 branch `claude/launch-decisions`/HEAD2547a1e의 작업 트리에는190/191 등 앞선 변경도 있다.
  이번192는 **조사/설계·확정 이슈 기록**이며 제품 HTML/JS/CSP·Rules·저장 스키마·배포는 변경하지 않았다.

## 위험과 검토 요청

- 한글 정적 규칙을 브라우저 geometry로 그대로 전용하지 않는다. browser/typst 실측은 HWPX native 폭
  판정에서는 unknown이며 기존 수식 계약의 hancom-resaved/seed 구분을 유지한다.
- 129만 고치면 선지 배치도 폰트 타이밍에 민감해진다. **준비 경계를 먼저/같은 묶음으로 세우고
  컨텍스트를 교정**한다. 기존09/25 단폭·폰트/보정 계보와 auto 배치 전후를 대조한다.
- `currentData().problems`는 원래 state.problems 자체이므로 임시 측정 정보는 사본 payload만 사용한다.
  비동기 결과는 문서/계정/요청 generation이 맞을 때만 게시한다. mock의 실제 상태 수명과 host 경계를 확인한다.
- 폰트 load 성공/실패는 준비 근거다. 원본 font/glyph의 실제 사용과 미확인은 별도다.
  서버 폰트 의존·무기한 대기·미확인을 정상으로 표시하는 정책을 넣지 않는다.
- 상용 폰트 추출/가공/배포·새 직접 모의고사 브라우저 인쇄 UI·전체 공통 렌더러 구현은 이번 묶음에 없다.

## 검증

- **자체 재현 확인**: 주 구현자가 실제 CSS/measureCh/layoutOf·같은 Arial·영문 선지5개를 독립 실행.
  숨은20.6375mm vs 표시19.61224mm, 같은 safety20.6mm에서 auto2 vs1. 제품 수정/통과 판정이 아니라 기존 결함 증거다.
- **자체 재현 확인**: 실제 mock 전체 페이지/함수를 새 storage·외부 요청 전부 차단한 Chromium151에서 실행.
  같은 문항의 heightMm98.96→92.61, 본문397.97→358.92px, 선지 측정124.61875mm 유지.
  기존 Liberation Sans를 시험용 face로 뒤늦게 추가하고 CDP에서 실제 font 변경/측정 font 유지 관찰.
  독립 에이전트와 주 구현자가 각각 같은 결과를 냈다. 다운로드/인쇄/PDF 잘림을 관찰한 것은 아니다.
- **local-only 상태 실험**: 없는 local face의 명시적 load는 reject, status=error, check=false였다.
  따라서 CSS정의/has+check만의 원본/glyph 확인 한계와 명시적 load의 준비 상태 근거를 구분했다.
- **코드 음성 검색**: mock-exam-editor.html에 `window.print()`/`@media print` 없음.
  일반 문제집 브라우저 인쇄와 모의고사 Typst/HWPX→PDF 경로를 구분한다.
- 독립 Codex가 `test:mock-layout` PASS 확인(현재 정적 기하 검사). 이번 폰트/시점 문제를 검출하는 검사는 아니다.
- **PASS** `npm run check:static`: 기존 정적/접근성·문서·조판 역할 검사. 새 레이아웃 기능의 검증은 아니다.
- **PASS** `npm run check:review-hygiene`: 이슈130(열림6)·INDEX119/120·최근5·자기검사6.
- **PASS** `npm run test:mock-layout`: 주 구현자도 실행, 기존 제목/구획 태그의 기하 검사2종.
- **PASS** 스킬 quick_validate(Anaconda Python), `git diff --check`.
- **미실행**: 제품 기능 수정이 없어 기존 전체 브라우저/회귀167·`check:fast`를 재실행하지 않았다.
  새 정식 회귀/RED는 H1-f1 구현에서 작성한다. 이번 private probe를 통과한 제품 검사로 세지 않는다.
  Safari/Firefox/Windows·실제 PDF/새 한글 native 경로는 미시험이다.

## 다음 검토자에게

검토 범위는192의 새 설계·129/130과 관련 포인터/스킬 참조다. 기존190/191 변경을 새 구현으로 혼동하지 않는다.
다음 구현은 H1-f1: 준비/타임아웃/취소·측정 컨텍스트·generation·상태 표시를 함께, 한 명만 작성한다.
원문/선지/수식 순서 보존, state 오염 없음, 고장/지연/무서버/file://·이전 정책 RED를 포함하고
CSP·지문/정답표와 실제 사이트/출력 경로를 함께 확인한다. 변경별 필수 게이트는 설계 §6을 따른다.

로컬 증거: `/private/tmp/hwp-web-2026-10-15/`의 probe-measure-context.cjs·measure-context.json,
probe-font-timing.cjs·font-timing.json, claude-site-design-*·claude-site-followup-*.
공개 JSON에 fixture문자/소스hash/브라우저/범위를 남겨 임시 파일이 사라져도 재현할 수 있게 했다.
커밋·푸시·배포 없음. transcript.txt는 읽기/수정/추가하지 않았다.

## 검토 기록

- `2026-10-15` · Codex 독립 에이전트2명 — 코드 경로/우회/한계 조사, 자체 DOM/CDP 재현.
  주 구현자가 두 반례와 실제 사용 font를 독립 실행으로 확인했다.
- `2026-10-15` · Claude 1차(opus/high 요청, 실제 모델 metadata 미제공) — 지목6개 구간 읽기만 수행.
  경로/REA와웹 구분·수식 계약 재사용·첫 구현 배정 합의. 준비 경계와 컨텍스트 교정의 순서,
  source 매핑·sheet/print 진입 차이·계보·원문/상태 보존·사용자 상태 표시·RED5건 보완을 반영했다.
  local-only face의 API 판정 불가 주장은 명시적 load 실패 실험으로 준비/실사용 구분을 보완했다.
- `2026-10-15` · Claude 2차 — 지목4개 문서/공개 관찰 읽기만 수행, 준비 상태/실사용 구분과 보완 계약에 합의.
  새 코드 감사/검사 실행 없음. load 성공을 실제 glyph verified로 승격하지 않는 RED와 음성 face 조건 필드도 반영했다.
  **합의: H1-e 사이트 적용 계약 검토 종료 / 미합의: 없음 / 근거: 코드·독립 DOM/CDP 재현·공개 JSON /
  다음 행동: H1-f1에서 준비 경계130을 먼저/동시에 세우고 컨텍스트129를 교정**.
