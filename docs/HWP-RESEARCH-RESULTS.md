# H1 한글 실험 결과

## H1-package-01 — 2026-10-14

[분석 설계](HWP-RESEARCH-DESIGN.md)의 REA 정적 가설을 실제 앱에서 대조한 첫 실험이다.
Mac 한글 12.30.0/build 6446, macOS 26.7 ARM64, Python 3.12.14/lxml 6.1.1에서 실행했다.
입력은 저장소 blank 템플릿에 직접 작성한 한 문단을 넣은 단일 구역 문서다.
각 파일 해시·변경 파트·도구 해시·환경·관찰 시점은
[실험 manifest](../experiments/hwp-export/research/h1-package-01.json)에 보존한다.

| 표본 | 한 가지 변경 | 실제 열기 |
| --- | --- | --- |
| control | 정상 대조군 | pass |
| metadata-removed | opf:metadata 제거 | pass |
| section-path-renamed | section0.xml 경로와 manifest href 변경, ID 유지 | pass |
| section-id-renamed | manifest ID와 spine idref 함께 변경, 경로 유지 | fail — 손상 안내 |
| section-spine-removed | section0의 spine itemref 제거 | pass |
| section-missing | section0.xml 제거, 참조 유지 | fail — 거부 |
| package-missing | content.hpf 제거 | fail — 거부 |
| control-after | 첫 대조군과 바이트 동일 | pass |

### 최초 실행에서 알았던 범위

- 이 표본에서는 구역의 경로 변경과 ID 변경의 결과가 달랐다. REA의 `section%d` 조회 후보와
  일치하는 관찰이지만 모든 파일에 고정 ID가 필수라는 결론은 아니다.
- 메타데이터와 spine 참조 제거도 창은 열렸다. 본문이 보존되거나 올바르게 렌더링됐는지는 아직 확인하지 않았다.
- 최초 실행의 `pass`는 대응 문서 창을 두 번 관찰했다는 뜻이다. 그 시점에는 저장·재열기·PDF·내용 대조·폰트·쪽 배치·Windows가 미확인이었다. 후속 판정은 아래 별도 기록이다.
- 앞뒤 정상 대조군이 통과했고 거부된 파일도 처리한 뒤 계속 진행했다. CLI 종료 코드 1은 거부 표본을 포함하므로 예상된 결과다.
- 과거 실패했던 원본 skeleton을 복구한 실험이 아니다. 이번에 새로 만든 변형 표본이다.
- 첫 실행의 AppleScript 변수명 충돌과 두 번째 실행의 미분류 손상 안내는 수정했다.
  결과표는 수정 후 8건을 모두 실행한 세 번째 실행만 사용한다.

### 재현·보존·본문 확인 — 2026-10-14 Claude

같은 생성기로 **새로 만든** 표본(`/private/tmp/h1-package-20261014-b/`)에서 다시 돌렸다.
- **열기 결과가 8건 모두 같다**(pass 5 · 거부 3). 첫 실행과 다른 파일 바이트로도 재현됐다.
- **기존 문서 보존**: 비어 있지 않은 내 문서(`h1-keeper-userdoc.hwpx`, 표식 문장 한 줄)를 먼저 열어 둔 채
  8건을 돌렸다 — 끝난 뒤에도 그 창이 그대로 있었다. (사람이 실제로 쓰던 문서가 아니라 직접 만든 대역이다.)
- **거부 대화상자의 단추는 셋 다 `확인` 하나뿐이다** — 하네스가 누르는 '첫 단추' 가 복구 같은 다른 동작이 아님을 확인했다.
  보고서에 `dialogButtons` 로 남긴다.
