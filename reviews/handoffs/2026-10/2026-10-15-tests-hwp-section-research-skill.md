# 변경 인계 — H1 구역 처리 심화 분석·조판 스킬 개정

- ID: `HANDOFF-2026-190`
- 날짜: `2026-10-15`
- 작성자: `Codex` (주 구현·REA·실물 시험)
- 상태: `ready-for-review`
- 영향 영역: `tests`, `docs`
- 관련 이슈: `REV-2026-160`(처음 `REV-2026-118` 로 적었으나 main 의 같은 번호와 겹쳐 재부여), `REV-2026-119`~`REV-2026-122`, `REV-2026-124` (모두 수정·resolved)

**재개 후 현재 상태**: 사용자 사용량 초기화 뒤 Claude 읽기 전용 검토를 재개했다.
정책20종·같은 수의 창 교체/close 후 잔류 수정, 수식 RED 안정화, 스킬/두 계약 보완을 완료했다.
아래17종/계정 한도/제품 미반영 표시는 당시 연구 단계의 기록이다.
제품 구역 진단·50사례·브라우저/실물 검증의 현재 인계는 [HANDOFF-191](2026-10-15-mock-hwpx-section-diagnostics.md)이다.

## 변경 내용

한글 빌드가 6446→6544로 바뀐 것을 해시/Info.plist로 확인하고 새 ARM64 사본에서 REA 함수 5개를 분석했다.
`secCnt` 읽기→리더 개수 전달→`section%d` 키 조회→실패 분기를 정적으로 연결했다.
두 구역 자체 표본 11건과 PDF·왕복 저장으로 개수 축소의 본문 누락과 ID 배정의 순서 변화를 실증했다.
지식은 [H1 결과](../../../docs/HWP-RESEARCH-RESULTS.md), 원래 계획은 [설계](../../../docs/HWP-RESEARCH-DESIGN.md)에 있다.

- `.claude/skills/hwpx-element/SKILL.md`·`references/research-workflow.md`: 빌드/해시 재개,
  근거 종류, 파트/참조/순서 격리, 내용·전체 PDF·왕복 판정, 에이전트 협업·중단 회수 절차.
- `scripts/build-hwp-section-fixtures.py`·`check-hwp-section-fixtures.py`: 두 구역 11종 생성과 독립 변형 검사.
- 기존 `build-hwp-research-fixtures.py`·`check-hwp-research-fixtures.py`: RDF 참조까지 맞춘 경로 표본·참조 RED 추가.
- `scripts/lib/hwpx-open-probe.mjs`·`check-hwpx-open-probe.mjs`: 거부 후 모호한 창 중단,
  새 창 수가 확인되지 않는 제목 변경/병합·늦은 병합 모의 중단, 잔류 무제목 창 중단,
  `rejectionObserved`·창 수 기록, 정리 후 기존 창 감소 중단. 정책 17종과 과거 정책의 개별 RED 모드.
- `scripts/build-hwp-equation-fixtures.py`·`check-hwp-equation-fixtures.py`: 분수/행렬/긴 합의 geometry7종, 독립 입력 의미·본문/수식 순서 oracle와 RED.
- `scripts/check-hwp-research.mjs`: 새 검사·RED를 기존 `test:hwp-research`/`check:fast` 경로에 포함.
- `docs/HWP-SECTION-DIAGNOSTIC-CONTRACT.md`: inspect/export 프로필·구역 catalog·오류 전달·호환/검사 계약 초안. 제품 미반영.
- `docs/HWP-EQUATION-LAYOUT-CONTRACT.md`: 활성 단/문단 폭 상한·seed/실측 정체성·overflow/within-upper-bound/unknown 계약 초안. 제품 미반영.
- `AGENTS.md`·CLAUDE.md: 사용자 2026-10-15 승인으로 협업 3회 상한 제거. 읽기 전용 wrapper/독립 검증/단일 구현자·새 이견만 왕복 규약 유지.
- `experiments/hwp-export/research/h1-native-6544.json`, `h1-section-02.json`, `h1-package-01-linked.json`, `h1-equation-03.json`, `h1-native-equation-6544.json`:
  주소/Evidence·해시·환경·단계별 실제 관찰. 제3자 바이너리·의사코드·PDF는 저장소에 넣지 않음.
