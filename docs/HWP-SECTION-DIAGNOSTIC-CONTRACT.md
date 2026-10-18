# H1-c 구역 패키지 진단 적용 계약

상태: **Claude 설계/구현 검토 보완 완료 · H1-d Python/JS 구현·56사례 검증 완료**(2026-10-15).
근거: [H1-section-02](HWP-RESEARCH-RESULTS.md), 두 구역·Mac build 6544의 실물/왕복 관찰.
이 계약은 현재 PEDAGOGY 엔진의 편집·출력 지원 범위를 명시한다.

## 현재 API 경계

`pedagogy_hwpx.py:HwpxDocument.open()`·`hwpx-engine.js:HwpxDocument.open()`은 ZIP XML을 로드한다.
로드 시 strict 검사는 하지 않는다. `_section()`·`section(index)`는 manifest를 resolve하지 않고
`Contents/section{index}.xml`을 직접 접근한다. Python `save()`·JS `toBlob()`가 strict 검사를 강제한다.

따라서 한글에서 유효한 경로 별칭·ID 배정 교환과 현재 편집 API의 지원은 별도로 판정한다.
바이트만 보고 우리 생성물인지 추측하지 않는다. 출력 게이트는 명시적인 `pedagogy-export` 프로필로
검사하며, 일반 파일 조사용 `inspect` 진단에서 같은 조건을 보편 형식 오류로 표현하지 않는다.
프로필은 허용 목록으로 제한하고 알 수 없는 프로필은 인자 오류로 처리한다.
기존 `validation_errors()`/`validationErrors()`의 section0 물리 경로 요구는 canonical 출력 프로필 검사로 유지한다.
일반 파일의 inspect는 그 API가 아니라 새 section 진단 API를 호출한다. alias의 export 미지원 판정을
일반 HWPX 손상이라고 표현하지 않는다.

## 진단 API와 전달

- Python `section_package_diagnostics(profile="inspect")`, JS `sectionPackageDiagnostics({profile="inspect"}={})`.
- 반환: `{code, severity, kind, part, message}` 목록. severity=`error|warning`, kind=`integrity|unsupported`.
  code/판정은 양쪽 동일하고 message는 기존 오류 전달과 호환되는 한국어 설명이다.
  진단은 code→part→severity→kind→message UTF-16 순으로 정렬하며, 호출 순서와 무관하게 입력을 비변조한다.
  strict의 기존 ValueError/Error 타입은 유지하고 메시지에 `[section-count-mismatch]`처럼 안정된 code prefix를 넣는다.
- `strict_validate()`·`strictValidate()`는 `pedagogy-export` 오류를 기존 오류 목록과 합쳐 throw한다.
  같은 원인의 missing-part 메시지는 한 번만 남긴다. 기존 일반 검사·경고를 낮추지 않는다.
- `inspect`는 구역 선언/참조의 모순을 진단하되 별칭·ID 교환은 `unsupported` 경고로 둔다.
  자동 경로 변경·순서 교환·secCnt 수정·본문 삭제는 하지 않는다.
- 이 묶음은 진단 API와 출력 차단만 제공한다. 경고의 사용자 report 전달/UI는 완료로 주장하지 않는다.
  strict 오류는 현재 writer 호출 경로로 전달되어 서버 fallback에도 같은 Python 규칙이 적용된다.

## 수집과 판정

1. header=`{http://www.hancom.co.kr/hwpml/2011/head}head`, HPF=`{http://www.idpf.org/2007/opf/}package`다.
   해당 파트가 없거나 정확한 XML 루트가 아니면 필수 파트 진단 후 해당 파생 검사를 건너뛴다.
   현재 strict 경로의 `KeyError`/part 예외 대신 기존 오류 목록을 반환한다. itemCnt 등 다른 검사도
   필요한 파트가 없을 때 무조건 실행하지 않는다.
2. HPF의 직접 manifest/item을 순회해 ID→href **다중 맵**을 만든다. 중복 ID를 Map으로 덮지 않는다.
   물리 파트의 정확한 `hs:sec` XML 루트를 조사해 구역 catalog를 만들며 파일명 접두사로만 세지 않는다.
   임의 URI·외부 네트워크·경로 traversal을 resolve하지 않는다. 현재 패키지 내 정확한 href만 지원한다. `./`·퍼센트 인코딩·대소문자를 정규화하지 않는다.
   구역 root는 `{http://www.hancom.co.kr/hwpml/2011/section}sec`로 정확히 비교한다.
3. secCnt는 앞뒤 XML 공백·선두의 선택적 `+`를 허용한 십진 양의 정수로 해석한다.
   먼저 `^[ \t\r\n]*\+?[0-9]+[ \t\r\n]*$`를 검사한다. 내부 공백(`1 2`, `+ 2`)·음수·소수·지수·빈 값·정규화 후0은
   `section-count-invalid`. 앞뒤 XML 공백·선두 +·선행 0만 정규화한 십진 문자열로 유한 catalog 개수와 비교한다.
   JS Number 변환으로 큰 선언의 정밀도를 잃지 않는다. 선언 수만큼 반복·파트 생성·메모리 할당을 하지 않는다.