- **열린 변형은 본문도 찍힌다**: control·metadata-removed·section-path-renamed·section-spine-removed 를 한글로 PDF 로 뽑으니
  넷 다 1쪽에 표식 문장 23자가 그대로 있었다(텍스트 추출 + 쪽 그림 눈 확인). **spine 참조가 없어도 본문을 찾아 그린다** —
  한글이 구역을 spine 이 아니라 manifest 의 `section0` 같은 **ID 로** 찾는다는 REA 가설과 맞는다(단일 구역 · 한 버전).
- 재저장·재열기는 아직 안 했다.

⚠️ **하네스 결함 하나를 찾아 고쳤다.** macOS 접근성은 한글이 **앞에 있지 않으면 창을 0개로** 보고한다 —
열린 문서가 그대로 있는데 목록만 비었다. 그러면 '이미 열린 같은 이름 문서' 를 못 보고 다시 열어, 한글이 다시 읽지 않은
**옛 내용으로 판정**한 뒤 그 문서를 **닫는다**. 지금은 매 스냅샷 전에 한글을 앞으로 가져오고, 그래도 앞이 아니면 멈춘다(unknown).

### 하네스 범위와 한계

`check-hwpx-opens.mjs`는 기존 전체 창 닫기를 제거하고, 열기 전에 없던 정확한 시험 파일 이름만
닫는다. 같은 이름이 이미 열려 있으면 skip, 권한 오류·예상 밖 대화상자·시간 초과는 unknown으로
중단한다. 인식한 오류 대화상자만 해제하며 기존 보고서와 표본 디렉터리를 덮어쓰지 않는다.
초기 가짜 UI 검사는 통과했지만 빈 문서 창의 상태는 미확정이었다. 이후 Claude가 비어 있지 않은
대역 문서 보존을 확인했다. 실제 사용자 작업이 없는 세션에서 실행한다.
동시 사용자 조작이나 이름이 같은 다른 경로의 새 문서까지 구분하는 AX 문서 URL 추적은 구현하지 않았다.

## H1-section-02 — 2026-10-15 · Codex 주도·독립 에이전트 검토

현재 설치 한글은 같은 12.30.0이지만 build **6544**다. 6446 주소를 재사용하지 않고 새 ARM64
사본에서 검색했다. [네이티브 관찰 기록](../experiments/hwp-export/research/h1-native-6544.json)에
원본/사본 해시·공급자/profile·Evidence ID·한계가 있다. 상세 코드/의사코드는 저장소 밖에 보존한다.

### 정적 관찰과 실물 연결

| 함수 주소(build 6544) | 관찰한 역할 | 제한 |
| --- | --- | --- |
| `0x777080` | 헤더 `secCnt` 속성을 읽는 처리 | XML 파서 내부 모든 호출은 미추적 |
| `0x695654` | 헤더 파싱 후 개수 필드를 구역 리더 문맥에 복사 | stack/object offset 연결은 정적 추론 |
| `0x695ad4` | 양수 개수로 `section%d` 키를 반복 조회 | 전체 파일 형식의 보편 규칙은 아님 |
| `0x7a91a4` | 문자열 키가 일치하는 짝의 값을 반환 | 테이블 생성의 모든 조건은 미추적 |
| `0x6949d0` | 구역 읽기 반환에 따라 파일 오류 분기 | 직접 실행을 추적한 증거는 아님 |

질문은 “두 구역의 읽기 개수·순서가 header/manifest/spine/ID 중 어디에서 결정되는가?”였다.
저장소 blank에서 직접 작성한 A/B 표식을 가진 두 구역 대조군을 만들고 실제 한글 열기·두 쪽
본문 출력으로 유효성을 확인했다. 앞뒤 정상 대조군 입력은 바이트 동일이다.
변형마다 한 XML 질문만 바꾸고 나머지 파트·표식은 동일성을 검사했다.

