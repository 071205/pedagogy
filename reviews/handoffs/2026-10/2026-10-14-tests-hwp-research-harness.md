# 변경 인계 — H1-a 한글 실험 하네스와 패키지 표본

- ID: `HANDOFF-2026-189`
- 날짜: `2026-10-14`
- 작성자: `Codex`
- 상태: `reviewed` — Claude 검토 2026-10-14: 결함 1(창 목록 신뢰) 수정 · 검사 공백 1 보강 · 실물 재현·보존·PDF 확인. 수정분은 Codex 검토 대상
- 영향 영역: `tests`, `docs`
- 관련 이슈: `없음` (기존 열린 074·075·093·108은 변경하지 않음)

## 변경 내용

사용자 요청에 따라 H1 설계 이후 첫 구현 묶음에서 마감했다. 제품 HWPX 엔진·템플릿은 바꾸지 않았다.
조사 지식·실물 결과·후속 실험은 [결과 문서](../../../docs/HWP-RESEARCH-RESULTS.md),
원래 설계와 Claude 3회 합의는 [HANDOFF-188](2026-10-14-docs-hwp-research-design.md)에 있다.

- `scripts/check-hwpx-opens.mjs`: 전체 창 닫기 제거, 정확한 시험 이름만 닫기, 기존 창 skip,
  UI 실패 unknown/중단, 알려진 오류 대화상자만 처리, JSON 보고서와 종료 코드 구분.
- `scripts/lib/hwpx-open-probe.mjs` + `scripts/check-hwpx-open-probe.mjs`: 정책 분리, 가짜 UI 9종과 red/baseline 검사.
- `scripts/build-hwp-research-fixtures.py` + `scripts/check-hwp-research-fixtures.py`: 앞뒤 대조군 포함
  8개 표본, 해시/변경 파트/환경 manifest, 덮어쓰기 방지, 표본 오염 red.
- `scripts/check-hwp-research.mjs`·`package.json`: `test:hwp-research` 추가, `check:fast` 연결.
- `experiments/hwp-export/research/h1-package-01.json`: 실제 관찰 manifest. 바이너리/REA 의사코드는 저장소에 넣지 않음.
- 설계·결과·통합 레일·RAIL-ORDERS·INDEX 갱신. `transcript.txt` 접근 없음. 커밋/푸시 없음.

## 위험과 검토 요청

1. 제목 기반 창 식별과 예외 경로가 기존 문서를 닫거나 오류를 pass로 분류하지 않는지 확인한다.
   실제 시험 종료 시 창은 0개였다. 초기 빈 문서 창이 앱 자체에서 대체됐는지는 미확인이다.
   가짜 UI 보존 통과와 실제 사용자 문서 보존을 혼동하지 않는다. 검토 전에는 사용자 작업 없는 세션에서만 실행한다.
2. 패키지 ID/경로·spine의 단일 표본 열기 관찰을 일반 규칙으로 승격하지 않았는지,
   저장·본문·PDF 미확인이 명확한지 확인한다. 두 차례 중단된 실행은 최종 관찰에서 제외했다.
3. 한글 앱을 자동화하는 테스트는 `check:fast`에서 돌지 않는다. Node/Python 검사만 연결했고
   Python/lxml 미설치 시 명시적 skip이다. 완전 검증에는 `HWPX_REQUIRE=1`을 사용한다.

## 검증

- **PASS** `HWPX_PYTHON=/Users/huryul/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 HWPX_REQUIRE=1 npm run test:hwp-research`:
  창 보존/기존 창/권한/예상 밖 대화상자/시간 초과/정리 실패/거부/늦은 오류 등 9종,
  8개 표본의 해시·변경 파트·덮어쓰기 방지·미관찰 값 검증.
- **RED 확인** 위 실행 안의 `H1_OPEN_RED=1`: `UNRELATED_WINDOW_CLOSED`로 exit 1;
  `H1_FIXTURE_RED=1`: `UNRELATED_PART_CHANGED`로 exit 1. 모두 예상 실패 원인까지 검사했다.
- **기준 버전 RED 확인** `H1_OPEN_BASELINE=d4762f6 node scripts/check-hwpx-open-probe.mjs`:
  이전 전체 창 닫기가 `UNSCOPED_CLOSE`로 exit 1. 현재 정책 전체를 과거 버전에 실행했다는 주장은 아니다.
- **실물 완료** Mac 한글 12.30.0/6446에서 8건: pass 5, 거부 3, unknown/skip 0.
  앞뒤 정상 대조군 통과. 음성 대조군을 포함하므로 CLI exit 1이 예상 결과다.
  최종 `/private/tmp/h1-package-20261014-a/open-results-3.json`과 문서의 영구 manifest 참조.
