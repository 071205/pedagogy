## REV158 독립 최종 검토 (읽기 전용)

### 합의
- **런타임 경계 타당.** `open_template`에서 `clear_body`/`strip_bindata`와 같은 지점, 양측 호출 순서 동일, `Contents/masterpage\d+\.xml`만, 본문·원본 자산 불변, 계획 쪽나눔 수를 분모로 쓰지 않음. 모든 호출자가 한 번씩만 통과한다.
- **가드가 좁고 멱등.** 정규화 후 그 run의 요소 자식이 2개(ctrl+t)가 되어 재실행 시 `children.length !== 1`에서 탈락한다. TOTAL_PAGE 중복 삽입 불가 — 확인.
- **저장 경로 확실.** JS는 `toBlob()`이 모든 XML 파트를 항상 재직렬화(`hwpx-engine.js:999-1003`)하므로 변경 플래그 누락이 없고, Python은 `set_attr`/`insert_xml`이 `mark_modified`를 부른다(`pedagogy_hwpx.py:166,184`).
- **(2) 기대값은 양쪽 동시 오류를 상당히 잡는다.** 정규화 미적용(TOTAL_PAGE 0), 셀 구조 변이로 인한 조용한 no-op, 바탕쪽 4개 수, `num!=1`, 남은 숫자 전용 `t`가 모두 실패로 떨어진다. `sortDeep`이 배열 순서를 보존(`check-hwpx-exam.mjs:377`)해 자식 순서 비교도 유효하다. RED 세 경로는 모듈 전역 조회·문자열 치환 실패 시 throw로 설계가 맞다.

### 미합의 (머지 전 조건)
1. **JS ctrl 가드 비대칭.** Python은 `ctrl`이면서 `autoNum`이 직속 자식인 노드만 복사하는데(`find`는 직속 탐색), JS는 `nums[0].parentNode`를 무조건 복제한다. autoNum의 부모가 ctrl이 아닌 모양에서는 JS가 run 안에 run을 넣어 깨진 XML을 만들고 Python은 건너뛴다. 현재 틀에서는 재현되지 않지만 구현 간 유일한 실질 분기다.
2. **검사기 `tree()` 주석 처리.** Python `for c in n`은 주석/PI를 포함하고 `etree.QName(comment)`는 ValueError를 던져 빌드 스크립트가 죽는다(JS `children`은 건너뜀). 치명적이진 않지만(loud fail) `pedagogy_hwpx.py:119` 전례대로 필터가 필요하다.
3. **증거 범위.** PDF 프로브는 "관측된 네이티브 컨트롤로 치환"인데 생산 코드는 "PAGE ctrl 복제 + `autoNumFormat` 상속 + 빈 `<hp:t/>` 잔존"이다. 분모에 접두/접미 서식이 상속되는지, 빈 t가 간격을 만들지는 프로브가 증명하지 않았다. 진행 중인 생성물 네이티브 검증이 1/3·2/3·3/3을 확인하면 해소된다.
4. **parity 비대칭.** JS masters는 직렬화 전 DOM, Python은 쓰인 zip에서 뜬다. JS 직렬화 단계 결함은 parity를 통과한다.

### 근거
`template.py:571-608`, `hwpx-exam-template.js:427-451`, `check-hwpx-exam.mjs:243-244,287-295,691-720,771-786`, `pedagogy_hwpx.py:118-188`, `hwpx-engine.js:995-1005`. 세 파일에서 현재 틀 기준으로 재현되는 버그는 찾지 못했다. 1·2는 조건부 결함이다.

### 다음
1. JS에 `nums[0].parentNode.localName !== "ctrl"` 탈락 1줄 추가.
2. 검사기 Python `tree()`에 `isinstance(c.tag, str)` 필터.
3. 기대값에 TOTAL_PAGE의 `autoNumFormat type=DIGIT`와 복제 ctrl의 중복 id 부재 1줄 추가(프로브가 덮지 않은 서식 상속 구멍).
4. 생성물 네이티브 검증 결과(실제 PDF 분모)를 REV158 기록에 첨부한 뒤 머지. 그 전에는 **조건부 합의**.
