# 로컬 저장 실패에도 dirty를 지워 재시도와 종료 경고가 사라진다

- ID: `REV-2026-038`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-066`
- 분석 기준: `cbd951e`의 격리 사본. 2026-09-08 최신 `ae5740e`에서도 같은 결함 재현.
  아래 코드 줄 번호는 최초 분석 기준이며 최신 코드에서는 함수 이름으로 찾는다.

## 요약과 영향

저장 공간 초과·저장소 차단 상황에서 작성한 내용이 메모리에만 남고, 추가 편집 없이 공간을 확보해도 flush가 다시 쓰지 않는다. 창을 닫으면 작업을 잃을 수 있다.

## 재현 절차

비로그인 상태에서 localStorage.setItem이 용량 오류를 내도록 하고 실제 flushLocal을 두 번 호출한다. 운영 저장소 대신 가짜 저장소를 쓴다.

## 기대 결과 / 실제 결과

- 기대: 성공한 경우에만 dirty를 해제하고 실패 상태를 별도로 유지한다.
- 실제: 첫 호출 false, localDirty=false, 둘째 호출 true. hasUnsavedCloudWork는 비로그인이므로 false다. 저장 실패 토스트는 나오지만 미저장 상태는 유지되지 않는다.

## 근거

`index.html:2755` flushLocal 및 hasUnsavedCloudWork, beforeunload. 재현 도구: `reviews/audits/2026-09-08/audit-repro.mjs / FAILED_LOCAL_SAVE`.
인증·DB·AI·Storage 외부 경계는 모의 구현이며 운영 계정·사용자 데이터는 사용하지 않았다.
전체 범위와 제한은 [종합 보고서](../../audits/2026-09-08/REPORT.md)를 참조한다.

## 수정 설계

성공한 경우에만 dirty를 해제하고 실패 상태를 별도로 유지한다. 종료 경고는 클라우드 dirty뿐 아니라 로컬 미저장도 포함한다. 화면에 지속 경고와 JSON 내보내기 경로를 제공하고 복구 시 재시도한다.

## 완료 판단에 필요한 검사

quota 오류·저장소 차단→공간 복구→재저장, 비로그인/로그인 종료 경고, 계정 전환 중 실패한 버퍼의 소유자 보존을 검증한다.

## 처리 기록

- 2026-09-08 — Codex / HANDOFF-2026-067: 사용자 승인으로 수정. localStorage 성공 때만 dirty/복구본을 해제한다. 실패 후 재flush 및 guest 종료 경고 유지, 저장소 회복 후 clean 검사 통과. 클라우드도 실패했을 때 로컬에 저장됐다는 잘못된 안내를 제거했다.
  새 안전 회귀는 `scripts/check-audit-safety.mjs`, `scripts/check-audit-browser.mjs`,
  `scripts/check-hwpx-concurrency.py`에 있으며 수정 전 cbd951e 격리 사본의 실패도 확인했다.
  운영 계정·AI·실제 사용자 원본을 호출/삭제하지 않았으며 배포·푸시는 하지 않았다.

- 2026-09-08 — Codex: 실제 함수를 이용한 독립 재현으로 등록. 제품 수정은 하지 않았으며 Claude 검토 후 구현 예정.
