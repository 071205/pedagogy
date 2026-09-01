# 변경 인계 — HWPX 엔드포인트 검사 실패 시 임시 그림 정리

- ID: `HANDOFF-2026-016`
- 날짜: `2026-08-31`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `tests`, `docs`
- 관련 이슈: `REV-2026-011`

## 변경 내용

`experiments/hwp-export/test_endpoint.py`가 서버 포트를 열 수 있는지 먼저 확인하고,
그 뒤에만 `work/`와 저장소 루트에 임시 그림을 만든다. 따라서 포트 권한이 없는 환경에서는
검사가 즉시 실패하며 작업 트리에 PNG를 남기지 않는다.

## 검증

- 제한된 환경에서 `test_endpoint.py`를 실행해 `PermissionError`를 의도적으로 냈고,
  `work/hwpx-endpoint-check.png`와 `hwpx-endpoint-outside.png`가 생성되지 않음을 확인했다.
- 권한 있는 환경에서 `HWPX_REQUIRE=1 npm run check:fast` 통과.
- `HWPX_REQUIRE=1 npm run test:hwpx-parity` 통과: 34문항의 선지 배치가 편집기와 일치.
- `git diff --check` 통과.

## 다음 검토자에게

포트 바인드 실패가 표본 생성보다 앞선다는 점과, 정상 경로에서 `test_endpoint.py`가 만든
그림을 여전히 정리하는지를 확인해 달라.
