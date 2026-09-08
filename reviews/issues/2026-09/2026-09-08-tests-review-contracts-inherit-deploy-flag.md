# 검사가 배포 플래그를 물려받아 A단계로 내리면 7건이 빨간불

- ID: `REV-2026-051`
- 날짜: `2026-09-08`
- 보고자: `Claude`
- 상태: `resolved`
- 심각도: `P2`
- 영향 영역: `tests`
- 관련 인계: `HANDOFF-2026-073`, `HANDOFF-2026-074`

## 요약과 영향

`scripts/check-review-contracts.mjs` 와 `tests/regression-test.html` 의 검사들이 자기가
검사할 단계를 선언하지 않고 `service-config.js` 의 `libraryCloudSchema` **배포 플래그를
그대로 물려받았다.** 두 묶음 합쳐 **7건**이다.

`HANDOFF-2026-073` 은 "구형 Rules 를 쓰는 배포는 **코드 공개 전에 0 으로 설정**해야
한다" 고 지시한다. **그 지시를 따르는 순간 회귀 7건이 빨간불이 된다** — 제품이 깨진
것이 아니라 검사가 B단계 동작을 A단계 설정으로 돌린 것뿐인데, 실행 결과만 보고는
**제품 결함과 구분할 수 없다.**

방향이 나쁜 쪽으로 겹친다. 출시 직전, 가장 확인이 필요한 순간에 안전망 일곱이 한꺼번에
빨간불이 되고, 그것을 무시하는 습관이 생기면 진짜 회귀도 함께 묻힌다.

부수적으로 **A단계(=지금 출시하는 설정) 경로에 실질 검사가 거의 없었다.** 단계를
명시한 검사는 `capability off …` 하나뿐이고, 삭제된 폴더 가리기(`liveFolderId`)가 A 에서
도는지는 아무도 보지 않았다.

## 재현 절차

```bash
# HANDOFF-2026-073 의 지시대로 A단계로 내린다
sed -i '' 's/libraryCloudSchema: 1,/libraryCloudSchema: 0,/' service-config.js
node scripts/check-review-contracts.mjs   # 3건 실패
npm run test:audit-browser                # 4건 실패
```

## 기대 결과 / 실제 결과

- 기대: 배포 플래그 값과 무관하게 검사는 자기가 정한 단계를 검사하고 전부 통과한다.
- 실제: 7건이 실패한다.
  - `check-review-contracts.mjs` (3건)
    - `folder tombstone masks stale membership…` — `setToDoc().folderId` 가 A 에서는
      필드 자체가 없어 `undefined`
    - `A migration distinguishes absent field…` — `migrateFoldersToCloud()` 가 A 에서
      즉시 반환(no-op)
    - `concurrent prefs save…` — `saveLibraryPrefs()` 가 A 에서 즉시 반환
  - `tests/regression-test.html` → `npm run test:audit-browser` (4건)
    - `폴더가 바뀌면 '안 바뀌었다' 고 답하지 않는다(setJSON)` — A 는 folderId 를
      직렬화하지 않으므로 두 JSON 이 같다
    - `폴더가 클라우드 문서에 실린다(setToDoc)`
    - `삭제된 폴더는 오래된 소속을 직렬화하지 않는다`
    - `규칙의 허용 필드와 앱이 보내는 필드가 같다` — A 의 키 목록에 folderId 가 없다

## 근거

- 플래그 0 에서 7건 실패, 1 에서 전부 통과 — 제품 코드는 건드리지 않았다.
- 일곱 실패는 모두 `libraryCloudEnabled()` 게이트(`index.html:3343`)를 지나는 B 전용
  경로다. `folderOf` 의 tombstone 가리기처럼 **두 단계 모두에서 지켜야 하는** 동작과
  섞여 한 검사 안에 들어 있었다.

## 처리 기록

- 2026-09-08 — Claude: 재현 후 직접 수정.
  - `app()` 이 `index.html` 검사에 `schema`(A=0 · B=1) **선언을 강제한다.** 안 하면
    던진다 — 앞으로 어떤 검사도 배포 플래그를 조용히 물려받을 수 없다.
    `service-config.js` 가 로드 때 `PEDAGOGY_PUBLIC_CONFIG` 를 덮으므로 **로드 뒤에**
    건다(`libraryCloudEnabled()` 는 호출 시점에 읽으므로 충분하다).
  - 한 검사에 섞여 있던 두 계약을 갈랐다. **삭제된 폴더 가리기는 두 단계 모두**
    (정본이 문제집 문서든 옛 이관 지도든) · **명시적 빈 값이 옛 지도를 이기는 것은
    B 전용**이다. A 는 클라우드에 `folderId` 를 보내지도 읽지도 않으므로 로컬 지도가
    정본으로 남는 것이 맞다.
  - 검사 수 14 → 16.
  - `tests/regression-test.html` 에 `withSchema(v, fn)` 을 두어 단계를 **걸고
    되돌린다**(안 되돌리면 같은 페이지의 뒤 검사가 오염된다). 넷 중 셋은 B(1)로 걸고,
    **규칙 허용 필드 대조는 두 단계를 함께** 본다 — 새 Rules 가 `folderId` 를 선택
    필드로 받으므로 A 의 좁은 키 목록도 유효해야 하고, 한쪽만 보면 구형 Rules 배포에서
    저장이 통째로 막히는 것을 못 잡는다.
- 검증(깨보기 다섯, 전부 빨간불 확인):
  1. 호출부에서 `schema` 를 빼면 → `index.html 검사는 libraryCloudSchema 를 선언해야
     합니다` 로 실패.
  2. `liveFolderId()` 의 tombstone 가리기를 없애면 → **schema 0 · 1 두 검사가 함께**
     빨간불(A단계 검사가 장식이 아님을 확인).
  3. `REVIEW_RED=1` (기준 커밋 `31da3eb` 제품 코드 공급) → 16건 중 13건 빨간불.
     초록 셋은 정당한 대조군이다(정적 HTTP 다운로드는 기준 커밋에서도 됐고, 나머지
     둘은 제품과 무관한 브라우저 사실·기존 계약).
  4. `setToDoc` 의 capability 게이트를 없애 **A 에서도 folderId 를 보내게** 하면 →
     규칙 허용 필드 대조가 빨간불(구형 Rules 저장 차단을 실제로 잡는다).
  5. `setToDoc` 이 **B 에서도 folderId 를 안 보내게** 하면 → 3건 빨간불.
- 배포 플래그 **양방향 확인**: `libraryCloudSchema` 0 에서 계약 16/16 · 회귀 154/154,
  1 에서도 계약 16/16 · 회귀 154/154. 검사가 배포 값으로부터 독립됐다.
- 같은 커밋에서 `libraryCloudSchema` 를 **0 으로 내렸다** — 사용자가 새 Rules 배포
  여부를 확인하지 못했기 때문이다. 배포가 확인되면 1 로 올린다.
- 운영 push·Rules/Worker 배포는 하지 않았다.
