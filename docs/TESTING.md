# 테스트 운영 기준

PEDAGOGY는 사용자 편집 화면을 느리게 만들지 않고, 코드 변경 시점에 따라 검사의 강도를
나눈다. 테스트 파일이나 개발 도구는 배포된 편집기에서 실행되지 않는다.

## 1. 빠른 검사 — 코드 수정 뒤

~~~
npm run check:fast
~~~

수초 안에 끝나는 다음 검사를 묶는다.

- Worker의 quota·CORS·플랜 한도·UID 해시화 단위 테스트와, 인증 → 예약 → 사용 확정 → AI 호출,
  삭제 시 사용 기록 파기까지의 요청 계약 테스트
- 수학·국어·이미지·인쇄 기준 문제집 JSON의 구조와 수식 이스케이프 검사
- App Check와 CSP, AI Worker 주소, 비밀값 노출, CI 필수 단계의 정적 검사

## 2. 브라우저 회귀 검사 — UI·렌더링 변경 뒤

~~~
python3 serve.py --port 8799
~~~

브라우저에서 http://127.0.0.1:8799/regression-test.html을 연다. 저장·클라우드 삭제
같은 실제 사용자 데이터를 바꾸는 함수는 호출하지 않는다. 이 검사는 고정 문제집 4종을
실제로 읽어 normSet()/normBlock() 경로에 통과시키며, 수학 수식·국어 지문·이미지·긴
인쇄 문항의 핵심 속성이 보존되는지 확인한다.

## 2-1. 격리 통합 검사 — 저장·복원·인쇄 경로 변경 뒤

~~~
python3 serve.py --port 8801
~~~

브라우저에서 http://127.0.0.1:8801/integration-test.html을 열고 실행한다. 이 검사는
일반 편집기와 다른 포트를 사용해 localStorage origin을 분리하고, 기준 문제집 4종을
정규화 → 실제 로컬 저장 → iframe 새로고침 → 복원 → 인쇄 DOM 생성 경로에 통과시킨다.
검사 끝에는 해당 포트의 원래 localStorage 값을 복원한다. 로그인 상태에서는 중단한다.

이 검사는 실제 인쇄 대화상자나 운영 Firebase에는 접속하지 않는다. 출시 전에는 아래
수동 게이트에서 실물 PDF도 확인한다.

## 2-2. 인쇄 시각 회귀 — 조판·CSS·글꼴·인쇄 렌더링 변경 뒤

~~~
npm exec playwright install chromium  # 최초 한 번
npm run test:visual
~~~

기준 문제집 4종을 실제 전체 가져오기 input으로 불러온 뒤, 인쇄용 A4 첫 페이지 PNG를
`test-fixtures/visual-baseline/`의 승인된 기준본과 비교한다. `pixelmatch`는 글꼴
안티앨리어싱만 제외하고 전체 픽셀의 0.5%를 넘는 차이를 실패 처리한다. 실패하면 CI가
실제 결과와 차이 이미지를 artifact로 남긴다.

기준 이미지를 갱신하는 명령은 다음이다. **의도한 조판 변경을 사람이 PDF로 확인하고 코드
리뷰를 받은 경우에만** 실행한다. 실패를 없애려고 기준본만 갱신하면 회귀 검사의 의미가 없다.

~~~
npm run update:visual-baseline
~~~

## 3. Firebase 권한 검사 — 저장·로그인·이미지·Rules 변경 뒤

~~~
npm run check:rules
~~~

Java 21 이상이 필요하다. Firestore·Storage Emulator에서 운영 프로젝트와 분리된
pedagogy-rules-test 프로젝트를 띄운 뒤, 다음을 실제로 허용/거부한다.

- 본인·타인·비로그인 Firestore 접근
- 문제집 문서 ID, 필드 화이트리스트, tombstone 형식
- 본인 이미지 경로, 타인 읽기/쓰기, MIME, 중첩 경로, 5MB 경계

@firebase/rules-unit-testing은 Emulator에만 연결하며 운영 Firebase 데이터에 닿지 않는다.

## 4. GitHub CI — push·PR

CI는 npm ci로 package-lock.json의 테스트 의존성을 고정 설치한 뒤 빠른 검사와 Firebase
권한 검사를 모두 실행한다. Java 21을 명시적으로 설치하며, 공백 오류도 직전 커밋과
비교한다.

## 5. 출시 전 수동 게이트

자동화할 수 없는 외부 설정은 실제 테스트 계정에서 한 번 더 확인한다.

- 실제 App Check site key를 넣은 로그인·Firestore 저장·Storage 업로드
- AI Worker의 운영 Origin·Secret·비용 한도
- 결제 웹훅과 서버가 발급한 Firebase custom claim
- 기준 문제집 4종의 브라우저 인쇄/PDF 결과(자동 PNG 비교를 통과한 뒤 최종 사람 확인)

## 새 테스트 원칙

버그를 고칠 때는 재현 테스트를 먼저 추가한다. 새 테스트는 관련 값을 임시로 틀리게 해
실제로 실패(빨간불)하는 것을 확인한 뒤 원래 값으로 되돌린다. 테스트 개수보다, 실제
결함을 잡을 수 있는지와 각 검사의 책임 범위가 분명한지를 우선한다.