4. 구역 후보는 실제 `hs:sec` 파트, `Contents/section[0-9]+.xml` 자리, 숫자형 section ID 항목으로 수집한다.
   ID 중복은 후보와 ID를 공유하는 모든 manifest 항목에서 센다. target 중복/구역 루트 검사는
   실제 구역과 canonical 자리만 대상으로 한다. ID 이름만 section3인 일반 리소스를 구역 파손으로 단정하지 않는다.
   존재하는 일반 리소스는 `section-target-unsupported`로 분류하며, 없는 href는 기존 참조 무결성 오류를 유지한다.

| 조건 | inspect | pedagogy-export |
| --- | --- | --- |
| secCnt 누락/유효하지 않음 | integrity 오류 | 같은 오류 |
| secCnt와 물리 구역 catalog 개수 불일치 | `section-count-mismatch` 후보 경고, 활성 구역을 단정하지 않음 | `section-count-mismatch` 오류 |
| 중복 section ID / 같은 구역을 중복 배정 | `section-id-duplicate` / `section-target-duplicate` 오류 | 같은 오류 |
| 구역 후보가 없는 파트를 가리킴 | `section-target-missing` integrity 오류 | 같은 오류 |
| canonical 구역 자리에 비구역 XML 루트/바이너리가 있음 | `section-target-invalid` integrity 오류 | 같은 오류 |
| ID 이름만 숫자형 section이고 target은 존재하는 일반 리소스 | `section-target-unsupported` 경고 | 같은 code의 unsupported 오류 |
| 물리 구역이 manifest에서 빠짐 | `section-unreferenced` 후보 경고 | 자체 출력 계약 오류 |
| canonical section0..N-1 ID의 누락/공백 | unsupported 경고 | `section-id-unsupported` 오류 |
| ID→물리 경로가 canonical 배정과 다름(유효 별칭/ID 교환 포함) | unsupported 경고 | `section-mapping-unsupported` 오류 |
| manifest 항목 순서·spine 순서 반전/구역 itemref 제거 | 새 오류 없음 | 새 오류 없음 |
| RDF 참조 차이 | 이번 묶음의 새 강제 규칙 없음 | 새 강제 규칙 없음 |

참조되지 않은 hs:sec 리소스가 활성 본문인지 inspect가 단정하지 않는다. 자체 출력 프로필은
구역 catalog 전체를 활성 본문으로 보존하는 계약이다. 구역 진단과 한글이 받아들이는 파일 범위는 동일하지 않다.
각 code는 현재 출력 계약 또는 모순 진단의 근거를 설명하며 모든 한글 버전의 거부 사유라고 하지 않는다.
catalog의 별칭 구역도 본문 스타일 참조 검사 대상에 포함한다. 기존 접두사 기반 파트 검사와
합집합으로 순회해 과거 검사 범위를 약화하지 않는다. 실제 편집 경로 resolver 확대는 별도 기능이다.
그림 writer의 새 manifest ID는 이미 사용한 ID뿐 아니라 `section[0-9]+`도 예약 이름으로 피해 간다.
그림 이름/바이너리 경로·`binaryItemIDRef` 연결은 보존한다. 외부 입력의 ID를 자동 고치지는 않는다.
일반 manifest item의 href 누락도 양쪽 참조 오류로 차단한다. JS fontRef 순회는 xmlns namespace 선언을
글꼴 ID에서 제외하고 실제 언어별 font ID 검사는 유지한다.

## 수정 파일과 완료 조건

- `experiments/hwp-export/pedagogy_hwpx.py`: catalog/진단, missing-part guard, 참조 검사의 구역 순회, strict 결합.
- `hwpx-engine.js`: 같은 catalog·code·profile·guard·순회·출력 거절.
- 기존 HWPX Python/브라우저 검사와 parity fixture: 정상1/2/3구역, 축소/확대/0/비정수/큰 선언,
  `+0002`/앞뒤 XML 공백의2 정상, `1 2`/`+ 2`/`0000` 오류,
  ID 누락/중복/공백, target 누락/중복/다른 루트, manifest 누락, 유효 별칭/ID 교환,
  manifest/spine 순서 반전·spine 참조 제거, 필수 header/HPF 누락을 포함한다.
- 기준 RED: 기존 strict를 통과하는 secCnt=1 두 구역 파일을 새 gate가 정확한
  `section-count-mismatch`로 거절한다. 별칭/ID 교환은 inspect 경고와 export 미지원 오류를 각각 확인한다.
- `test:hwpx`, `test:hwpx-browser`, `check:static`, 영향 시 `test:hwpx-exam`/회귀 HTML,
  입력 기준 내용 대조·실물 한글 PDF·독립 검토. 브라우저가 막히면 검사 작성/연결 후 미실행 이유를 기록한다.
- 구조 검사 정상3구역 통과를 실물 여러 구역/Windows 지원 완료로 표시하지 않는다.
  기존 단일/시험지 템플릿의 출력이 유지되는지 확인하고 제품 반영 증거를 H1-d/R5에 합친다.

## 다음 행동

2026-10-15 계정 초기화 후 Claude 설계 검토의 보완점을 반영해 H1-d 구역 진단을 구현했다.
검증·독립 검토·미결은 [HANDOFF-191](../reviews/handoffs/2026-10/2026-10-15-mock-hwpx-section-diagnostics.md),
실물1/2/3구역 출력/PDF 기록은 `research/h1-section-output.json`에 있다.
기존 itemCnt의 일반 lexical 처리, alias 편집 resolver, 수식 폭 진단 구현은 이번 범위 밖이다.
