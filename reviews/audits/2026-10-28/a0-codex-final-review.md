# A0 최종 독립 Codex 검토

2026-10-28 · 구현 root Codex / 검토 별도 `/root/a0_independent_review` 에이전트.
사용자 “클로드 다시 시도해보고 안되면 해결하고 ㄱ”에 따른 조건부 대체다.

## 합의

수정된 현재 A0 코드의 독립 검토를 통과한다. 이전 통과 판정은 SDK의 호스트 상수 확인을 누락해 철회했으며, 이 판정으로 대체한다.

## 근거

- 고정 SDK10.12.0의 URL 상수는 `https://content-firebaseappcheck.googleapis.com/v1`이다. SHA256 `3897630a79b188ddb4e69005057c63dae211a052a5887262d9f3e3d2166e0a19` 원문에서 확인했다.
- 현재 runtime은 이 호스트와 정확한 staging projectId·appId·Enterprise action·key·POST를 대조한다. 독립 VM에서 정상 fetch/XHR 2건과 잘못된 project·number·app·action·key·method·이전 호스트의 거절 18건이 모두 통과했다. backend 요청은 없었다.
- 생성된 index/document의 connect-src에도 content 호스트가 포함됨을 확인했다.
- CSP 검사는 spy 이전의 native fetch를 사용하고 정확한 합성 요청만 로컬 응답으로 처리한다. 검사 결과의 정상 완료·runtime RED14·CSP 목표 RED 검출·정리 성공을 확인했다.
- 6개 모듈과 npm·CI 연결에서 추가 재현 결함은 없었다. REV154/155의 실행 시점 gate와 admission 재검사도 원인을 해소한다.

## 미합의

현재 A0 범위에는 없다.

## 다음 행동

REV156과 최초 판정 정정 근거를 같은 이슈·인계에 기록하고, 최종 검사 증거를 갱신한 뒤 PR/CI 진행.

## 확인 한계

실제 Google 로그인·App Check 토큰 발급/enforcement·Firestore ACK·원격 자원 생성·실자료 이관·운영 배포는 미검증이다. main Sonar 및 R7/R8 운영 게이트는 유지한다. 전체 검사를 중복 실행하지 않았으며 최소 VM 검사와 산출물·검사 코드·결과를 독립 확인했다. 파일 수정·커밋·기본 checkout 전환·transcript.txt 접근은 하지 않았다.
