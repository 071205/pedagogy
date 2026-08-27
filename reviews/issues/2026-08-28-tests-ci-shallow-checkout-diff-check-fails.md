# CI의 `actions/checkout` 기본 얕은 클론 때문에 `git diff --check HEAD~1 HEAD` 단계가 항상 실패한다

- ID: `REV-2026-006`
- 날짜: `2026-08-28`
- 보고자: `Claude`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-003`

## 요약과 영향

`.github/workflows/verify.yml`의 마지막 단계("Whitespace errors")가 `git diff --check
HEAD~1 HEAD`를 실행한다. `actions/checkout@v4`는 `fetch-depth`를 지정하지 않으면
기본값 1(얕은 클론, 커밋 하나만)을 받아온다. 이 상태에서는 `HEAD~1`이 존재하지 않아
이 단계가 **매 push·PR마다 항상 실패**한다. 기능상 실제 문제가 없어도 CI가 항상
빨간불이 되므로, 이후 진짜 회귀가 생겨도 "원래 항상 실패하던 단계"로 취급돼
놓치기 쉽다.

## 재현 절차

1. 이 저장소를 `git clone --depth 1 --branch main <repo>`로 얕게 클론한다
   (`actions/checkout@v4`의 기본 동작과 동일).
2. 클론된 폴더에서 `git diff --check HEAD~1 HEAD`를 실행한다.

## 기대 결과 / 실제 결과

- 기대: 직전 커밋과의 공백 오류만 확인하고 정상 종료한다.
- 실제: `fatal: ambiguous argument 'HEAD~1': unknown revision or path not in the working
  tree.`로 종료 코드 128, 워크플로 실패.

## 근거

로컬에서 `git clone --depth 1 --branch main file://<이 저장소>/.git <임시 폴더>` 로
GitHub Actions의 기본 체크아웃과 같은 조건을 재현한 뒤 같은 명령을 실행해 위 오류를
그대로 확인함. `.github/workflows/verify.yml`의 `actions/checkout@v4` 스텝에
`fetch-depth`가 없음(`actions/checkout` 기본값 1).

## 제안 (선택)

`actions/checkout@v4` 스텝에 `with: fetch-depth: 2`를 추가한다(이 단계가 필요로 하는
건 직전 커밋 하나뿐).

## 처리 기록

- `2026-08-28` — `Claude`: 등록 및 수정. `.github/workflows/verify.yml`의
  `actions/checkout@v4` 스텝에 `fetch-depth: 2`를 추가했다.
  검증: 위 재현 절차를 `--depth 2`로 다시 실행해 `git diff --check HEAD~1 HEAD`가
  정상 종료(코드 0)함을 확인함.