| 변형 | 열기 | PDF 본문·쪽 |
| --- | --- | --- |
| control / control-after | pass | A→B · 2쪽 |
| manifest 구역 항목 순서 반전 | pass | A→B · 2쪽 |
| spine 구역 순서 반전 | pass | A→B · 2쪽 |
| spine의 구역 참조 제거 | pass | A→B · 2쪽 |
| header `secCnt=1` | pass | **A만 · 1쪽, B 누락** |
| header `secCnt=0` / `3` | fail | 거부되어 PDF 미실행 |
| section1 ID 이름 변경 / section2로 번호 공백 | fail | 거부되어 PDF 미실행 |
| manifest의 section0/section1 ID 배정 교환 | pass | **B→A · 2쪽** |

[관찰 manifest](../experiments/hwp-export/research/h1-section-02.json)에 입력/생성기/엔진 해시,
각 열기 상태·PDF 해시·쪽 수·표식 순서·쪽별 PNG 해시가 있다. 열린 7건의 **전체 13쪽**을
렌더링했고, 정상 두 쪽과 개수 축소 한 쪽을 직접 눈으로 확인했다. 나머지는 대응 대조군 쪽과
픽셀 해시가 동일했다(ID 교환은 쪽 해시 역순). 폰트 파일 버전은 미측정이므로 이 동일성은
같은 실행 환경 안의 대조이며 다른 OS/폰트에서의 허용 오차 기준이 아니다.

### 왕복 저장

control과 `secCnt=1`을 한글에서 각각 **새 파일에 다른 이름 저장 → 시험 창 닫기 → 저장본 재열기 → PDF**로 확인했다.
control은 두 구역 A→B와 2쪽을 보존했다. `secCnt=1` 저장본에는 section0만 남고 B의 XML 파트도
없어졌다. 저장본 PDF도 A 한 쪽이다. 전후 본문·쪽별 이미지 해시가 일치한다.
파일이 열리는 것만 성공으로 보는 기준은 이 누락을 잡지 못한다.

이 표본과 빌드에서는 **헤더 개수가 조회 범위, section ID가 본문 순서**를 정한다는 해석을
정적·실물 근거가 함께 지지한다. 세 구역·다른 빌드/Windows·일반 입력 전체는 미검증이다.
프로그램 전체의 파싱 규칙으로 승격하지 않는다.

### RDF 참조 대조와 하네스 검토

첫 path-renamed 표본에는 `META-INF/container.rdf`의 section0 참조가 남아 있었다.
그 과거 표본을 유지하고 **HPF href·ZIP 경로·RDF about/resource 모두 갱신한 linked 표본**을
추가했다. 현재 빌드에서 앞뒤 정상 대조군과 두 경로 변형 4건이 모두 열렸다.
[대조 manifest](../experiments/hwp-export/research/h1-package-01-linked.json)는 이 4건만 관찰했고
나머지 생성 표본은 unknown으로 둔다. 과거 표본을 모든 참조가 정합한 파일이라고 설명하지 않는다.

Claude 1차가 제기한 최소화 창 누락은 이 빌드에서 재현되지 않았다. 자체 문서의 AXMinimized=true여도
이름이 목록에 남았고 CLI는 pre-existing-dialog/unknown으로 중단했다. **최소화 상태의 skip/close
경로를 검증한 것은 아니다.** AXDocument는 missing value여서 제목·경로 식별의 한계가 남는다.

Codex 독립 에이전트가 거부 해제 후 같은 시험 이름 창 둘에서 계속 진행하는 결함을 재현했고 수정했다
(`REV-118`). 거부 근거는 `rejectionObserved`로 남긴다. 기존 창의 제목만 바뀌는 병합 모의 조건도
창 수 증가가 없으면 unknown으로 중단하도록 보강했다. 실제 한글의 탭 병합 조건을 재현했다는 주장은 아니다.
확인 스냅샷에서 뒤늦게 창 수가 줄어드는 모의 경로도 독립 검토로 발견해 수정했다(`REV-119`).
회귀 17종, 표본 9종·구역 11종 검사와 실패 주입, 과거 정책 7종 RED를 확인했다.
Claude 최종 후보를 모의 재현해 오류 해제/닫기 뒤 기존 창 수 감소도 unknown·중단하도록 보강했다(`REV-120`).
실물 거부 뒤 새 무제목 창이 남을 때는 cleanup-incomplete/unknown으로 중단하며 거부 근거를 보존한다.
창 수만으로 파일 유효성을 판단하지 않고, 파일 거부와 이후 정리의 불확실성을 각각 기록한다.

