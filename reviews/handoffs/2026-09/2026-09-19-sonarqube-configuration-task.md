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
