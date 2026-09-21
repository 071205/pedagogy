# 초과 문제집의 로컬 저장 실패를 기기 저장 성공으로 안내한다

- ID: `REV-2026-098`
- 날짜: `2026-09-21`
- 보고자: `Codex / GPT-6 Astra high`
- 상태: `resolved`
- 심각도: `P1`
- 영향 영역: `index`
- 관련 인계: `HANDOFF-2026-156`

## 요약과 영향

크기 제한을 넘은 문제집을 클라우드 batch에서 제외할 때 로컬 저장까지 용량 오류로 실패해도
"이 기기에는 저장돼 있습니다"라고 안내한다. 실제 자료는 메모리에만 남아 있으므로 사용자가
안전하게 보존됐다고 오인하고 탭을 닫으면 작업을 잃을 수 있다.

## 재현 절차

1. 실제 브라우저에서 로그인 상태와 한글 330,000자인 문제집을 만들고 `localDirty=true`로 둔다.
2. `Storage.prototype.setItem`만 `QuotaExceededError`를 던지게 하고, Firestore는 쓰기 기록용
   가짜로 바꾼다.
3. 실제 `flushToCloud()` → `writeCloudSnapshot()` → `flushLocal()` → `writeLocalNow()` 경로를
   실행한다.
4. 로컬 저장 여부, `localDirty`, 클라우드 쓰기·ACK, 토스트와 저장 상태를 확인한다.

## 기대 결과 / 실제 결과

- 기대: [`docs/STORAGE-CONTRACT.md`](../../../docs/STORAGE-CONTRACT.md) §1-3대로 로컬·클라우드
  모두 미보존임을 알리고 즉시 JSON 내보내기를 안내한다. 로컬 저장 실패 상태를 용량 초과 상태로
  덮지 않는다.
- 실제: `localPersisted=false`, `localDirty=true`, 클라우드 쓰기와 `cloudSynced` 갱신은 없지만
  최종 토스트는 "이 기기에는 저장돼 있습니다"라고 한다. `⚠ 로컬 저장 실패`도 `⚠ 용량 초과`로
  덮이고 JSON 내보내기 안내가 없다.

## 근거

- `index.html`의 `writeCloudSnapshot()`은 `flushLocal()`의 `false`를 무시한다.
- 초과본만 있는 경로(`index.html:3528` 부근)와 정상·초과 혼합 경로(`index.html:3552` 부근)가
  로컬 저장 성공 여부와 무관하게 같은 성공 문구와 용량 상태를 쓴다.
- `scripts/check-sets-cloud-size.mjs`는 `flushLocal`을 빈 함수로 대체해 이 실패 조합을 검증하지 않는다.
- 2026-09-21 독립 Chromium 재현에서 위 실제 결과를 확인했다.

## 처리 기록

- `2026-09-21` — `Codex / GPT-6 Astra high`: 실제 저장 호출 경로에서 로컬 quota 실패와
  클라우드 크기 초과를 함께 주입해 등록.
- `2026-09-21` — `Codex`: `flushLocal()` 반환값을 보존해 로컬 실패 때 기기 저장 성공 문구를
  쓰지 않고 JSON 내보내기를 즉시 안내하도록 `index.html`을 수정했다. 초과본만 있는 경로와
  정상·초과 혼합 경로 모두 `⚠ 로컬 저장 실패`를 유지한다.
- `2026-09-21` — `Codex / GPT-6 Astra high`: 실제 `flushToCloud()` 경로를 같은 초과 구성으로
  두 번 실행하고 혼합 batch도 확인했다. 매번 복구 안내가 나오며 `localDirty=true`, 초과 원본
  불변, 정상본만 ACK, 추가 재시도 없음이 확인됐다. `npm run test:sets-cloud`의 표적 6건과
  방어 전 `33af005` 깨보기 4건도 통과했다.