### 조판 스킬과 적용 계약

`hwpx-element`에 빌드/해시 재개, 근거 종류, 최소 변형·모든 파트 참조 조사, 의미 보존·왕복·PDF,
협업 범위와 중단 회수 절차를 반영했다. 독립 Codex 에이전트의 실제 스킬 사용 평가에서
“열린 secCnt=1을 무시해도 됨”과 “옛 빌드 주소 재사용”을 채택하지 않고 필요한 추가 판정을 선택했다.

H1-c의 [구역 진단 적용 계약](HWP-SECTION-DIAGNOSTIC-CONTRACT.md)은 **우리 생성 패키지의 구역 선언·manifest ID/href·본문 파트 진단**을 다룬다.
계정 초기화 후 Claude 설계/구현 검토를 진행해 Python/JS에 반영했다. inspect와 canonical export를
구별하며 실제 내용 누락 반례·정상1/2/3구역·유효 별칭·일반 리소스를 검사한다.
제품 적용/검증은 아래 H1-d와 `HANDOFF-191`에 있다. 연구 증거를 한글 전체 형식 규칙으로 확대하지 않는다.

긴 수식·분수·행렬의 크기와 기준선/행 간격은 아래 H1-equation-03에서 실물 비교했다.
남은 내부 재계산 경로와 긴 수식 폭 진단만 다음 질문으로 연결한다.

### 재현과 다음 실험

1. `HWPX_PYTHON=<lxml 설치 Python> HWPX_REQUIRE=1 npm run test:hwp-research`로 정책·표본·red를 검사한다.
2. 그 Python으로 `scripts/build-hwp-research-fixtures.py --output <새 디렉터리>`를 실행한다.
3. Mac 한글과 자동화/손쉬운 사용 권한을 준비한다. 사용자 작업이 없는 세션에서
   `node scripts/check-hwpx-opens.mjs --report <새 결과.json> <manifest 순서의 9개 파일>`을 실행한다.
   순서는 manifest의 cases 배열 그대로이며 마지막 정상 대조군을 생략하지 않는다.
4. 완료한 하네스/실물 증거는 재사용한다. 추가 수정이 있으면 보존·중단·오류 분류를 검토하고,
   그 영향 경로만 자체 문서 대역·본문·저장·재열기·PDF로 다시 확인한다.
5. 두 구역의 완료 증거는 아래 적용 계약에 재사용한다. 세 구역/다른 버전으로 확대할 때는
   새 앞뒤 정상 대조군과 실패 표본을 함께 두고, 실물 증거 없는 지원 완료를 주장하지 않는다.

원본 표본과 실행 보고서는 로컬 `/private/tmp/h1-package-20261014-a/`에 있다.
임시 파일이 사라져도 생성기로 다시 만들 수 있으나 ZIP 시각 등으로 전체 파일 해시가 달라질 수 있다.
소스 commit만으로 미커밋 생성기 버전을 특정할 수 없으므로 manifest의 소스별 해시도 함께 확인한다.


## H1-equation-03 — 2026-10-15 · 수식 크기/기준선/행 간격

