# HWPX 엔드포인트 검사가 기동 실패 때 그림 파일을 남김

- ID: `REV-2026-011`
- 날짜: `2026-08-31`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P3`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-014`, `HANDOFF-2026-015`

## 요약과 영향

`test_endpoint.py`는 실제 서버를 띄우기 전에 저장소의 `work/`와 루트에 그림 표본을
만든다. 그런데 포트를 바인드하지 못하면 `try/finally`에 들어가기 전 예외가 나므로,
테스트가 만든 `work/hwpx-endpoint-check.png`와 `hwpx-endpoint-outside.png`가 작업
트리에 남는다. 실패한 검사가 이후 커밋 후보를 오염시키고, 다시 실행해도 기존 파일을
자신이 만든 것으로 인식하지 않아 정리하지 않는다.

## 재현 절차

1. 두 표본 파일이 없는 깨끗한 작업 트리에서 포트 바인드를 막은 환경으로
   `python3 experiments/hwp-export/test_endpoint.py`를 실행한다.
2. `free_port()`의 `PermissionError`를 확인한다.
3. 저장소 루트와 `work/`에 위 두 PNG가 생겼는지 확인한다.

## 기대 결과 / 실제 결과

- 기대: 서버를 시작하지 못한 실패여도 검사가 새 파일을 만들지 않으며, 자신이 만든 파일은
  항상 정리한다.
- 실제: 포트 바인드 실패가 표본 생성 뒤에 발생해 두 파일이 남는다.

## 근거

2026-08-31에 제한된 로컬 포트 환경에서 `free_port()`가 `PermissionError: [Errno 1]
Operation not permitted`로 실패했다. 직후 `work/hwpx-endpoint-check.png`와
`hwpx-endpoint-outside.png`가 미추적 파일로 남았다.

## 처리 기록

- `2026-08-31` — `Codex`: 등록. 포트 바인드 실패 뒤 두 PNG가 남는 것을 재현했다.
- `2026-08-31` — `Codex`: 해결. `free_port()`를 표본 생성보다 먼저 호출하도록 옮겼다.
  제한된 환경에서 같은 `PermissionError`를 의도적으로 다시 내고도 두 PNG가 생기지
  않는 것을 확인했다. 권한 있는 환경에서는 `npm run check:fast`의 실제 엔드포인트·동시
  요청 검사와 34문항 선지 배치 대조가 모두 통과했다.
