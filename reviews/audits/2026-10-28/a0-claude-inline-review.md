결함 2건 있습니다(둘 다 이 두 조각 범위 안에서 재현 가능).

**1) 타임아웃으로 `fail()` 된 스크립트가 차단 후에도 실행됩니다.**
해당 줄: `const timer=setTimeout(()=>resolve(false),15000);` + `if(!loaded&&new URL(source,location.href).origin===config.origin)fail();`
`resolve(false)`는 요청을 취소하지 않고 `script`는 `document.head`에 남아 있습니다. 최소재현: 같은 출처 번들 하나를 15초 초과 지연(DevTools throttling 또는 응답 지연 프록시)으로 제공 → 배너 "초기화 차단" + `loginBtn` disabled + `locked=true`가 된 뒤, 16~20초쯤 그 스크립트가 정상 로드되어 전역 스코프에서 실행되고 UI/스토리지를 다시 건드립니다. 즉 "차단" 상태와 "부팅됨" 상태가 공존합니다. `async=false` 순서 보장도 깨지지 않으므로 이후 inert 스크립트가 있었다면 그 뒤에 이어 실행됩니다. 최소 수정 방향: 타임아웃 시 `script.onload/onerror` 무효화 플래그 + `script.remove()`만으로는 취소가 보장되지 않으니, 실패 경로에서 `src`를 비우거나(`script.src=''`) 더 확실히는 `fetch(src,{integrity,signal})` 선검증 후 주입.

**2) `fresh`가 await 이전 값으로 고정되어 동일 출처 2번째 프레임이 정상 새 프로필에서도 잠깁니다.**
해당 줄: `fresh = !profile();` 와 `if ((fresh && dbs.length) || ...)fail();`
localStorage/IndexedDB는 iframe과 공유되는데 `fresh`는 각 프레임의 동기 시점 스냅샷입니다. 최소재현: 빈 프로필에서 부모가 admission 후 firebase 스크립트가 `firebase-*` IDB를 생성하고, 같은 설정의 iframe이 그 사이에 `indexedDB.databases()`를 await 중이면 iframe은 `fresh===true && dbs.length>0` → `fail()` → 배너/로그인 차단. 반대 순서면 통과하므로 로드 타이밍 의존 플레이크입니다. 최소 수정: await 이후 재검사에서 받은 값으로 갱신 — `const now=profile(); if((!now&&dbs.length)||...)fail();`

확인 한계: marker 누수(동기 recheck→`setItem` 사이 await 없음), `admitted` 전 marker 기록 경로, `deferApplicationScripts`의 inline 금지·`type=` 금지·`service-config.js` 1회 강제, 주석 우선 분기(`attrs===undefined`)는 이 범위에서 결함을 찾지 못했습니다. 다만 교차출처 로드 실패가 조용히 무시되는 `if(!loaded&&...origin===config.origin)` 조건은 의도 확인이 필요한 설계 선택입니다(결함으로 계수하지 않음).
