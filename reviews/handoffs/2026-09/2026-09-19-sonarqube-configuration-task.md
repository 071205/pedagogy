# 소나큐브 설정 및 오탐 방지 가이드 (SonarQube Configuration)

- **작성:** Antigravity
- **작성일:** 2026-09-19
- **대상:** 다음 작업자 (Codex 등)

## 배경
사용자가 SonarQube Cloud를 통해 정적 분석을 돌린 결과, `scripts/`와 `experiments/` 폴더 내의 스크립트 파일들에서 **Path Traversal (경로 조작 취약점)** 이슈가 다수 검출되어 Security 등급이 **E(Blocker)**로 떨어졌습니다. 
해당 파일들은 로컬 개발/테스트용 CLI 도구이므로 런타임 환경에서 외부 사용자의 악성 입력에 노출되지 않으며, 인자로 파일 경로를 받아 실행하는 것은 정상적인 동작입니다.

## 요구사항 (작업 지시)

소나큐브가 테스트 스크립트를 상용 웹 서버 코드처럼 빡빡하게 검사하여 발생하는 **오탐(False Positive)**을 막기 위해, 프로젝트 최상단에 소나큐브 설정 파일을 추가해야 합니다.

1. 프로젝트 루트 디렉토리에 `sonar-project.properties` 파일을 생성합니다.
2. 해당 파일에 아래 속성을 추가하여 `scripts/`, `experiments/`, `tests/` 등의 테스트/개발 도구 폴더를 보안 검사 대상에서 제외하거나 테스트 코드로 분류하도록 설정합니다.
   (예: `sonar.exclusions` 또는 `sonar.test.inclusions` 속성 활용)
3. 만약 위 방법 대신 UI 상에서 처리하기로 결정한다면, SonarQube Cloud 대시보드에서 해당 이슈들을 `Resolve as False Positive` 혹은 `Accept`로 일괄 처리하도록 가이드라인 문서(`docs/OPERATIONS-RUNBOOK.md` 등)에 기록합니다.

이 작업이 완료되면 소나큐브 리포트에서 가짜 Security Blocker들이 사라지고, 실제 서비스 코드(`worker/`, `index.html`)에 숨어있는 **Reliability(안정성) D등급(140건)**에 해당하는 진짜 버그(Null 에러, 예외 처리 누락 등)들만 집중적으로 분석하고 고칠 수 있게 됩니다.

## 처리 기록 — 2026-09-20 Codex

기존 `sonar-project.properties`는 SonarQube Cloud **Automatic Analysis가 읽는 파일이 아니었다**.
커밋 `1cc6425` 분석 화면에 `sonar.tests is not configured` 경고가 그대로 남았고,
`scripts/`·`experiments/`가 상위 보안 이슈에 계속 표시되는 것으로 독립 확인했다. 당시 기준은
27k LOC, 열린 이슈 835건(Security 163 · Reliability 143 · Maintainability 702)이었다.

- 자동 분석용 `.sonarcloud.properties`로 교체했다.
- `sonar.sources=.`를 제거하고 실제 브라우저 앱·Worker·로컬 서버·Rules·CI 설정만 명시했다.
- `scripts/`, `experiments/`, `reviews/`, `tests/`, `.claude/`, fixture와 생성 템플릿 데이터는
  제품 분석 범위 밖에 뒀다. 이 파일들은 사용자 입력을 받는 배포 코드가 아니라 로컬 검사·생성 도구다.
- 같은 `worker/`에 섞인 `*.test.mjs`만 test scope로 분류해 main/test 중복을 막았다.
- Python 3.12/3.13을 명시해 Python 버전 경고와 버전 추측에 따른 오탐을 줄였다.
- `scripts/check-sonar-scope.mjs`와 `npm run check:sonar`를 추가하고 `check:fast` 앞부분에 연결했다.
  새 런타임 파일 누락, 저장소 전체 재포함, Worker 테스트 분류 누락을 검사하며 고장 주입 3건도 잡는다.

로컬 검증: `npm run check:sonar` 통과(분석 가능 추적 파일 97개 대조, 자기검사 3/3),
`git diff --check` 통과. 실제 Cloud 재분석 결과는 이 변경을 `main`에 올린 뒤 대시보드에서 대조한다.

### 2026-09-20 후속 확인 및 정정

분석 범위 변경 후 Cloud 열린 이슈는 364건(Security 21 E, Reliability 61 C,
Maintainability 330 A; 품질별 건수는 중복 가능)이었다. 835→364 감소를 모두 오탐 해결로
부르는 것은 부정확하다. 특히 `experiments/hwp-export`는 `serve.py`가 실행하는 변환기여서
폴더 전체가 외부 입력과 무관하다는 위 설명은 정정한다. Worker 테스트 인식과 Python 버전
경고도 Cloud에서 여전히 보여 설정 완전 반영을 단정할 수 없다. 후속은 HANDOFF-150 참고.
