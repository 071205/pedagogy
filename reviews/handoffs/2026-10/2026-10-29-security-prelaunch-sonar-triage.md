# 출시 전1 — Sonar 보안 지적 판정·원격 반영

- ID: `HANDOFF-2026-206`
- 날짜: `2026-10-29`
- 작성자: `Codex Sol high`
- 상태: `needs-follow-up` (Sonar 미결 해소, 전2 진행·REV147 잔여 이력 유지)
- 영향 영역: `security`, `docs`
- 관련 이슈: `REV-2026-147` (open 유지; 새 재현 제품 결함 없음)

## 결과·증거

[감사 증거](../../audits/2026-10-29/prelaunch-security/README.md).
main9cff81d 최신 분석fc829bff의23건을 코드/흐름으로 대조하고 원격 반영했다.
XML namespace16+글꼴응답XSS1은 오탐, style3+localHTTP3은 기존 제한적 위험 수용이다.
사용자 Sonar 로그인 뒤 UI에서 정확한 대상만 분류하고 API로 FALSE_POSITIVE17/ACCEPTED6,
미해결 취약점0·gateOK/new_security_rating1을 독립 확인했다. 규칙/threshold/코드 변경 없음.

## 검증·독립 검토

- 관련 코드 origin/main diff0, 합성 font HTTP probe: MIME/nosniff·확장자/경로 거절·LAN403.
- Claude Opus/high readonly foreground2회 성공. 코드 결론 합의. 초안의 낡은revision/22건/디코딩순서/style hash불가 오류는 최신 API·코드로 정정받았다. 정정 원문 포함 보존.
- 기존 R1 독립 수용 근거 재사용. 실제 사용자 자료/글꼴/과거 secret 원문 접근 없음.
- 제품 동작 변경 없어 전체 브라우저 회귀 재실행 없음. 문서 위생·diff 검사 수행.

## 재개 체크포인트

현재 branch codex/r7-guest-host-verified, 기본 checkout 전환 없음. transcript.txt 접근 없음.
Sonar 보안 미결은 해소됐지만 전1의 REV147 잔여 이력은 기존 조사/수명 근거로 추적 유지하며 이력 rewrite하지 않는다. 새 API/OAuth key 노출로 확대하지 않는다.
다음은 통합 레일 **전2 편집→구성→저장/재진입→미리보기→실제 출력**의 증거 공백만 보완한다.
지원 브라우저/한글·AI·계정/파일·App Check·호스트·개인정보 등 전체 출시 게이트는 미완료다.

## 도구 활용 방향 조정

사용자가 Sonar 고집 없이 대안 조사/적용을 허용했다. 공식 CodeQL/Semgrep/Sonar 문서와 실제 CI/검사 구성을 대조해 SECURITY-TOOLING에 결정 근거를 남겼다. 기존 표적 보안/회귀·독립 검토를 주축, Sonar 보조 탐지로 활용하며 미해결 실제 보안 결함의 차단은 유지한다. 새 SAST 실측/설치·CI 설정·required check 변경은 없고 우월성도 주장하지 않는다. 다음 전2 핵심여정/실제 출력.
