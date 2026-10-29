# H1-c 수식 폭·배치 진단 적용 계약

상태: **Claude 설계 검토·보완 반영 · 제품 미반영**(2026-10-15).
근거는 [H1-equation-03](HWP-RESEARCH-RESULTS.md)의 자체 표본·Mac build 6544·저장 XML/PDF다.
현재 기본 geometry를 실제 측정값으로 간주하지 않는다. native 측정 후보 경로와 미해결 간접 호출은 [분석 기록](HWP-RESEARCH-RESULTS.md#수식-재계산-후보-경로--rea-후속)에 있다.

## 현재 한계와 지원 범위

Python `_append_equation()`과 JS `appendEquation()`은 기본 `baseLine=93`, `baseUnit=1100`,
`sz=4800×2300`을 쓴다. 일반 문서 인라인은 baseUnit1050, 별행은 baseUnit1100/11000×2800이며,
시험지는 템플릿의 `_eq_base`와 엔진 기본 geometry를 사용한다. 이 값은 생성 시 seed다.
실물에서 0/고정/두 배 geometry가 같은 PDF와 저장 geometry를 남겼다.

수식이 들어갈 실제 줄의 남은 폭은 현재 writer가 알지 못한다. 한글의 글꼴 실측·줄바꿈·커서 x가
없으므로 KaTeX 폭이나 `_math_mm()` 추정값을 한글의 확정 geometry로 승격하지 않는다.
첫 적용은 **사용 가능한 줄 폭 상한**과 **측정 출처가 있는 수식 폭의 비교**에 한정한다.

## 사용 가능한 폭 API

Python/JS에서 같은 입력과 결과를 갖는 폭 resolver를 설계한다.

`{status: known|unknown, widthHwpunit, scope, section, paragraph, basis, reason}`

- section의 활성 page/column 설정, paragraph의 실제 style 참조, container를 따라간다.
  첫 `.//pagePr` 또는 고정 폭으로 대체하지 않는다. 설정 변경 위치를 resolve하지 못하면 unknown이다.
- 첫 구현은 gutter=0, 동일 폭 단, 직접 본문/지원 문단 테두리 상자에 한정한다.
  비균등 단·제본 폭·표 셀·임의 도형·상속 불명은 unknown으로 반환한다.
- 모든 단위와 숫자를 검증하고 잘못된 값/미지원 단위를 0으로 바꾸지 않는다.
  문단의 좌우 여백·들여쓰기/내어쓰기·첫 줄/후속 줄·탭 시작 위치를 따로 해석한다.
  현재 지원 수치 계산은 정확한 비음수 HWPUNIT 정수와 나머지 없는 동일 단 폭 나눗셈만 허용한다.
  소수·비정수 나눗셈·정수 계산 범위를 넘는 값은 반올림하지 않고 unknown으로 둔다.
  범위를 넓히려면 양쪽 같은 정책과 실물 근거를 먼저 추가한다.
- 전체 줄 상한은 해당 수식이 배치될 수 있는 첫 줄/후속 줄 중 허용 가능한 최대 폭이다.
  줄 이동 가능성·적용 줄이 미확정이면 특정 줄/탭 뒤의 좁은 폭만으로 overflow를 확정하지 않는다.
- 일반 문서의 box는 문단 테두리와 여백이다. 이를 임의 rect/표 셀 컨테이너로 간주하지 않는다.
  조건 상자와 별행의 문단 역할을 보존하며 주변 본문을 자동 재배치하지 않는다.

원본 템플릿 XML로 확인한 경계:

| 문서/구역 | 계산 | 단 폭(HWPUNIT) |
| --- | --- | --- |
| blank 본문 | 59528−8504−8504 | 42520 |
| exam-math 구역0 | (77102−5385−5385−3316)/2 | 31508 |
| exam-math 구역1 | (77102−5244−5244−3514)/2 | 31550 |

수치는 해당 템플릿의 관찰이며 공통 상수가 아니다. 기존 COL_W_MM=111.15는 구역0의 근사값으로,
새 resolver의 모든 구역·문단 폭을 대신하지 않는다. 템플릿 해시와 실제 설정으로 다시 계산한다.

## 수식 geometry 출처와 판정 API

측정은 `{widthHwpunit, heightHwpunit, baseLine, source, inputIdentity, evidence}`로 전달한다.
source는 `declared-seed|hancom-resaved|estimate`를 구분한다. hancom-resaved는 해당 입력/저장 파일
해시·script·baseUnit·font·한글 빌드와 연결한다. 다른 식/폰트/빌드에 값만 복사해 캐시로 쓰지 않는다.
신뢰 경계를 넘어온 문서의 자기 선언만으로 실측 출처를 인증했다고 표현하지 않는다.

| 조건 | 판정 | 의미 |
| --- | --- | --- |
| 검증된 실측 폭 > 알려진 전체 줄 상한 | `equation-width-overflow` | 앞 텍스트 폭과 무관하게 한 줄의 최대 폭보다 큼 |
| 검증된 실측 폭 ≤ 알려진 전체 줄 상한 | `within-upper-bound` | 인라인 남은 폭·줄바꿈·세로 배치 합격은 아님 |
| seed/추정뿐이거나 컨텍스트/측정 정체성 불명 | `unknown` | 합격/오류를 추정하지 않음 |

H1의 44906>42520은 overflow다. 각 seed 변형의 입력 identity에 대응하는 재저장 실측을
별도로 확보한 경우 같은 폭 초과를 확인한다. 새 입력 identity가 미검증이면 이전 실측을 자동 전용하지
않고 unknown으로 남긴다. 이번 PDF 동일성 비교와 저장 사본3개의 실측 범위도 구별한다.
판정은 HWPX 형식 유효성과 구분하며, 형식 오류로 파일을 거절하거나 수식을 삭제하지 않는다.
수식 폭 판정은 strict_validate/strictValidate/save/toBlob의 형식 오류 게이트에 합류하지 않는다.
높이·세로 fit은 이번 판정 범위 밖이며 unknown이다.
`affectLSpacing=1`은 세로 배치를 바꿨으므로 폭 문제의 해결 옵션으로 자동 적용하지 않는다.

## 연결과 완료 기준

- 진단 API는 구역/문단/원본 블록 경로, 실측 폭, 줄 상한, 초과량, 단위·측정 근거를 반환한다.
  실제 측정이 있는 검증 경로는 보고서 warnings에 같은 code로 연결한다.
  생성 단계의 미측정 식마다 경고를 쏟지 않고, 미확인 상태는 API/검증 보고에서 구분한다.
- 브라우저가 한글 native 실측을 수행하거나 다른 기기에서 복원한다고 약속하지 않는다.
  실물 후검사는 연구/검증 경로다. 서비스 호출·외부 한글 API·배포를 이 계약에 추가하지 않는다.
- Python/JS 위치: `pedagogy_hwpx.py`/`hwpx-engine.js`의 context helper와 진단,
  `document_to_hwpx.py`/`hwpx-document.js`, `mock_to_hwpx.py`/`hwpx-exam.js`의 report 경계.
  실제 변경은 context·측정·진단 세 단계를 나눠 작은 묶음으로 독립 검토한다.
- 정상/반례: 1단/시험지 두 구역, 좌우 여백·상자·탭/내어쓰기·미지원 단/단위,
  동일 식의 seed변경, 측정 없음, script/baseUnit/font/build 불일치, 폭 경계±1, 저장 전후 의미 보존.
- RED: 구역1에 구역0 폭을 쓰기, 좁은 단/상자에 전체 쪽 폭 쓰기, seed를 실측으로 바꾸기,
  미측정/새 identity unknown을 fit로 표시하기, 정체성이 맞는 실측을 seed로 덮어 overflow를 지우기를 각각 잡는다.
- Python/JS parity·입력 의미·수식 주변 본문 순서·실물 PDF 전체 쪽을 확인한다.
  자동 별행 전환/분할/축소는 별도 UX·의미 보존 계약 전까지 넣지 않는다.

Claude 설계 검토의 상한/정체성/strict 분리 보완은 반영했다. 다음은 native 재계산 경로의
관찰/추론/unknown을 보존하며 context→측정 정체성→진단을 작은 구현 묶음으로 진행하는 것이다.
현재 수식3개/단일 폰트·Mac의 성공/실패를 일반 수식 측정기 완성으로 표시하지 않는다.