- 레일·요소 근거·INDEX·이전 인계 연결. 사용자 기존 문서 수정과 `transcript.txt` 접근 없음. 커밋/푸시 없음.

## 위험과 검토 요청

- 단일 Mac build 6544·직접 만든 두 구역의 관찰이다. Windows·여러 구역/버전 전체에는 미검증.
- `secCnt=1`은 열리고도 B가 누락됐다. 새 validator 강제 규칙은 **미채택**이며 다음 H1-c에서
  우리 생성 패키지 범위·호환·진단/실패 정책·Python/JS parity를 확정한다.
- 창 수 guard는 제목만 바뀐 기존 창을 닫지 않으려는 보수적 unknown 정책이다. AXDocument가
  missing value라 경로/탭 정체성 추적은 못 한다. 동시 사용자 조작 없는 시험 세션에서 사용한다.
- 과거 전체 cohort와 창 수 guard 이후 중단된 후속 실험은 분리했다. 마지막 ID 거부 후 새 빈 창은
  `rejectionObserved=true`·`cleanup-incomplete/unknown`으로 기록한다. 자동 닫기를 하지 않는다.

## 검증

- **PASS** `HWPX_PYTHON=/Users/huryul/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 HWPX_REQUIRE=1 npm run test:hwp-research`:
  정책 17종, 패키지 9종, 구역 11종, 수식 7종. `UNRELATED_WINDOW_CLOSED`, `UNRELATED_PART_CHANGED`,
  `PATH_REFERENCE_STALE`, `SECTION_ORDER_MUTATION_LOST`, `EQUATION_GEOMETRY_MUTATION_LOST`,
  `EQUATION_INPUT_MEANING_LOST`, `EQUATION_MIXED_ORDER_LOST` 각각 예상 exit 1 확인.
- **기준 RED** `H1_POLICY_BASELINE=2547a1e H1_OPEN_SCENARIO=<case> node scripts/check-hwpx-open-probe.mjs`:
  `ambiguous-recovery`는 `RECOVERY_AMBIGUITY_CONTINUED`, `merged`/`merged-after-reject`는
  `MERGED_WINDOW_CLOSED`, `late-merge`는 `LATE_MERGED_WINDOW_CLOSED`로 각각 exit 1.
  `residual-recovery`는 `RESIDUAL_RECOVERY_CONTINUED`, `existing-loss-after-reject`/`existing-loss-after-close`는
  `EXISTING_WINDOW_LOSS_CONTINUED`로 exit 1. 기존 정책 총7경로 RED.
- **실물** 두 구역 열기 11건: pass 7·거부 4. 열린 PDF 7건/13쪽 전체 렌더,
  정상 A/B와 개수 축소 A 직접 눈 확인, 나머지 대응 쪽은 픽셀 해시 동일.
  control·count-one 저장→닫기→재열기 모두 pass, PDF 두 건/3쪽 전후 쪽 해시 동일.
  count-one 저장본에는 section1 XML도 없음. 입력/저장/PDF/PNG 해시는 영구 manifest에 보존.
- **수식 실물** 7건 열기·PDF7쪽 생성, control/spacing 직접 눈 확인·나머지 래스터 동일.
  control/all-zero/spacing 새 사본 저장→재열기3건 pass→PDF3쪽, 전후 래스터 동일.
  모든 표본의 긴 합은 본문 폭을 2386 HWPUNIT 초과해 지면 품질 fail로 기록(페이지 끝 잘림은 미관찰).
  저장본3개의 수식 script/기하 속성 정규화는 manifest에 보존. 기본 geometry/API는 미변경.
- **실물 하네스** 최소화된 자체 문서가 목록에 남고 unknown으로 중단함을 확인(최소화 skip/close는 미시험).
  최종 정책 정상/linked/정상 3건 pass, 마지막 ID 거부는 잔류 빈 창 때문에 unknown·중단.
  기존 keeper는 보존. UI 시험 후 우리가 만든 창만 정리했다.
- **PASS** `npm run check:static`, `npm run test:public`. 공개 런타임·CSP 변경 없음.
- **PASS** `npm run test:hwpx`: 일반 샌드박스에서 localhost bind 검사 2건 PermissionError.
  승인된 로컬 fixture 서버 실행으로 재검사해 12건 + concurrency/exception 검사 통과.
