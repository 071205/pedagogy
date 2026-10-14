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

### 무엇을 알았고 아직 모르는가

- 이 표본에서는 구역의 경로 변경과 ID 변경의 결과가 달랐다. REA의 `section%d` 조회 후보와
  일치하는 관찰이지만 모든 파일에 고정 ID가 필수라는 결론은 아니다.
- 메타데이터와 spine 참조 제거도 창은 열렸다. 본문이 보존되거나 올바르게 렌더링됐는지는 아직 확인하지 않았다.
- `pass`는 대응 문서 창을 두 번 관찰했다는 뜻이다. 저장·재열기·PDF·내용 대조·폰트·쪽 배치·Windows는 모두 미확인이다.
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
가짜 UI의 기존 문서 보존 검사는 통과했지만, 실제 세션 시작의 빈 문서 창은 종료 시 남아 있지 않았다.
앱 자체의 빈 창 대체 여부는 확인하지 않았고 실제 사용자 문서 보존을 검증했다고 주장하지 않는다.
따라서 독립 검토와 별도의 직접 만든 비어 있지 않은 문서 보존 시험 전에는 사용자 작업이 없는 세션에서 실행한다.
동시 사용자 조작이나 이름이 같은 다른 경로의 새 문서까지 구분하는 AX 문서 URL 추적은 구현하지 않았다.

### 재현과 다음 실험

1. `HWPX_PYTHON=<lxml 설치 Python> HWPX_REQUIRE=1 npm run test:hwp-research`로 정책·표본·red를 검사한다.
2. 그 Python으로 `scripts/build-hwp-research-fixtures.py --output <새 디렉터리>`를 실행한다.
3. Mac 한글과 자동화/손쉬운 사용 권한을 준비한다. 사용자 작업이 없는 세션에서
   `node scripts/check-hwpx-opens.mjs --report <새 결과.json> <8개 파일>`을 실행한다.
   순서는 manifest의 cases 배열 그대로이며 마지막 정상 대조군을 생략하지 않는다.
4. Claude는 하네스의 보존·중단·오류 분류를 먼저 독립 검토한다. 이후 직접 만든 기존 문서를
   열린 상태로 둔 별도 보존 시험, 열렸던 변형의 본문 확인·재저장·재열기·PDF를 수행한다.
5. 여러 구역에서 ID 변경/누락/순서를 분리해 시험한다. 앞뒤 정상 대조군·실패 표본을 함께 둔다.
   그 결과와 공개 규격을 대조한 뒤에만 H1-c의 validator/생성 규칙 채택을 결정한다.

원본 표본과 실행 보고서는 로컬 `/private/tmp/h1-package-20261014-a/`에 있다.
임시 파일이 사라져도 생성기로 다시 만들 수 있으나 ZIP 시각 등으로 전체 파일 해시가 달라질 수 있다.
소스 commit만으로 미커밋 생성기 버전을 특정할 수 없으므로 manifest의 소스별 해시도 함께 확인한다.
