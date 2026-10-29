## 합의

**1) JS 부모 가드 — 합의.** `hwpx-exam-template.js:441` 에서 `nums[0].parentNode.localName !== "ctrl"` 로 직계 부모만 허용. Python(`experiments/hwp-export/template.py:598-601`)은 `ctrl` 중 `find("hp:autoNum")` 가 있는 것만 고르고, `find` 는 lxml 직계 자식 경로(`pedagogy_hwpx.py:145-147`)다. `paras[0]` 의 autoNum이 1개라는 선행 조건 때문에, 그 autoNum이 ctrl 직계가 아니면 Python도 `ctrl is None → continue` 로 **JS와 동일하게 스킵**한다. 비대칭 없음.

**2) 체커 대칭 — 합의.** `check-hwpx-exam.mjs:291` 에 `isinstance(c.tag, str)` 로 주석/PI 제외(JS `n.children` 와 동치), `:715-719` 에서 저장 blob을 `unzip(raw.buffer)` 로 다시 풀고 masterpage XML을 파싱, `parsererror` 시 throw. DOM만 맞고 직렬화가 깨진 경우를 실제로 잡는다.

**3) 기대값 — 합의.** `:784-794` 가 PAGE 1개 + `num="1"` TOTAL_PAGE(단일 `autoNumFormat`, DIGIT, prefix/suffix 빈값) 1개 + `ctrl@id` 없음 + 숫자만 든 `t` 없음을 4개 바탕쪽 모두에 요구. 현재 소스 PAGE ctrl에 id 없음과 일치.

**4) 네이티브 검증 — 합의.** `hwpx-native-verification.json` 에 생성본/라운드트립 각각 3쪽·`1/3,2/3,3/3`, PNG 3장 동일, 변경 파트는 masterpage0-3 뿐, 해시·앱버전(12.30.0)·도구 오류 정정 기록까지 포함.

## 미합의
없음.

## 근거
위 라인 직접 확인 + 검증 JSON. 재시험 없음.

## 다음 (비차단, 선택)
- `:787` 은 **형태가 맞는** TOTAL_PAGE 1개만 세므로 형태가 틀린 두 번째 TOTAL_PAGE는 빠져나갈 수 있다. `numType==="TOTAL_PAGE"` 총개수 `=== 1` 단언을 추가 권장.
- `:791` 의 바탕쪽 전역 `ctrl@id` 금지는 범위가 넓다. 향후 템플릿이 id 달린 ctrl을 정당하게 추가하면 무관한 이유로 실패한다. autoNum을 품은 ctrl로 한정 권장.

**재현된 블로커: 없음.** 릴리스 진행 가능하며, 기존 한계(Windows 한글·실물 프린터 미검증)는 JSON `limits` 에 이미 명시돼 있다.