- **PASS** `npm run check:codex-bridge`, `npm run check:claude-bridge`: 모델 호출 없는 래퍼/스킬 연결 검사.
- **PASS** `/opt/anaconda3/bin/python3 .../.system/skill-creator/scripts/quick_validate.py .claude/skills/hwpx-element`.
  기본/번들 Python에는 yaml이 없어 이 설치된 Python으로 확인했다. 새 의존성 설치 없음.
- **스킬 사용 평가** 독립 Codex 에이전트가 현재 스킬·원시 표본으로 실제 요청 판단:
  열기만으로 secCnt 무시를 채택하지 않았고, 빌드 변경 주소 재검색·내용/PDF·왕복·중단 기록을 선택했다.
- **미실행** 전체 `check:fast`, 브라우저/`regression-test.html`, Windows: 변경은 로컬 연구 도구·스킬이고
  제품/브라우저 엔진을 수정하지 않았다. 제품 적용 때 해당 parity·브라우저·회귀 게이트를 실행한다.

## 다음 검토자에게

기준 HEAD `2547a1e`, branch `claude/launch-decisions`의 작업 트리다. 사용자 기존 스킬/CLAUDE.md 문구 수정도
함께 있었으며 되돌리지 않았다. 인계 189의 Claude 포커스 수정은 독립 Codex가 읽고 정책 검사·실물 증거로 대조했다.
본 인계는 연구·하네스·스킬 범위다. 두 계약 Claude 검토와 구역 제품 적용은 재개 후 완료했다.
현재 다음 행동은191과 수식 폭 계약을 따른다. 수식 가상 호출 바인딩/실측 출처는 미확인이다.

로컬 증거는 `/private/tmp/hwp-rea-2026-10-15/`: `evidence.json` 11 records/2,280,461 bytes,
`analysis.snapshot.json` 4,536,899 bytes, `package-c/`, `sections/`, `equations/`, Claude 왕복 답변/로그.
수식 native 후속은 `equations/evidence.json` 35records/6510956bytes, snapshot12942317bytes,
`native-review.json`(핵심8개 dossier). snapshot의 기존 질의 재사용과 새 쿼리의 live import/144초 분석을 구별한다.
REA close는 소유 PID 정리 확인의 sysctl 오류를 보고했지만 이후 `binary_session open=false`,
승인된 `ps -p 13114`에서 프로세스 없음 확인. 분석 실패나 모델 거절로 기록하지 않는다.
원문이 없어져도 공개 manifest의 해시/주소/질문으로 재개한다.

## 검토 기록

- `2026-10-15` · Codex 하네스 독립 에이전트 · 118 재현→수정 검증. 이후 확인 시점 guard 공백 119 재현, 수정 반영.
- `2026-10-15` · Codex 스킬 설계·별도 사용 평가 에이전트 · 근거/재개/참조/내용 판정 공백 제안과 개정 스킬 사용 판단 확인.
- `2026-10-15` · Claude (`opus`/`high` 요청, 실제 모델 metadata 별도 미제공) 1차 · 최소화 경로 가능성·frontmost 시험·RDF 잔존 참조 지적.
  최소화 누락은 미재현, 문자열 존재 검사로 동작을 대신하지 않고 실물 대조. RDF 참조 대조 표본 추가.
- `2026-10-15` · Claude 2차 · 최소화 관찰 범위를 unknown 중단으로 한정하는 판정 수용,
  RDF 보완 수용. 제목 변경/탭 병합 가능성과 거부 근거 보존을 제안해 정책 보강·반례/RED 추가.
- `2026-10-15` · Claude 3차 최종 · 앞선 이견 해소 확인. 승인 범위 밖 구역 검사 자체는 미검토라고 명시.
  잔류 복구 창의 focused RED 추가와 정리 후 기존 창 수 감소 후보를 지적했다. 후자는 두 모의 반례로 재현,
  120 수정·정책17종 PASS·Codex 독립 재검토 완료. 스킬 추가 전송은 당시 자동 승인 검토가 거절해
  모델 시작 전에 원래6파일로 좁혔다. 사용자는 이후 모든 관련 검토 전송을 승인했다.
