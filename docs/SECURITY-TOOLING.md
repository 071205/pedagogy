# 보안 검사 도구의 역할 — 2026-10-29

사용자가 Sonar 고집 없이 프로젝트에 맞는 도구/코드를 비교·적용하도록 승인했다.
이 문서는 도구 판단 근거이며 실행 순서는 DEV-TOKEN-ROADMAP 한 곳에서 관리한다.

## 현재 적용 결정

출시 판단의 주축은 Gitleaks 신규 diff 검사, Firebase Rules emulator 권한/실패 주입,
Worker 권한/App Check/quota 계약 검사, 실제 브라우저 CSP/저장/출력 회귀, 독립 코드 검토다.
이는 이미 .github/workflows/verify.yml과 package.json에 연결되어 있다. 기존 검사를 새 도구로
대체했다고 주장하지 않으며 SAST가 알려지지 않은 결함을 찾는 역할도 남는다.

Sonar는 보조 탐지/변경 감시로 유지한다. 대시보드 전체 스타일·복잡도 정리를 출시 선행 작업으로
확대하지 않는다. **도구의 초록불 자체가 출시 증거가 아니며, 근거 있는 미해결 보안 결함은
어떤 도구가 찾았든 출시 전에 처리한다.** 새 보안 경고는 영향과 입력→실행 경로를 대조하고
오탐/수용은 정확한 ID·코드 revision·독립 검토·잔여위험을 남긴다. 일괄 무시/분석 범위 축소로
출시를 통과시키지 않는다. 현재 Sonar gate는 적법한 개별 판정 후 OK이며 미해결 취약점0이다.
GitHub required checks·Sonar quality profile/gate·분석 설정·CI는 이번에 변경하지 않았다.
향후 도구 교체도 기존 실제 결함 탐지/검증의 공백이 없음을 확인한 뒤 좁은 변경으로 적용한다.

## 후보 비교와 한계

| 수단 | 이 프로젝트에서 맡길 역할 | 이번 판단 |
| --- | --- | --- |
| 기존 표적 검사 + Gitleaks + Rules emulator + 브라우저 + 독립 검토 | 비밀·권한·과금/저장 불변조건과 사용자 여정 | 계속 사용. 범용 SAST 전체 대체라고 쓰지 않음 |
| Sonar | 새 위험 후보 탐지·변경 감시 | 유지하되 스타일 정리/지표 자체를 개발 목표로 삼지 않음. 이번23건은 독립 분류 완료 |
| CodeQL | JS/TS·Python의 데이터 흐름/보안 질의 후보 | 공식 지원은 확인. 이 저장소 실측/CI 비용/정확도 비교는 아직 없으므로 우월 판정·즉시 교체 안 함 |
| Semgrep CE | 좁은 규칙의 로컬 검사/프로젝트 금지 패턴 후보 | 공식적으로 함수/파일 경계 한계가 있어 여러 파일/단계를 지나는 저장·인증 검증의 대체로 쓰지 않음. 실측 전 추가 필수 job으로 넣지 않음 |

CodeQL/Semgrep 실행 파일은 현재 로컬 PATH에서 확인되지 않았다. 설치·원격 분석·새 서비스 등록은
수행하지 않았다. 지금 새 필수 도구를 더할 재현된 탐지 공백은 특정하지 못했으므로 추가하지 않는다.
필요 시 안전한 합성 취약 예제/수정 대조와 실제 런타임 파일로 정상·검출/오탐·시간을 측정해
기존 검사로 놓치는 결함을 찾는 쪽만 채택한다. private/로그/사용자 자료와 transcript.txt는 제외한다.

## 공식 근거 (2026-10-29 확인)

- CodeQL 언어/프레임워크: https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/
- Semgrep CE의 함수/파일 경계 한계: https://github.com/semgrep/semgrep/blob/develop/README.md
- Sonar 개별 이슈 판정과 지표 갱신: https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/issues/editing

실제 프로젝트 증거: reviews/audits/2026-10-29/prelaunch-security/README.md.
