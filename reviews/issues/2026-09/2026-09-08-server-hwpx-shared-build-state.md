# 동시 HWPX 내보내기가 전역 상태를 공유해 구역 배치를 바꾼다

- ID: `REV-2026-035`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `server, mock`
- 관련 인계: `HANDOFF-2026-066`
- 분석 기준: `cbd951e`의 격리 사본. 2026-09-08 최신 `ae5740e`에서도 같은 결함 재현.
  아래 코드 줄 번호는 최초 분석 기준이며 최신 코드에서는 함수 이름으로 찾는다.

## 요약과 영향

두 탭·동시 사용자의 출력 내용 위치가 잘못될 수 있다. 이번 재현은 구역 오배치이며 다른 사용자의 본문 유출까지 확인한 것은 아니다.

## 재현 절차

A의 선택과목 문항 emit 직전만 Event로 대기시킨다. 실제 B 공통 문항 build를 완료한 뒤 A를 재개한다. 코드는 바꾸지 않고 실행 순서만 제어한다.

## 기대 결과 / 실제 결과

- 기대: 빠른 완화는 build 전체를 제한된 큐/잠금으로 직렬화하되 대기 상한과 busy 응답을 둔다.
- 실제: A 표식은 단독 실행에서는 section1에 있고, 겹쳐 실행하면 section0에 있다. 예외 없이 파일이 생성된다. 서버의 import 잠금은 build를 보호하지 않으며 CUR/STYLE/PROFILE/TMPL_MARKS 등은 모듈 전역이다.

## 근거

`serve.py:558,680`; `mock_to_hwpx.py:73,87,786,951`. 재현 도구: `reviews/audits/2026-09-08/audit-concurrency.py / CONCURRENT_EXPORT`.
인증·DB·AI·Storage 외부 경계는 모의 구현이며 운영 계정·사용자 데이터는 사용하지 않았다.
전체 범위와 제한은 [종합 보고서](../../audits/2026-09-08/REPORT.md)를 참조한다.

## 수정 설계

빠른 완화는 build 전체를 제한된 큐/잠금으로 직렬화하되 대기 상한과 busy 응답을 둔다. 장기적으로 요청별 BuildContext에 모든 가변 상태를 넣는다. --reload-hwpx도 실행 중 build와 경쟁하지 않게 한다.

## 완료 판단에 필요한 검사

서로 다른 공통/선택·과목·그림 루트의 동시 출력이 각각 단독 출력과 같아야 한다. 예외 뒤 다음 요청도 오염되지 않아야 한다.

## 처리 기록

- 2026-09-08 — Codex / HANDOFF-2026-067: 사용자 승인으로 수정. 직접 Python build 진입점을 RLock으로 직렬화하고, HTTP는 import/reload+두 변환기 실행 전체를 같은 RLock으로 보호한다(진입 대기 TIMEOUT 후 503). 실제 동시 출력에서 A 선택 section1/B 공통 section0, 예외 후 재출력 통과. BuildContext 전면 이관은 후속 개선.
  새 안전 회귀는 `scripts/check-audit-safety.mjs`, `scripts/check-audit-browser.mjs`,
  `scripts/check-hwpx-concurrency.py`에 있으며 수정 전 cbd951e 격리 사본의 실패도 확인했다.
  운영 계정·AI·실제 사용자 원본을 호출/삭제하지 않았으며 배포·푸시는 하지 않았다.

- 2026-09-08 — Codex: 실제 함수를 이용한 독립 재현으로 등록. 제품 수정은 하지 않았으며 Claude 검토 후 구현 예정.