- **PASS** `npm run check:static`: 출시·접근성·문서 블록·디자인/조판 역할 및 리뷰 위생.
- **PASS** `npm run test:public`: CSP 해시/실패 주입, 공개 빌드 재현성·비공개 자료 제외.
- **PASS** 최종 문서 갱신 뒤 `npm run check:review-hygiene`(INDEX 119/120줄·최근 5/5),
  `git diff --check`, 신규 파일 공백·로컬 문서 링크·영구 manifest 결과 대조.
- **미실행** 저장/재열기/PDF/폰트·내용 시각 대조/Windows/실제 기존 문서 보존: 다음 실험 범위.
  `regression-test.html`, 브라우저·전체 `check:fast`, Worker 테스트는 미실행: 제품/Worker/브라우저 코드 변경 없는 로컬 연구 하네스 묶음이다.
  CUA 초기화는 로컬 kernel assets 오류로 실행되지 않아 기존 AppleScript 경로로 실물 열기를 확인했다.

## 다음 검토자에게

현재 branch `claude/launch-decisions`, 기준 HEAD `fc3aecc8048de1532f4e222198f31b05ca3aeeed`.
미커밋 작업 트리에는 HANDOFF-188 설계 변경도 함께 있다. 위에 나열한 신규/수정 파일을 대상으로
실제 diff를 독립 검토하고 결과를 이 파일에 기록한다. **이번 구현에는 Claude 검토를 아직 호출하지 않았다.**
설계 합의가 구현 승인인 것은 아니다. 새 모델 호출 없이 사용자 요청대로 여기서 마감·인계한다.

우선 읽을 코드는 CLI, 정책, 정책 검사, 생성기, 표본 검사, 결과 문서 6개다.
검토 후 직접 만든 기존 문서 보존 시험 → 열렸던 변형의 본문/저장/PDF → 여러 구역 실험 순서로 이어간다.
새로운 native 분석은 이 실물 결과로 질문을 좁힌 뒤 수행한다. 설치·인증·이전 REA 조사를 처음부터 반복하지 않는다.
현재 생성기와 실제 표본 생성 시점의 해시는 lxml 버전을 tuple 대신 list로 기록한 수정 때문에 다르다.
manifest는 실제 생성 시점 해시를 보존하며 표본 내용 변경은 없다.

## 검토 기록

- `2026-10-14` · Codex 구현자 · 한 묶음 완료 및 미검증 항목 인계 · Claude 독립 검토 대기.
- `2026-10-14` · **Claude(Opus 5.5) 검토** — 사용자 지시로 이 갈래를 이어받았다. 코드 6개를 읽고 검사를 직접 다시 돌렸다
  (anaconda Python · lxml 5.2.1 로도 PASS · RED 둘 재현).
  - **정책 모듈에 고장 다섯을 심어 봤다**(저장소 밖 사본): 느슨한 이름 일치 · 열기 전 창 닫기 · 시간 초과 뒤 계속 · 늦은 오류 재확인 제거는
    전부 빨간불. **'오류를 해제했는데 다른 대화상자가 남음' 은 초록불로 통과했다** — 그 장면이 없었다. `stickyDialog` 시나리오를 더해
    지금은 빨간불이다(10 시나리오). 기존 `H1_OPEN_RED` 는 가짜 어댑터를 깨는 것이라 정책을 지키는지는 위 실험이 보여 준다.
  - **결함(수정함)**: macOS 접근성은 한글이 **앞에 있지 않으면 창을 0개로** 보고한다(실측 — 열린 문서 그대로, 목록만 빔).
    `snapshot()` 이 빈 목록을 믿으면 '이미 열린 같은 이름 문서' 를 못 보고 다시 열어 옛 내용으로 판정한 뒤 **그 문서를 닫는다.**
    매 스냅샷 전에 `activate` 하고 앞이 아니면 오류(→ unknown·중단)로 바꿨다.
  - **보강**: 거부 대화상자의 단추 이름을 `dialogButtons` 로 보고서에 남긴다 — 실물 세 건 모두 `확인` 하나였다.
  - **실물**: 새로 만든 표본으로 8건 결과 그대로 재현 · 직접 만든 비어 있지 않은 문서를 연 채로 돌려 보존 확인 ·
    열린 변형 넷의 PDF 에 본문이 그대로 있음(spine 참조가 없어도). 결과 문서 '재현·보존·본문 확인' 절.
  - CLAUDE.md 의 열기 검사 함정 목록(같은 이름 창을 닫는다 → skip, 앞에 있어야 함, 종료 코드)을 새 정책에 맞췄다.  - **Claude 수정분은 Codex 검토 대기** — 2026-10-14 요청이 Codex 사용량 한도(2026-10-15 00:43 해제)로 실행되지 않았다.
    물을 것: `snapshot()` 의 `activate` 가 폴링마다 포커스를 가져오는 부작용, 빈 창 목록을 '모름' 으로 다루는 대안.

