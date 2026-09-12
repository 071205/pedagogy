# 오프라인 생존성 및 데이터 동기화 아키텍처 제안서

- ID: `HANDOFF-2026-121`
- 검토: `HANDOFF-2026-122` · 아래 후속 판정 참조

- **작성:** Antigravity
- **대상:** Codex 및 다음 작업자
- **관련 문서:** `docs/COMMERCIAL-LAUNCH.md`

## 1. 현재 데이터 저장 방식의 한계

현재 PEDAGOGY 앱은 `localStorage`에 상태(`setsKey()`, 설정값 등)를 즉시 동기적으로 쓰고, `saveTimer`를 통해 디바운스(Debounce)하여 Firestore로 백그라운드 전송(`flushToCloud()`)하는 방식을 쓰고 있습니다.

이는 네트워크 단절 시에도 최신 데이터를 로컬에 남긴다는 장점이 있지만, 상용 SaaS 환경에서는 치명적인 3가지 한계가 존재합니다.

1. **용량 초과 위험 (Quota Exceeded Error):**
   `localStorage`는 도메인당 최대 5MB의 텍스트 데이터만 저장할 수 있습니다. 모의고사나 문제집 데이터가 쌓이거나, Base64 이미지가 포함될 경우 얼마 지나지 않아 한도에 도달하여 저장이 완전히 멈추고 데이터가 유실됩니다.
2. **동기식 블로킹으로 인한 UI 멈춤 (Main Thread Jank):**
   1~2MB 크기의 JSON을 `JSON.stringify()`하여 `localStorage.setItem`으로 기록하는 작업은 메인 스레드를 수 밀리초(ms) 이상 차단합니다. 사용자가 타이핑할 때마다 프레임 드랍(버벅임)을 체감하게 됩니다.
3. **앱 오프라인 로딩 불가 (No Service Worker):**
   데이터는 로컬에 남아있더라도, 정작 사용자가 오프라인 상태에서 "새로고침(F5)"을 누르면 웹앱(index.html, js, css) 자체를 다운로드하지 못해 하얀 화면만 보게 됩니다. 진정한 오프라인 앱이 아닙니다.

---

## 2. 모던 오프라인 아키텍처 도입 계획 (IndexedDB + PWA)

Google Docs, Figma 등 모던 생산성 SaaS가 채택하고 있는 **"Offline-first IndexedDB"** 전략을 제안합니다.

### Phase 1: LocalStorage에서 IndexedDB로의 마이그레이션 (우선순위: 최고)
- **도입 기술:** `idb-keyval` 또는 `Dexie.js` (또는 브라우저 네이티브 IndexedDB API 래퍼).
- **작업 내용:**
  1. 현재 `localStorage.setItem(setsKey(), ...)`로 동기 저장되는 부분을 비동기 `await indexedDB.put(...)`으로 변경.
  2. 메인 스레드 블로킹 해소 (UI 끊김 현상 제거).
  3. 5MB 용량 제한 해제 (디스크 용량이 허용하는 한 수 GB까지 저장 가능).
  4. 구버전 사용자들을 위해 초기 로딩 시 `localStorage`에 데이터가 있다면 IndexedDB로 마이그레이션하는 스크립트 작성.

### Phase 2: Firebase Offline Persistence 활용 (네트워크 복원력)
Firebase JS SDK는 내장형 오프라인 지속성(Offline Persistence) 기능을 제공합니다.
- **작업 내용:**
  `firebase.firestore().enableIndexedDbPersistence()`를 초기화 단계에서 호출하도록 수정.
  이를 통해 `flushToCloud()` 로직이 네트워크 에러를 만났을 때 개발자가 직접 타이머로 재시도할 필요 없이, Firebase SDK가 알아서 로컬 큐에 담아두었다가 인터넷이 연결되는 즉시 백그라운드에서 동기화합니다.