[한컴 개발자 포럼 답변](https://forum.developer.hancom.com/t/hp-sz-width/1783/2)(2024-09-04)은
폭·높이·기준선을 0으로 두는 재계산 방법을 제안했다. 현재 Mac에도 같은 조건이 필요한지 실험했다.
입력은 직접 쓴 분수 `(x²+1)/(x²−1)`, 2×2 a/b/c/d 행렬, a₁부터 a₂₀까지 합이다.
각 수식 앞뒤 본문과 다음 문단 표식으로 자리와 간격을 비교했다. 제품 기본값은 바꾸지 않았다.

| 변형 | 열기/PDF 생성 | 지면 비교 |
| --- | --- | --- |
| control / control-after | 각각 pass · 1쪽 | 앞뒤 대조군 래스터 동일 |
| baseLine만 0 | pass · 1쪽 | control과 동일 |
| width/height만 0 | pass · 1쪽 | control과 동일 |
| width/height/baseLine 모두 0 | pass · 1쪽 | control과 동일 |
| width/height 두 배 | pass · 1쪽 | control과 동일 |
| affectLSpacing=1 | pass · 1쪽 | 세로 간격 증가, 다음 문단 위치 변화 |

PDF 7건/7쪽을 전부 렌더했다. control과 spacing 변형은 직접 눈으로 분수의 분자/분모,
행렬 4칸, 합 20항과 본문 위치를 확인했다. 나머지 5쪽은 control과 픽셀 해시 동일하다.
다만 **긴 수식은 모두 본문 폭을 넘어 오른쪽 여백에 들어간다.** 쪽 끝의 잘림은 보이지 않았다.
한 단 본문 폭은 `59528−8504−8504=42520` HWPUNIT이고, 아래 저장본의 긴 수식 폭은
44906이다(초과2386). 따라서 생성 성공과 지면 품질 합격을 나눈다. manifest의 pdf=fail은 이 폭 초과이며
PDF 생성/열기 실패가 아니다. 긴 인라인 수식의 별행 전환·분할·축소 정책은 아직 구현하지 않았다.

control/all-zero/spacing-on을 새 HWPX 사본에 저장→시험 창 닫기→디스크 재열기(3건 pass)→PDF로 확인했다.
세 저장본의 수식 script는 원래 입력과 같고, 각각 전후 PDF의 쪽별 래스터 해시도 같다.
저장 XML의 `(baseLine,width,height)`는 분수 `(64,3249,2956)`, 행렬 `(66,2020,2415)`,
긴 합 `(71,44906,1350)`으로 세 사본 모두 동일하게 바뀌었다. spacing 속성은 각각 0/0/1을 보존했다.
**이 빌드·표본에서는 고정 geometry와 zero geometry가 같은 재계산 결과를 남겼다.**
공개 답변의 조건이 불필요하다는 보편 결론이나 내부 조건 분기 설명은 아직 하지 않는다.

[수식 manifest](../experiments/hwp-export/research/h1-equation-03.json)에 입력·생성기/엔진/변환기/템플릿 해시,
열기·PDF·래스터·본문 간격·저장 geometry·재열기와 미검증을 보존한다. 폰트 버전은 미측정이다.
표본 검사 7종과 geometry/script/order RED는 연구 게이트에 연결했다. Codex 독립 검토가
변환기와 manifest가 함께 틀리는 경우·AFTER run 순서 오류를 재현했고, 독립 기대 script와 문단/run
순서 oracle로 수정했다(`REV-121`). 같은 두 모의 주입이 이제 정확한 이유로 실패함을 재검토했다.

다음 질문은 Mac의 실제 수식 재계산 경로와 긴 수식의 사용 가능 폭 판정이다. 저장된 geometry는
관찰 근거이며 모든 수식에 맞는 수치 추정식으로 복제하지 않는다. 다른 baseUnit/폰트/복잡한 수식,
별행·다단·Windows·다른 빌드는 미검증이다. 최초 후속 Claude 요청은 계정 session limit로 실패했다.
사용량 초기화 뒤 재검토를 완료해 수식 oracle/스킬과 두 적용 계약을 보완했다(`HANDOFF-190`·`191`).


### 수식 재계산 후보 경로 — REA 후속

같은 build6544 ARM64 사본·Ghidra profile에서 baseLine/baseUnit 문자열의 참조를 따라갔다.
[새 네이티브 기록](../experiments/hwp-export/research/h1-native-equation-6544.json)에 함수/Evidence ID,
범위·제외한 번호 매김 함수·정적/추론/unknown을 보존했다. 원시 의사코드는 저장소 밖이다.

- `0x78bbdc`/`0x78bcb8`: baseLine/baseUnit 속성을 객체 필드와 연결하는 쓰기/읽기 후보.
- `0x69b0e4`→`0x69cb70`: equation 제어 분기. 공통 shape 처리와 가상 호출이 둘 다 성공하면
  `0x2b8bcc`(script 준비 후보)와 `0x2b973c`(측정/갱신 후보)를 호출한다.
- `0x2b973c`→`0x2b9a90`: 버전 분기에 따른 측정 후보. drawing context가 없으면 생략하고,
  다른 버전은 대체 함수를 쓴다. width 기록은 객체 flag 조건이 있어 항상 갱신한다고 할 수 없다.
  측정 모드의 인터페이스 반환을 폭/높이/기준선 후보에 연결하는 형태를 관찰했다.
- uppercase EQUATION/SCRIPT를 읽는 별도 `0x575b58`도 같은 준비/측정 후보를 호출했다.

선택한 함수들에서는 **baseLine이0일 때만 측정한다는 조건을 찾지 못했다.** 이는 제한된 정적
검색 결과이며 프로그램 전체에 그런 조건이 없다는 증명이 아니다. XML 속성 reader와 consumer의
가상 호출 바인딩, 측정 인터페이스 실구현의 귀속(HncEqEdit 포함), 실제 시험 파일의 실행 경로는
미확인이다. PDF/왕복은 별도 실물 근거이며 이 주소가 실행됐다는 trace로 합치지 않는다.
Codex 독립 에이전트가 핵심8개 함수 발췌를 대조해 해석 범위와 갱신 조건을 확인했다.

이로써 기본값 상수 교체 대신 **seed와 실측의 분리·활성 단/문단 폭 상한·postflight 진단**으로
연결하는 [수식 폭 계약 초안](HWP-EQUATION-LAYOUT-CONTRACT.md)을 만들었다.
원본 시험지 두 구역의 단 폭은31508/31550으로 서로 달랐다. 폭 상한 이하를 인라인 fit 합격으로
표시하지 않고, 측정/컨텍스트가 불명일 때는 unknown으로 둔다. 초안은 Codex API 대조를 마쳤고,
Claude 후속 설계 검토는 완료했다. 제품 폭 resolver·측정 연결·진단 구현은 미완료다.

새 Evidence bundle은35records/6510956bytes, snapshot12942317bytes다. close가 sysctl 정리 확인
오류를 보고했지만 이후 open=false·정확한 PID25426 조회에서 프로세스 없음 확인했다.
이 정리 경고와 분석/모델 실패는 구분한다. snapshot은 같은 target/profile의 재개 근거이며 새 쿼리의
live Ghidra 분석을 항상 생략하는 캐시가 아니다.

## H1-d-section-output — 2026-10-15 · 구역 진단의 제품 적용

`pedagogy_hwpx.py`·`hwpx-engine.js`에 같은 code/profile의 읽기 전용 진단을 넣고
`save()`/`toBlob()`가 canonical 출력 오류를 차단하도록 했다. secCnt는 ASCII 십진 문자열로
비교해 5000자리 선언도 정밀도 손실이나 선언 수만큼의 반복 없이 검사한다.
필수 header/HPF의 정확한 루트와 namespace를 독립 검사하고, 기존 참조 검사의 대상에
별칭 구역을 합집합으로 추가했다. 입력 수정·본문 정리·secCnt 자동 보정은 하지 않는다.

- 실제 `hs:sec`·canonical 구역 자리·ID 이름만 일치하는 리소스를 구별한다.
  ID 중복은 관련 ID 전체에서 세되, 일반 리소스 alias를 구역 target 중복/파손으로 오진하지 않는다.
- 일반 파일의 inspect에서는 유효 별칭/ID 배정 교환 등이 unsupported 경고다.
  현재 편집 API의 canonical export에서는 미지원 오류다. 일반 파일 손상과 우리 지원 범위를 구별한다.
- 정상1/2/3구역과 lexical/루트/ID/target/별칭/독립 guard/리소스56사례를 Python과 실제 Chromium DOM에서
  대조했다. save/toBlob 차단, 정상 재열기·내용 보존, 호출 순서·입력 비변조도 검사했다.
- 기준 `2547a1e`의 Python/JS는 secCnt 축소를 허용해 `SECTION_COUNT_LOSS_UNBLOCKED`로 RED다.
  누락 오류 중복/리소스 오진 주입은 각각 `SECTION_DUPLICATE_MISSING_MESSAGE`/
  `UNEXPECTED_SECTION_DIAGNOSTIC`로 RED다. 기존 출력·시험지·회귀167도 통과했다.

Mac Hancom12.30.0 build6544에서 새 정상 출력3파일을 열고 PDF로 내보냈다. 각각1/2/3쪽이며
전체6쪽을 렌더하고 세 고유 페이지를 눈으로 확인했다(나머지 대응 쪽은 같은 픽셀 해시).
각 구역의 원래 표식이 PDF에 순서대로 정확히 한 번씩 있다. 마지막 진단 수정 뒤 재생성한3파일도
실물 시험 파일과 바이트가 동일하다. [공개 관찰/해시](../experiments/hwp-export/research/h1-section-output.json)에
시험 당시/최종 엔진 해시를 구별해 남겼다. 실제 한글 재저장/재열기는 앞선 두 구역 실험의 범위이며,
이번 새3구역 출력의 한글 재저장까지 시험했다고 주장하지 않는다.

Claude가 검토한 과잉 리소스 진단과 창 정리 잔류를 재현·수정했고, Codex 독립 에이전트도 세 티어를
대조했다. 연구 하네스는 이제20종이며 같은 수의 창 교체/close 후 잔류를 unknown으로 중단한다.
기존 itemCnt 일반 lexical 처리·alias 편집 resolver·수식 폭 resolver와 Windows/다른 빌드는 남았다.
긴 합의 폭 초과는 이 구역 패키지 gate로 해결되지 않는다.

최종 Claude 검토가 그림 이름 section1.png의 ID 충돌126과 기존 href 누락/namespace 글꼴 판정 차이127/128을
지적했고, 두 런타임·기준 코드에서 재현했다. writer가 미래 구역 ID도 예약하도록 수정하고,
일반 리소스 양성/숫자ID의 누락 리소스·그림 writer·href 누락·namespace 정상/없는 font ID를 추가했다.
현재56사례는 전체 참조 오류 메시지까지 대조하고 그림 연결·바이너리 왕복도 보존한다.
세 추가 RED는 `PICTURE_RESERVED_ID`/`MANIFEST_HREF_MISSING_UNCHECKED`/
`NAMESPACE_DECLARATION_AS_FONT`로 양쪽 모두 실패한다. 이는 일반 참조 검사 두 경계의 좁은 보완이며
itemCnt 어휘/임의 namespaced 언어 속성 등 기존 검사를 전면 재설계한 것은 아니다.
Claude F는 세 수정에 합의했다. 생성한 그림 ID/href 자체의 parity도 보완했고, 예약 규칙을 지키지만
다른 ID를 반환하는 JS 주입은 `SECTION_PACKAGE_PARITY`로 실패했다. namespace 선언이 직렬화에 남는지와
실제 JS namespace RED의 실패도 확인해 검토 보완을 닫았다. 새 진단/참조 검사 RED는 총13경로다.
