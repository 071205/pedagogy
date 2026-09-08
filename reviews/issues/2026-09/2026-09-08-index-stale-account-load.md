# 계정 전환 전 시작한 클라우드 읽기가 새 계정 로컬 칸을 덮는다

- ID: `REV-2026-032`
- 날짜: `2026-09-08`
- 보고자: `Codex`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-066`
- 분석 기준: `cbd951e`의 격리 사본. 2026-09-08 최신 `ae5740e`에서도 같은 결함 재현.
  아래 코드 줄 번호는 최초 분석 기준이며 최신 코드에서는 함수 이름으로 찾는다.

## 요약과 영향

공용 브라우저의 빠른 로그아웃·로그인이나 늦은 네트워크 응답에서 이전 계정 내용이 다음 계정 화면·캐시에 노출될 수 있다. 원격 B 계정 업로드까지는 이번 모의 재현으로 주장하지 않는다.

## 재현 절차

실제 loadSets의 A 계정 get()을 지연시킨다. 기다리는 동안 currentUser를 B로 바꾼 뒤 A 응답을 반환한다. 사용자 자료 대신 A 전용 표식만 쓴다.

## 기대 결과 / 실제 결과

- 기대: 인증 세대 번호와 owner를 캡처하고 모든 await 뒤·상태 반영 직전에 둘을 확인한다.
- 실제: loadSets가 owner를 읽기 요청에만 사용하고 await 이후에는 확인하지 않는다. A 응답이 전역 sets에 들어가고 B를 대상으로 하는 writeLocalNow가 호출된다. watchCloud의 소유자 검사는 이 초기 읽기를 보호하지 않는다.

## 근거

`index.html:2457` loadSets 및 `index.html:6075` 부근 onAuth. 재현 도구: `reviews/audits/2026-09-08/audit-repro.mjs / STALE_ACCOUNT_LOAD`.
인증·DB·AI·Storage 외부 경계는 모의 구현이며 운영 계정·사용자 데이터는 사용하지 않았다.
전체 범위와 제한은 [종합 보고서](../../audits/2026-09-08/REPORT.md)를 참조한다.

## 수정 설계

인증 세대 번호와 owner를 캡처하고 모든 await 뒤·상태 반영 직전에 둘을 확인한다. stale 결과는 폐기한다. onAuth/bootLibrary의 후속 UI·히스토리 초기화에도 같은 세대 검사를 적용한다. 계정 전환 전 대기 중 로컬 저장은 이전 소유자로 확정하거나 명시적으로 보존한다.

## 완료 판단에 필요한 검사

A→B, A→guest, A→B→A를 지연·역순 응답으로 재현. 이전 세대가 새 캐시·sets·구독·히스토리를 변경하지 않아야 한다.

## 처리 기록

- 2026-09-08 — Codex / HANDOFF-2026-067: 사용자 승인으로 수정. authEpoch+uid로 읽기·legacy 이관 await·구독·boot/onAuth 후속 처리를 보호한다. 전환 전 기존 owner 캐시에 flush하고 실패 시 계정별 메모리 복구본으로 보존한다. A→B, A→B→A, 동일 uid/guest 콜백 보존·이전 owner flush 검사 통과.
  새 안전 회귀는 `scripts/check-audit-safety.mjs`, `scripts/check-audit-browser.mjs`,
  `scripts/check-hwpx-concurrency.py`에 있으며 수정 전 cbd951e 격리 사본의 실패도 확인했다.
  운영 계정·AI·실제 사용자 원본을 호출/삭제하지 않았으며 배포·푸시는 하지 않았다.

- 2026-09-08 — Codex: 실제 함수를 이용한 독립 재현으로 등록. 제품 수정은 하지 않았으며 Claude 검토 후 구현 예정.