### Phase 3: PWA Service Worker 도입 (App Shell 캐싱)
네트워크가 없는 오프라인 비행기 모드에서도 웹앱 접속 자체를 가능하게 합니다.
- **작업 내용:**
  1. `service-worker.js`를 작성하여 `dist/public`의 핵심 HTML, JS, CSS 자산을 Cache Storage에 저장(Cache-First 전략).
  2. `manifest.json`을 추가하여 모바일 기기 홈 화면이나 데스크톱 PWA 설치(독립 앱처럼 실행) 지원.

### Phase 4: 충돌 해결 (Conflict Resolution - 다중 기기)
한 사용자가 노트북(오프라인 상태)에서 편집하고, 패드(온라인)에서 다른 수정을 한 뒤, 노트북이 온라인이 되는 상황입니다.
- **작업 내용:**
  현재의 단순 덮어쓰기(Last-write-wins) 방식은 작업물 유실을 낳습니다.
  Firebase의 `onSnapshot` 리스너를 활용해 로컬 버전(수정 시각)과 서버 버전을 비교하고, 충돌 발생 시 "다른 기기에서 변경된 사항이 있습니다. 덮어쓰시겠습니까?" 와 같은 경고 다이얼로그(UI)를 띄우도록 개선해야 합니다.

---

## 3. Codex(다음 작업자)를 위한 착수 가이드

이 문서의 **Phase 1(IndexedDB 전환)**이 가장 시급한 작업입니다.

1. `index.html`과 `mock-library-store.js`에서 `localStorage.setItem(setsKey(), ...)` 및 `getItem`으로 검색하여 모든 호출부를 찾으십시오.
2. 비동기 IndexedDB 유틸리티(예: `set(key, val)`, `get(key)`)를 작성하고, 기존 코드를 비동기(`async/await`) 흐름으로 변환하십시오.
3. 앱 로딩 시나리오에서 IndexedDB의 비동기 반환을 기다리도록 `init()` 과정을 수정해야 합니다.
4. 사용자의 기존 `localStorage` 데이터를 잃지 않도록 반드시 마이그레이션 함수를 1회 실행하게 하십시오.

## 독립 검토와 적용 판단 (2026-09-11 · Codex)

이 문서는 제안이며 전체 전환은 구현되지 않았다. 데이터 안전상 원문 그대로 적용하지 않는다.

- 현재 문제집 쓰기는 이미 150ms 디바운스이고 onSnapshot·시각 병합·tombstone·계정 epoch도 있다. 존재하지 않는 기능으로 설명한 부분을 정정한다.
- IndexedDB는 용량 문제를 완화하지만 stringify/structured clone 비용과 브라우저 저장소 삭제·퇴거를 없애지 않는다. 비동기 setItem 치환만으로 끝나지 않으며, transaction complete 이후 저장 표시, revision별 ACK, 실패 복구, 계정별 키, 삭제 대기열 배출, 구형 데이터 보존이 먼저 계약화돼야 한다.
- 현재 사용하는 compat SDK의 API는 `enablePersistence()`다. 제안의 `enableIndexedDbPersistence()`는 그대로 호출할 수 없다. 디스크 캐시와 앱의 클라우드 확정·계정 삭제 큐를 함께 검증해야 한다. Firebase도 웹 지속 캐시의 기기 신뢰 조건을 설명한다.
- Cache-First 전체 캐싱은 구형 HTML/JS/설정 혼합·Auth/App Check 정책 지연을 만들 수 있다. PWA는 원자적 앱 셸 버전, 업데이트/롤백, 세 CDN 라이선스·SRI·오프라인 의존성, origin 이전 계획이 필요하다. Service Worker 등록·캐시·IndexedDB 이관은 이번에 실행하지 않았다.
- 대신 실제로 재현한 데이터 유실 경로를 수정했다: 모의고사 불변 전송본 ACK, owner별 실패 복구본, 종료/계정 전환 전 저장, 하위 데이터 삭제 실패 시 계정 보존(`REV-2026-082~084`).
- 근거: [Firebase 오프라인 지속성](https://firebase.google.com/docs/firestore/manage-data/enable-offline), [IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction), [후속 검토](../../audits/2026-09-11/FOLLOWUP-REVIEW.md).
