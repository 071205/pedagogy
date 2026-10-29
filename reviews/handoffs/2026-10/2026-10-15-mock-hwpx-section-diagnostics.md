# 변경 인계 — H1-d 구역 패키지 진단·출력 차단

- ID: `HANDOFF-2026-191`
- 날짜: `2026-10-15`
- 작성자: `Codex` (단일 구현자)
- 상태: `ready-for-review`
- 영향 영역: `mock`, `tests`, `docs`
- 관련 이슈: `REV-2026-123`, `REV-2026-125`~`REV-2026-128` (resolved)

사용자 후속 요청의 사이트 화면/글꼴/시험지 적용은 [HANDOFF-192](2026-10-15-docs-hwp-web-typesetting.md)로
이어졌다. 구역 진단 완료는 유지하며 다음 구현 우선순위는 H1-f1의 측정 컨텍스트129·폰트 준비130이다.

## 변경 내용

REA/실물로 확인한 secCnt 축소의 본문 누락을 우리 출력에서 차단했다.
[구역 계약](../../../docs/HWP-SECTION-DIAGNOSTIC-CONTRACT.md)의 inspect/export 프로필을
Python·JS에 함께 구현했다. 연구·스킬·하네스의 별도 인계는 [190](2026-10-15-tests-hwp-section-research-skill.md)이다.

- `experiments/hwp-export/pedagogy_hwpx.py`·`hwpx-engine.js`: 정확한 XML root/namespace,
  물리 구역 catalog·manifest ID/href·secCnt 진단, 독립 필수 파트 guard, 기존+별칭 참조 검사 합집합,
  stable code/정렬/비변조, strict→save/toBlob 출력 차단. 선언 수는 정규화한 십진 문자열로 비교한다.
- 실제 구역/canonical 슬롯/ID 이름만 일치하는 리소스를 구별한다. ID 중복은 유지하고 일반 리소스
  alias를 구역 파손·target 중복으로 오진하지 않는다. 같은 누락 원인의 strict 메시지는 한 번만 표시한다.
- 최종 검토126~128: 그림 writer가 미래 구역 ID도 피하고 이미지 참조/바이트를 보존한다.
  일반 item의 href 누락은 양쪽 동일하게 차단하고, JS xmlns 선언은 글꼴 참조에서 제외한다.
  이 두 기존 참조 검사 차이를 현재/기준 코드에서 독립 재현한 뒤 좁게 보완했다.
- `scripts/check-hwpx-section-package.py`·`.mjs`: 독립 기대와 실제 DOM parity56사례,
  save/toBlob 거절·정상 재열기·입력 내용 보존·root guard·profile·RED 모드.
  기존 `test:hwpx`와 새 `test:hwpx-sections`(`check:fast` 포함)에 연결했다.
- `research/h1-section-output.json`: 정상1/2/3구역 Mac 열기/PDF·본문/쪽 해시와 최신 출력의 바이트 동일성.
- 두 계약·결과/설계·요소 근거·스킬 참조·통합 레일/INDEX를 현재 구현 범위에 맞게 갱신했다.
  새 shipped 런타임 파일은 없으며 기존 engine만 변경했다. HTML/inline CSP·서비스 Worker·Rules 변경 없음.

## 위험과 검토 요청

inspect는 일반 조사 API, export는 현재 편집 API의 canonical 지원 범위다. 유효한 alias/ID 배정 교환을
일반 HWPX 파손으로 표현하지 않는다. 자동 경로 변경·본문 삭제·secCnt 수선은 하지 않는다.
기존 canonical validation API의 물리 section0 요구는 유지한다. 경고 UI는 이번 범위 밖이다.
수식 폭/세로 fit·alias 편집 resolver·itemCnt 일반 lexical 처리·Windows/다른 한글 빌드는 미완료다.
단일 Mac3구역의 출력 성공을 전체 호환성 승인으로 표시하지 않는다.

## 검증

검사 Python은 lxml이 있는 `/Users/huryul/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`이다.
다음 HWPX 명령은 `HWPX_PYTHON=<해당 경로> HWPX_REQUIRE=1`로 실행했다.

| 검사 | 결과·확인한 것 |
| --- | --- |
| `npm run test:hwpx` | PASS — 기존12종·동시성/예외 복구, 새 Python56사례 |
| `npm run test:hwpx-sections` | PASS — 실제 Chromium DOM/Python56사례 전체 진단, strict/Blob gate, ZIP 재열기·내용 보존 |
| `npm run test:hwpx-browser` | PASS — 일반 문서3종 XML/ZIP parity와 정상·고장 주입 검증기6종 |
| `npm run test:hwpx-exam` | PASS — 역할22종·문단13·배치7·표3·시험지9문항 대조 |
| `npm run test:audit-browser` | PASS — serve.py/regression-test.html167/167·잘못된 JSON root12건 거절 |
| `npm run test:hwp-research` | PASS — 정책20·패키지9·구역11·수식7종과 실패 주입7개(상세190) |
| Mac Hancom12.30.0 build6544 | 정상3파일 열기/PDF PASS,1/2/3쪽·전체6쪽 렌더/표식 순서/3고유 이미지 확인. 최신 재생성3파일이 실제 시험 파일과 바이트 동일 |

**RED (모두 예상 exit1, 실제 실행):**

- `H1_PACKAGE_BASELINE=2547a1e <Python> scripts/check-hwpx-section-package.py` 및
  `H1_PACKAGE_JS_BASELINE=2547a1e ... node scripts/check-hwpx-section-package.mjs`:
  새 API 부재에 앞서 `SECTION_COUNT_LOSS_UNBLOCKED`로 실패.