- `2026-10-15` · 사용자: Claude 호출 상한을 명시 해제. AGENTS/CLAUDE/설계에 반영했다.
  추가 4차 호출은 하네스·수식 생성/검사·스킬6개에 대한 읽기 전용이었으나 실제 계정
  `You've hit your session limit · resets 5am (Asia/Seoul)`로 exit1. 검토 답변 없음.
  이 실패는 승인 거절·REA 정책 거절·timeout과 다르다. 반복 호출하지 않았다.
- `2026-10-15` · Codex 수식 검사 독립 에이전트: 변환기와 manifest의 공통 오류, 혼합 순서 공백121 재현.
  독립 oracle 수정 후 동일한 convert='x'·AFTER 앞 이동 주입이 각각 정확한 code로 실패하고 연구 게이트 PASS 확인.
- `2026-10-15` · Codex 구역 계약 독립 에이전트: 실제 API/caller/로드/출력 경계를 대조했다.
  inspect의 미참조 구역 활성 추측 완화, strict code prefix, 큰 선언의 십진 문자열 비교를 초안에 반영했다.
  수정 후 실제 API 정합성을 확인했고, 앞뒤 XML 공백만 허용하는 lexical 문구·반례를 추가했다.

- `2026-10-15` · Codex native 독립 에이전트: 속성 read/write·eqed dispatch→script 준비/측정 후보를 대조했다.
  버전/컨텍스트/width flag 조건과 가상 호출 미연결을 유지하면 해석이 맞다고 확인했다.
  원시12개 dossier 중 번호 매김 false lead2개는 제외했고 공개 사실/Evidence만 영구 기록했다.
  후속 close도 sysctl 오류였지만 open=false와 정확한 PID25426 없음 확인, snapshot 보존 완료.
- `2026-10-15` · Codex 수식 폭 계약 검토: 실제 템플릿 단폭31508/31550, seed/실측 구분,
  활성 설정과 unknown 정책을 대조했다. 첫/후속 줄 중 최대 허용 상한, seed변경의 새 identity/재측정 조건을 보완했다.
  이 검토는 Claude 독립 검토·제품 적용을 대체하지 않는다.

## Claude가 이어받을 범위

완료 검사를 반복하지 말고191의 현재 범위부터 읽는다. 연구·수식 oracle/스킬은 Claude 재검토에서
122/124를 수정한 뒤 해소됐고, 구역 계약/제품 진단도191로 진행했다. 다음은 수식 폭 계약의
context→측정 정체성→진단 구현이다. 한 명만 구현하고 긴 수식을 width 상수 교체만으로 해결됐다고 하지 않는다.
남은 가상 호출 바인딩·측정 출처와 Windows/다른 빌드 검증은 별도로 판정한다.

### 사용량 초기화 뒤 검토·검증

- Claude A: 같은 수의 기존 창 교체122·equation RED의 고정 문단 index/없는 속성 복원 지적.
  창 제목 multiset/NFC 보존 guard·기준 RED2개, equation 대상 탐색·사전 단정을 반영했다.
- Claude B: 두 계약의 canonical API/독립 root guard/문자열 수치/기존 참조 합집합,
  수식 상한·세로 unknown·strict와 분리 조건에 합의했다.
- Claude C/D: close 후 잔류124를 재현해 unknown/다음 skip으로 수정했고, 코드 조건으로 해소 확인.
  정책20종 PASS, 기준 `2547a1e`의 residual-after-close는 `RESIDUAL_CLOSE_CONTINUED` RED.
  관련 ID 집계와 일반 리소스 target 분류의 이견은191의 세 티어로 해결했다.
- 최종 `test:hwp-research`: 정책20·패키지9·구역11·수식7종과 실패 주입7개 PASS.
  요청 모델은 매번 opus/high, 실제 모델 metadata 별도 미제공. 답변/프롬프트는 로컬 temp의
  `claude-resume-{a,b,c,d,e}-*`; E 최종 제품 검토 판정은191에 남긴다.

원본/저장본/PDF는 임시 디렉터리, 영구 해시/근거/상태는 research JSON과 docs에 있다.
현재 앱의 우리가 만든 시험 창은 정리했다. 커밋/푸시는 하지 않았다. transcript.txt는 읽기·수정·추가하지 않았다.
