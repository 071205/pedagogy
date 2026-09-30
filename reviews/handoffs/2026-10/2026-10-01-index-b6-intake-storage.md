# 변경 인계 — B6 쪽별 staging·공통 원문·독립 채택

- ID: `HANDOFF-2026-173`
- 날짜: `2026-10-01`
- 작성자: `Codex`
- 상태: `ready-for-review`
- 영향 영역: `index | worker | tests | docs | server`
- 관련 이슈: `REV-2026-108`(기존 위치 기반 지문 편집 결함은 수정하지 않음)

## 변경 내용

최신 `main=2ff20f3`에서 `codex/b6-intake-storage`를 만들었다. RAIL-ORDERS ⑨ B6를 구현했다.
상세 API·활성화/호환 경계는 [B6 구현 문서](../../../docs/B6-INTAKE-STORAGE.md)를 따른다.

- `normIntake()`를 먼저 연결해 출처·분류·검토 상태를 정규화/JSON/클라우드/복원/복제에서 보존한다.
- `pedagogy-intake.js`: owner별 IDB 원문/작업/쪽 결과/고정 채택 매핑, 삭제 세대·계정 fence,
  한 쪽씩 순차 호출·성공 잠금·명시 재시도·부분 성공, 라이브러리 실제 flush와 권별 cloud 관측.
- `index.html`: 경쟁 local/cloud 쓰기 보류, 원문 삭제 전에 첫 server ACK 구독/전체 기록 확인,
  D4 계정별 설정/결과 경로, Auth 삭제 전 원문·staging·설정 파기. 실제 UI 연결은 U1.5/U2에서 한다.
- `pedagogy-intake-contract.js`/Worker: 별도 task 스키마·엄격 응답 검증. 기존 AI 경로 보존.
  **운영 기본 인스턴스는 새 task를 503으로 차단한다.** 실제 공급자 호출·요금·secret·Rules 변경 없음.
- PDF.js 6.3.289 고정 로컬 renderer/폰트/CMap/codec, 정확한 공개 자산 목록, CSP 해시 재계산.

HANDOFF-172의 메모 3개는 모두 적용했다. (1) 첫 서버 확정 구독 전·offline·손상 기록은 원문
삭제 확인 필요. (2) cloud `intake.sources`는 sourceId/pages만, 900KiB 계산에 포함.
(3) normProblem 출처 보존을 구현 출발점으로 삼아 기존 round trip에 연결했다.

## 위험과 검토 요청

중심 diff는 `index.html`, `pedagogy-intake.js`, `pedagogy-intake-contract.js`, `pedagogy-normalize.js`,
`worker/index.js`, `scripts/check-intake.mjs`다. 추가로 공개 PDF 자산 목록/build-public/serve.py와
`worker/intake.test.mjs`의 경계 검증을 확인한다. 원문 저장·계정 삭제·탭 조정 통합 때문에 접점 범위가 넓다.

1. library stale baseline/marker + Web Lock, IDB 매핑 선행, 실제 flush 실패/사후 장부 실패,
   사용자 편집본 보존·tombstone·재진입에 유실/중복 반례가 없는지 확인한다.
2. 실제 권+충돌+복구본+job+예정 연결 합집합, 확인 ticket/revision/source generation,
   원문 삭제/계정 전환·파기 뒤 늦은 쓰기·외부 출처 권한의 반례를 확인한다.
3. metadata privacy/서로 다른 검토 상태, 500문항과 900KiB, document/사진 AI schema 보존을 확인한다.
   B6 지문 이동/제외는 draft IDs 기준이며 기존 `REV-2026-108` 해결로 오해하지 않는다.
4. PDF codec용 `wasm-unsafe-eval` 추가·JS eval 차단·vendor inventory/소스맵 제외를 확인한다.

자동 승인 검토가 무조건 writer marker를 지우는 안을 거절했다. 그 안은 실행/채택하지 않았다.
실제 exclusive lock 획득 중 query()의 단일 holder/clientId와 옛 clientId 부재를 확인하는 방식으로
바꿨고 승인된 도구 실행·실제 두 탭 수용 검사를 통과했다. 모르는 옛 marker는 계속 보류한다.

## 검증

모든 AI/Firestore/계정 입력은 fixture/stub이고 브라우저 외부 요청을 차단했다.

- `npm run test:intake`: Worker task 경계 + browser IDB 수용 **28개**, 실제 두 탭 같은 채택 ID,
  stale library 전체 배열 쓰기 보류, 살아 있는 writer 보호·닫힌 탭 marker의 실제 소유 대조 복구, PNG/PDF 2쪽의 글자·도형 픽셀 렌더/저해상도 거절 통과.
  `B6_RED=1`: normProblem의 intake 보존을 제거해 해당 회귀와 새 regression-test.html 2개 행이 실제 실패함을 확인.
  Worker 문항 상한 제거 변이도 실패 탐지 확인.
- 수용 범위: raw/매핑 IDB 실패, 전체 local 실패 재개, 성공 잠금·명시 재시도·partial,
  여러 권 cloud ACK/tooBig 분리, 외부 500 유지, cloud/JSON 직접 입력의 출처 비공개 필드 제외·ACK 고정점, source metadata UTF-8 크기 포함,
  owner/epoch·늦은 응답·원문 삭제/계정 fence, 복제/충돌/백업 영향, unlinked/Undo,
  source 외부 표시의 Blob 권한 차단, 실제 구성원과 한 권 내 명시 복제의 groupSpan 재계산, D4 결과/owner 설정.
- `npm run test:audit-browser`: serve.py의 **167/167**, malformed server JSON 12개 거절.
- `npm run test:worker`: 기존 B5/AI/document/telemetry 및 안전성 검사 통과.
- `npm run test:sets-cloud`: 정상 10개 통과; 방어 없는 과거판 변이 7개 실패 탐지.
- `npm run test:set-revision`: 정상 35개 통과; 과거판 35개 실패 탐지.
- `npm run test:review-contracts`, `test:fixtures`, `test:public`, `check:static` 통과.
- `git diff --check`, review hygiene(열린 이슈 4·INDEX 118/120·최근 5), 마지막 CSP/공개 자산 검사 통과.
- `test:intake`를 `check:fast`에 포함해 CI에서도 필수 실행한다.

실제 iPad/Safari 장기 보관·회수 후 복구, 스캔/폰트별 PDF 표본, 실제 AI 품질/비용은 아직 미검증이다.
C1~C3/D3, 지원 버전 운영 전환, D1 공유 저장 게이트는 그대로 대기다. B7 outbox·U1.5/U2 UI는 시작하지 않았다.
`transcript.txt`는 읽거나 수정·추가하지 않았다. push/배포·실제 AI 호출 없음.

## 다음 검토자에게

**Claude Opus 5**, RAIL-ORDERS ⑩으로 B6 diff와 위 증거만 독립 검토한다.
기준 `2ff20f3`과 현재 브랜치를 비교하고, 이미 승인된 B3/B4/B5 동일 diff를 재심사하지 않는다.
판정은 이 인계에 남긴다. 재현 결함만 reviews/issues에 등록한다.
합의 후 다음 구현은 **B7 / Codex GPT-6 Sol high**. 구현자는 여기서 멈춘다.

## 검토 기록

- 독립 검토 대기.
