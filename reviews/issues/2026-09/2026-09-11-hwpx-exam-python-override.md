# 시험지 HWPX 대조만 HWPX_PYTHON을 무시하고 생략됨

- ID: `REV-2026-088`
- 날짜: `2026-09-11`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P2`
- 관련 인계: `HANDOFF-2026-122`

## 재현과 영향

lxml을 포함한 Python을 HWPX_PYTHON으로 지정하고 HWPX_REQUIRE=1로 check:fast를 실행했다. 다른 HWPX 검사는 실행됐지만 check-hwpx-exam은 python3를 하드코딩하여 lxml 없음으로 중단했다.

## 처리 기록

다섯 Python 호출 모두 HWPX_PYTHON을 사용하고 미설정 때만 python3로 대체한다.

동일 환경의 npm run test:hwpx-exam: 수정 전 종료 코드 3, 수정 후 역할 22종·문단 13개·배치 7종·표 3개·시험지 9문항 대조 통과.
