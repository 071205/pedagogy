# 저장 중 추가 편집한 내용을 전송하지 않고 동기화 완료로 표시한다

- ID: `REV-2026-033`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-066`
- 분석 기준: `cbd951e`의 격리 사본. 2026-09-08 최신 `ae5740e`에서도 같은 결함 재현.
  아래 코드 줄 번호는 최초 분석 기준이며 최신 코드에서는 함수 이름으로 찾는다.

## 요약과 영향

다음 자동 저장이 “변경 없음”으로 건너뛰며 다른 기기에는 최신 편집이 없다. 서버 성공 응답 자체는 정상이라 사용자는 저장 실패를 알기 어렵다.

## 재현 절차

실제 flushToCloud가 v1을 batch.set에 보낸 뒤 commit을 지연시킨다. 그 사이 같은 문제집 객체의 이름을 v2로 바꾸고 commit을 완료한다.

## 기대 결과 / 실제 결과

- 기대: 배치 전송 시 payload·fingerprint·revision을 불변 스냅샷으로 캡처한다.
- 실제: 서버 전송 데이터는 v1, 현재 데이터는 v2인데 isCloudSynced가 true가 된다. dirty 목록은 변경 가능한 객체 참조이며 commit 뒤 그 객체를 다시 직렬화해 전송하지 않은 v2를 완료 지문으로 기록한다.

## 근거

`index.html:2788` flushToCloud, 특히 commit 이후 cloudSyncEntry(s,i). 재현 도구: `reviews/audits/2026-09-08/audit-repro.mjs / FALSE_SYNC_ACK`.
인증·DB·AI·Storage 외부 경계는 모의 구현이며 운영 계정·사용자 데이터는 사용하지 않았다.
전체 범위와 제한은 [종합 보고서](../../audits/2026-09-08/REPORT.md)를 참조한다.

## 수정 설계

배치 전송 시 payload·fingerprint·revision을 불변 스냅샷으로 캡처한다. 완료 시 그 전송본만 acknowledged로 기록하고 더 최신 revision은 dirty로 유지·재예약한다. 중첩 flush의 완료 역전도 revision 또는 단일 저장 큐로 제어한다.

## 완료 판단에 필요한 검사

commit 지연 중 편집, 저장 두 개의 완료 역전, 여러 배치 중 실패, 계정 전환을 검증. 전송되지 않은 값은 절대 synced가 되지 않아야 한다.

## 처리 기록

- 2026-09-08 — Codex / HANDOFF-2026-067: 사용자 승인으로 수정. 전송 payload/동기화 지문을 시작 시 복제하고 저장 큐를 직렬화했다. ack는 전송본까지만 진행하며 미전송 수정본을 재예약한다. v1 전송 중 v2 편집의 false ack 차단 및 겹친 저장의 최종 v2 ack 검사 통과.
  새 안전 회귀는 `scripts/check-audit-safety.mjs`, `scripts/check-audit-browser.mjs`,
  `scripts/check-hwpx-concurrency.py`에 있으며 수정 전 cbd951e 격리 사본의 실패도 확인했다.
  운영 계정·AI·실제 사용자 원본을 호출/삭제하지 않았으며 배포·푸시는 하지 않았다.

- 2026-09-08 — Codex: 실제 함수를 이용한 독립 재현으로 등록. 제품 수정은 하지 않았으며 Claude 검토 후 구현 예정.
