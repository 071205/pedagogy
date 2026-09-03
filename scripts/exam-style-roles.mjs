/* 모의고사 조판 역할 표 — 한 곳에만 둔다 (베타 · `docs/MOCK-STYLE-DESIGN.md` §4.3 6단계)
 *
 * 왜 이 파일이 있나
 * ------------------
 * 같은 조판 규칙이 **세 곳에 흩어져** 있다.
 *   · 파이썬 `template.STYLE_NAMES`  — 역할 → 실물 스타일 이름
 *   · 편집기 CSS(`mock-exam-editor.html`)  — 화면 근사 미리보기 값
 *   · 편집기 Typst 틀(같은 파일 `TYPST_FRAME`) — 정본 값
 * 베낀 것은 갈라진다. 실제로 그림이 실물이 쓰지 않는 문단 모양으로 나가고 있었고
 * (§8-④), Typst 만 구획 태그 자리를 다르게 잡고 있었다(`HANDOFF-2026-035`).
 *
 * ⚠️ **이 파일에서 값을 읽어 쓰지 않는다.** 이 저장소에는 빌드 단계가 없고, 제품은
 *    `.html` 파일 하나로 그냥 열려야 한다. 그래서 여기 적은 값은 **대조용 정답표**다
 *    (`choice-layout-truth.json` 과 같은 방식). 코드 값을 고치면 여기도 고쳐야 하고,
 *    안 고치면 검사가 빨간불을 낸다.
 *
 * 두 겹으로 검사한다
 * ------------------
 *   1. `scripts/check-exam-style-roles.mjs` (`check:static` · CI 에서 항상 돈다)
 *      — 파이썬 이름 목록과 편집기 값이 이 표와 같은가. **틀 파일이 없어도 돈다.**
 *   2. `experiments/hwp-export/test_style_roles.py` (틀이 있을 때만)
 *      — 이 표가 **실물 틀과 같은가.** 우리 표를 우리 표로 검사하지 않기 위한 층이다
 *        (설계 원칙 4). 틀이 없으면 건너뛴다(종료코드 2).
 *
 * 단위는 전부 mm, 각도·비율은 %.
 * 여백 값은 실물 `header.xml` 의 **HwpUnitChar 분기**(`<hp:case>`)에서 읽은 것이다 —
 * 한글이 실제로 적용하는 쪽이다(`<hp:default>` 는 그 두 배로 적혀 있다).
 */

/** 역할 → 실물 스타일. `by:"usage"` 는 **이름으로 못 찾는 것**이다(이름 없는 문단 모양). */
export const ROLES = {
  stem: {
    by: "name", names: ["01-문제"], what: "발문 첫 줄",
    real: { align: "LEFT", indent: -4.13, left: 0, right: 0, below: 3.88, line: 165 },
  },
  cont: {
    by: "name", names: ["21 문제다음", "21 문제다음 별행"], what: "발문 이어지는 줄",
    real: { align: "LEFT", indent: 0, left: 4.06, right: 0, below: 4.06, line: 165 },
  },
  eq: {
    by: "name", names: ["21 문제다음 별행", "21 문제다음"], what: "별행 수식",
    real: { align: "LEFT", indent: 0, left: 4.06, right: 0, below: 4.06, line: 165,
            stops: [14.11] },
  },
  choice: {
    by: "name", names: ["21 1행", "1행"], what: "선지(기본)",
    real: { align: "JUSTIFY", indent: -3.99, left: 3.88, right: 0, below: 0, line: 165,
            stops: [25.6, 47.2, 68.8, 90.4] },
  },
  // ⚠️ `1행`·`2행`·`3행` 은 '몇 번째 줄' 이 아니라 **선지가 몇 줄을 차지하는 배치**다.
  //    3+2 배치는 두 줄 모두 `2행` 을 쓴다(실물 각각 5회).
  ch1row: {
    by: "name", names: ["21 1행", "1행"], what: "선지 한 줄에 5개",
    real: { align: "JUSTIFY", indent: -3.99, left: 3.88, right: 0, below: 0, line: 165,
            stops: [25.6, 47.2, 68.8, 90.4] },
  },
  ch2row: {
    by: "name", names: ["2행"], what: "선지 두 줄(3+2)",
    real: { align: "JUSTIFY", indent: -4.0, left: 3.99, right: 0, below: 0, line: 165,
            stops: [40.0, 76.0] },
  },
  ch3row: {
    by: "name", names: ["3행"], what: "선지 세 줄(2+2+1)",
    real: { align: "JUSTIFY", indent: -3.99, left: 3.99, right: 0, below: 0, line: 165,
            stops: [58.0] },
  },
  cond: {
    by: "name", names: ["21 박스(테두리)", "02-박스"], what: "조건 상자 줄",
    real: { align: "LEFT", indent: 0, left: 8.01, right: 3.99, below: 1.41, line: 165 },
  },
  condeq: {
    by: "name", names: ["21 박스(테두리) 별행", "21 박스(테두리)"], what: "상자 안 별행 수식",
    real: { align: "LEFT", indent: -8.25, left: 8.01, right: 3.99, below: 1.41, line: 165,
            stops: [23.99] },
  },
  boxtop: {
    by: "name", names: ["21 박스위"], what: "조건 상자 앞 여백 문단",
    real: { align: "JUSTIFY", indent: 0, left: 3.99, right: 0, below: 0, line: 75 },
  },
  boxbot: {
    by: "name", names: ["21 박스아래"], what: "조건 상자 뒤 여백 문단",
    real: { align: "JUSTIFY", indent: 0, left: 3.99, right: 0, below: 0, line: 173 },
  },
  ex: {
    by: "name", names: ["21 보기", "02-보기"], what: "ㄱㄴㄷ 보기 줄",
    real: { align: "LEFT", indent: -6.28, left: 0.46, right: 0, below: 2.12, line: 160 },
  },
  // ⚠️ 아래 둘은 **이름으로 찾으면 틀린다.** 실물이 쓰는 문단 모양에 이름이 없고,
  //    이름이 그럴듯한 `보기`·`표 내용`·`확인사항-` 은 실물에서 **0회** 쓰인다.
  //    `template.read_roles_by_usage()` 가 '무엇이 들어 있는지' 로 찾는다(§8-②④).
  figure: {
    by: "usage", names: null, what: "그림 — 가운데 정렬 문단",
    real: { align: "CENTER", indent: 0, left: 0, right: 0, below: 0, line: 160 },
  },
  note: {
    by: "usage", names: null, what: "※ 확인 사항 표를 담는 문단",
    real: { align: "LEFT", indent: 0, left: 0, right: 0, below: 0, line: 165 },
  },
};