- `H1_PACKAGE_RED=duplicate-missing` / `H1_PACKAGE_JS_RED=duplicate-missing`:
  `SECTION_DUPLICATE_MISSING_MESSAGE`로 실패.
- `H1_PACKAGE_RED=resource-classification` / `H1_PACKAGE_JS_RED=resource-classification`:
  `UNEXPECTED_SECTION_DIAGNOSTIC`로 실패. Python/JS의 같은 오진이 parity로 숨는 것을 방지한다.
- `picture-id` / `missing-href` / `namespace-ref`의 양쪽 RED:
  `PICTURE_RESERVED_ID` / `MANIFEST_HREF_MISSING_UNCHECKED` / `NAMESPACE_DECLARATION_AS_FONT`로 실패.
  정상56사례에서는 전체 references 메시지·그림 링크/바이너리 왕복도 대조한다.
- JS `picture-id-parity` RED: 예약 규칙을 지키는 `section1-2`를 생성해도 Python의 `section1_2`와
  달라 `SECTION_PACKAGE_PARITY`로 실패. 그림 writer 생성 ID/href 자체까지 비교한다. 양쪽 RED 총13경로.
- 하네스의 같은 수의 창 교체2개·close 후 잔류1개 기준 RED는190·122/124에 있다.

샌드박스 Chromium/localhost 제약은 승인된 로컬 실행으로 해결했다. 기본 Python의 lxml 부재로
브라우저/시험지 대조가 처음 생략됐으나 위 Python 경로를 지정한 재실행은 생략 없이 통과했다.
전체 `check:fast`는 실행하지 않고 이번 변경에 맞는 위 게이트를 선택했다. 이 macOS 환경에 없는
Windows/다른 빌드는 미검증이다. 이번 새3구역 파일의 한글 재저장/재열기는 미시험이며 이전 두 구역
왕복 결과와 구별한다. 예약 이름 그림 사례는 링크/바이너리·브라우저ZIP까지 검증했고 별도 실물 PDF는
미시험이다. 긴 합 overflow는 여전히 미해결이다.

- **PASS** `npm run check:static`: 정적/출시 설정·접근성35·문서 계약13·디자인22·조판 역할 대조.
- **PASS** `npm run test:public`: inline CSP5/스타일1·실패 주입12·재현 빌드/비공개 파일 제외.
- **PASS** `npm run check:review-hygiene`: 이슈128(열림4)·INDEX119/120·최근5·자기검사6.
- **PASS** `git diff --check`, `quick_validate.py .claude/skills/hwpx-element`(PyYAML 있는 Anaconda Python 사용).
- **PASS** `npm run check:codex-bridge`, `npm run check:claude-bridge`: 모델 호출 없는 래퍼 자기검사·스킬 연결 확인.

## 다음 검토자에게

기준 `2547a1e`, branch `claude/launch-decisions`의 작업 트리다. 커밋·푸시·배포 없음.
사용자 기존 변경을 보존했으며 transcript.txt는 읽기/수정/추가하지 않았다.
Claude의 읽기 전용 검토는 foreground wrapper, opus/high 요청(실제 모델 metadata 미제공)으로 수행했다.
답변은 재현/검사로 독립 확인했다. 새 제품 구현은 이 구역 진단 한 묶음이며 연구/스킬은190으로 구분한다.

다음 작업은 [수식 폭 계약](../../../docs/HWP-EQUATION-LAYOUT-CONTRACT.md)의 context→측정 정체성→진단을
작게 구현하는 것이다. 상수 변경/자동 축소로 overflow 해결을 주장하지 않는다. 주 레일 U1.5는 유지한다.
로컬 증거/로그: `/private/tmp/hwp-rea-2026-10-15/`의 `h1d-final-*`, `h1d-red-*`, `section-output/`,
`claude-resume-{a,b,c,d,e,f}-*`. 임시 원문 없이도 public research JSON의 해시·질문으로 재개할 수 있다.

## 검토 기록

- `2026-10-15` · Claude B — profile/API·root guard·정확한 lexical·참조 합집합 계약 보완 합의.
- `2026-10-15` · Claude C/D — 리소스 오진125 후보 재현·세 티어/집계 분리 합의, close 잔류124 해소 확인.
- `2026-10-15` · Codex 독립 에이전트 — 세 티어와 resource3 exact oracle/RED를 읽고 과잉 integrity 진단 해소 확인, 추가 확정 반례 없음.
- `2026-10-15` · Claude E — 세 티어·missing dedup·독립 root guard·창 guard 합의. 실제 실행 없이 코드로 판정했다.
  그림 writer의 예약 ID126, 기존 href 누락127/namespace 선언128 후보와 일반 리소스 양성/누락 티어 사례를 제시했다.
  Codex가 126을 양쪽 실제 writer에서, 독립 에이전트가127/128을 현재/2547a1e·실제DOM에서 재현했다.
  수정 후56사례 PASS, 다섯 실패 주입·기준 RED의 양쪽 총12경로도 정확한 이유로 실패했다.
- `2026-10-15` · Claude F — 예약 ID·그림 연결·href 차단·xmlns 제외와 실제 font 검사의 유지에 합의,
  새 제품 결함 없음(코드 읽기만, 실행 없음). 그림 생성 ID/href의 parity 공백을 보완해 정상56사례 PASS·
  유효한 다른 ID 주입 RED를 확인했다. namespace 직렬화에 선언이 남고 실제 JS namespace RED가
  실패함을 기존 실행 로그+독립 XML 확인으로 입증했다. **합의: 세 코드 수정 / 미합의: 없음(보완 조건 실행으로 해소) /
  근거: 실제DOM56·RED13·기존출력·실물 기록 / 다음: 수식 폭 context·측정·진단**.
