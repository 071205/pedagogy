## 합의

REV159 접근과 호출 순서는 타당하다. 원본 paraPr을 편집하지 않고 CENTER 사본을 추가하는 방식은 JUSTIFY로 남아야 할 5/24 공유 서식을 지킨다. capture 이전 실행이라 복제 ID가 캡처된 연속·선택과목 머리글에 그대로 실리고, clearBody/stripBindata/normalizePageTotals는 paraProperties를 건드리지 않아 사본이 고아가 되지 않는다. 재실행 시 이미 CENTER면 복제를 생략하므로 멱등. itemCnt 재계산은 양쪽 모두 paraPr만 세어 일치. linesegarray 삭제 후 Save As→재열기 PDF 바이트 동일은 재배치 안정성 증거로 충분하다.

## 미합의

1. **후행 공백 미제거.** 선행만 strip한다. CENTER에서 후행 공백은 잉크를 공백 폭 절반만큼 좌측으로 민다. 377.5/379px(기준 380)의 잔차와 페이지별 편차가 정확히 이 증상이다. 역방향 루프가 필요하다.
2. **align 부재 paraPr을 조용히 건너뜀.** `continue`로 빠지면 상속 기본값이 JUSTIFY/LEFT인 제목이 미정렬로 남고 공백 제거도 안 된다. 없으면 복제 후 align을 만들어야 한다.
3. **복제본이 margin.left/right·indent를 상속.** 패딩이 공백이 아닌 들여쓰기로 구현된 머리글이 섞이면 CENTER여도 치우친다. 복제 시 0 확인이 필요하다.
4. **정규식이 `영역(` 밀착만 허용.** `수학 영역 (확률과 통계)`나 전각 괄호면 불일치해 미적용된다.

## 근거

Q2는 조건부 충분이다. 현재 4개 제목이 모두 CENTER가 된 것은 캡처 전 적용이 옳음을 보이나, 선택과목 제목은 buildExam에서 사후 기입되므로 openTemplate 시점 증거만으로 패딩 재주입 여부를 보증할 수 없다.

## 다음

- 후행 공백 제거, align 부재 처리, margin/indent 0 검증을 JS/Python 동시 반영.
- 정규식에 `영역\s*[(（]` 허용.
- check-hwpx-exam.mjs에 buildExam **이후** 단언: 모든 머리글 p가 CENTER, 선후행 공백 0, paraPrIDRef ∈ 복제 집합.
- 선택과목·연속 머리글 포함 네이티브 PDF 재측정으로 380±0.5 확인.

참고: Write 도구가 비활성화되어 계획 파일은 생성하지 못했고, 위 내용이 리뷰 결과 전체다.