/** 이름으로 찾는 역할만 — 파이썬 `STYLE_NAMES` 와 이 목록이 같아야 한다. */
export const NAMED_ROLES = Object.fromEntries(
  Object.entries(ROLES).filter(([, r]) => r.by === "name").map(([k, r]) => [k, r.names]));

/** 쓰임으로 찾는 역할 — `read_roles_by_usage()` 가 이 역할들을 투표에 넣어야 한다. */
export const USAGE_ROLES = Object.entries(ROLES)
  .filter(([, r]) => r.by === "usage").map(([k]) => k);

/* ── 조판 값: 화면(CSS) · 정본(Typst) · 실물 ──────────────────────────────
 *
 * `css`/`typst` 는 편집기 원문에서 그 값을 집어내는 정규식이다. 셋이 같아야 하는 것도
 * 있고, **일부러 다른 것**도 있다 — 다른 것은 `real` 과 `why` 를 함께 적는다.
 * 값을 옮겨 적기만 하는 검사가 되지 않게, 다른 이유를 반드시 글로 남긴다.
 */
export const METRICS = [
  {
    key: "선지 한 줄(①~⑤) 칸 폭",
    value: [21.61, 21.6, 21.61, 21.59],
    css: /\.ch-1 \.r\{grid-template-columns:([\d. mm]+)auto\}/,
    typst: /#let ch1\(\.\.it\) = pad\(left: [\d.]+mm, top: CHGAP\)\[\s*#grid\(columns: \(([^)]*), auto\)/,
    // 실물 탭 정지점(25.6·47.2·68.8·90.4)에서 왼쪽 여백 3.99 를 빼 나온 간격이다.
    fromStops: { role: "ch1row", left: 3.99 },
  },
  {
    key: "선지 두 줄(3+2) 칸 폭",
    value: [36.01, 36.0],
    css: /\.ch-2 \.r\{grid-template-columns:([\d. mm]+)auto\}/,
    typst: /#let ch2\(\.\.it\) = \{ let a = it\.pos\(\); pad\(left: [\d.]+mm, top: CHGAP\)\[\s*#grid\(columns: \(([^)]*), auto\)/,
    fromStops: { role: "ch2row", left: 3.99 },
  },
  {
    key: "선지 위 여백",
    value: [6.5],
    css: /\.ch\{margin-top:([\d.]+)mm/,
    typst: /#let CHGAP = ([\d.]+)mm/,
  },
  {
    key: "조건 상자 폭",
    value: [104],
    css: /\.condbox\{width:([\d.]+)mm/,
    typst: /#let CONDW = ([\d.]+)mm/,
  },
  {
    key: "조건 상자 위아래 여백",
    value: [3.4],
    css: /\.condbox\{[\s\S]*?margin:([\d.]+)mm 0 [\d.]+mm/,
    typst: /#let condbox\(\.\.items\) = block\(above: ([\d.]+)mm/,
  },
  {
    key: "별행 수식 위아래 여백",
    value: [2.8],
    css: /\.dispeq\{text-align:center;margin:([\d.]+)mm 0\}/,
    typst: /#let dispeq\(body\) = block\(width: 100%, above: ([\d.]+)mm/,
  },
  {
    key: "구획 태그 폭 — 5지선다형", realFrom: "tag.choice.w",
    value: [38.99],
    css: /\.tag\{[\s\S]*?width:([\d.]+)mm;height:[\d.]+mm/,
    typst: /width: if t == "단답형" \{ [\d.]+mm \} else \{ ([\d.]+)mm \}/,
    real: [38.82],
    why: "편집기 값은 09 정본 실측, 실물 틀(25 양식)의 표는 38.82mm 다. 0.17mm 차이라 "
       + "눈에 띄지 않고 문항 자리에도 영향이 없어 그대로 두었다. 한글로 내보낼 때는 "
       + "틀의 표를 그대로 심으므로 결과물은 38.82mm 다.",
  },
  {
    key: "구획 태그 폭 — 단답형", realFrom: "tag.short.w",
    value: [27.84],
    css: /\.tag\.short\{width:([\d.]+)mm\}/,
    typst: /width: if t == "단답형" \{ ([\d.]+)mm \}/,
    real: [27.84],
  },
  {
    key: "구획 태그 높이", realFrom: "tag.choice.h",
    value: [8.29],
    css: /\.tag\{[\s\S]*?height:([\d.]+)mm/,
    typst: /#let sectag\(t\) = box\(stroke: [\d.]+mm, height: ([\d.]+)mm/,
    real: [8.28],
  },
  {
    // ⚠️ 이 값은 **문항 자리를 정한다.** 태그가 붙은 단은 이만큼을 위 여백으로 먹고
    //    남은 공간을 균등하게 나눈다. 예전엔 화면·Typst 가 근거 없는 19.5mm 를 썼다.
    //    한글 쪽은 `template.capture_marks()` 가 틀에서 직접 읽는다(15.92mm).
    key: "구획 태그가 단 위에서 먹는 높이", realFrom: "tag.step.v",
    value: [15.92],
    css: /\.tag\{[\s\S]*?margin:0 0 ([\d.]+)mm/,       // 상자 높이 8.29 를 더해야 한다
    cssAdd: 8.29,
    typst: /#let TAGH = ([\d.]+)mm/,
    real: [15.92],
  },
  {
    key: "※ 확인 사항 상자 폭", realFrom: "note.3.w",
    value: [112],
    css: /\.notebox\{[\s\S]*?width:([\d.]+)mm/,
    typst: /#let NOTEW = ([\d.]+)mm/,
    real: [111.0],
    why: "편집기 값은 09 정본, 실물 틀의 표는 111.00mm 다. 1mm 차이이고 상자는 쪽 오른쪽 "
       + "아래에 절대배치라 문항 자리에 영향이 없다. 한글 결과물은 틀의 표(111.00mm)를 쓴다.",
  },
];

/* ── 표 개체(구획 태그 · ※ 확인 사항)의 실물 크기 ─────────────────────────
 *
 * 이 둘은 문단이 아니라 **표**다. 우리가 만들지 않고 틀에서 떠다 심으므로
 * (`template.capture_marks()`), 여기 적힌 값은 '심어진 결과가 이래야 한다' 는 뜻이다.
 * `test_style_roles.py` 가 틀의 표와 직접 맞춘다.
 */
export const MARK_OBJECTS = {
  "tag.choice": { w: 38.82, h: 8.28, what: "5지선다형 태그 — 틀의 표제부에 이미 있다" },
  "tag.short": { w: 27.84, h: 8.28, what: "단답형 태그" },
  "note.3": { w: 111.0, h: 35.64, what: "※ 확인 사항 3줄(공통 — 이어서 안내 포함)" },
  "note.2": { w: 111.0, h: 21.15, what: "※ 확인 사항 2줄(선택)" },
  // 태그 문단 위 끝 → 첫 문항. 그 단의 '위 여백' 이 되어 문항 자리를 정한다.
  "tag.step": { v: 15.92, what: "구획 태그가 단 위에서 먹는 높이" },
};

/** 편집기 원문에서 mm 값을 뽑는다. 못 찾으면 던진다(조용한 통과 금지). */
export function pluck(source, re, label) {
  const hit = source.match(re);
  if (!hit) {
    throw new Error(
      `mock-exam-editor.html 에서 '${label}' 값을 찾지 못했습니다. 코드 모양이 바뀌었다면 `
      + "scripts/exam-style-roles.mjs 의 정규식과 값을 함께 고쳐야 합니다.");
  }
  const nums = hit[1].match(/[\d.]+/g) || [];
  return nums.map(Number);
}
