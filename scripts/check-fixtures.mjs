import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

const specs = [
  {
    path: "test-fixtures/refactor-baseline/01-math-formulas.json",
    subject: "math",
    problems: 2,
    types: ["statement", "conditions", "boxed", "choices"],
    validate(set) {
      const text = set.problems.flatMap((p) => p.blocks)
        .map((b) => b.data?.text).filter((value) => typeof value === "string").join("\n");
      assert.match(text, /\\frac/, "수학 기준 샘플에 분수 수식이 필요합니다");
      assert.ok(!text.includes("\\\\frac"), "기준 수식은 JSON 이스케이프가 두 번 되면 안 됩니다");
      assert.ok(set.problems.some((p) => p.span === "page"), "한 쪽 문항 샘플이 필요합니다");
    },
  },
  {
    path: "test-fixtures/refactor-baseline/02-korean-passage.json",
    subject: "korean",
    problems: 2,
    types: ["passage", "bogi", "dialogue", "table"],
    validate(set) {
      assert.equal(set.problems[0].groupSpan, 2, "공유 지문 문항 수가 기준값과 달라졌습니다");
      const psg = set.problems[0].blocks.find((b) => b.type === "passage")?.data;
      assert.equal(psg?.parts?.length, 2, "복합 지문 조각 수가 기준값과 달라졌습니다");
      /* ⚠️ 앞뒤 `–`(출처) · `*`(각주) · `[N~M]`(범위)는 **렌더가 붙인다**(CLAUDE.md).
         입력에도 적으면 `– - 기준 지문 - –` `* * 구성:` `[01~02] [1~2]` 처럼 두 번 나온다.
         실제로 그렇게 적혀 있었고, 기준 시각본이 그 잘못된 모습을 박제하고 있었다. */
      assert.doesNotMatch(psg.lead, /\[\s*\d+\s*[~～]/, "범위는 렌더가 붙입니다 — lead 에 적지 마세요");
      for (const part of psg.parts) {
        assert.doesNotMatch(part.source || "", /^\s*[-–—]/, "출처의 앞 대시는 렌더가 붙입니다");
        assert.doesNotMatch(part.notes || "", /^\s*\*/, "각주의 * 는 렌더가 붙입니다");
        /* 운문의 줄바꿈이 문자 그대로의 \n 이면 시가 한 줄로 붙는다(실제로 그랬다). */
        assert.doesNotMatch(part.text || "", /\\n/, "줄바꿈은 진짜 개행이어야 합니다");
      }
    },
  },
  {
    path: "test-fixtures/refactor-baseline/03-image-storage.json",
    subject: "inquiry",
    problems: 1,
    types: ["image", "statement", "choices"],
    validate(set) {
      const problem = set.problems[0];
      assert.match(problem.answerImg, /^data:image\/png;base64,/);
      assert.match(problem.blocks.find((b) => b.type === "image")?.data?.dataUrl || "", /^data:image\/png;base64,/);
    },
  },
  {
    path: "test-fixtures/refactor-baseline/04-print-overflow.json",
    subject: "all",
    problems: 1,
    types: ["statement", "boxed", "conditions", "choices"],
    validate(set) {
      assert.equal(set.problems[0].span, "page", "긴 인쇄 기준 문항은 한 쪽 배치여야 합니다");
      assert.equal(set.problems[0].blocks.find((b) => b.type === "choices")?.data?.layout, "vertical");
    },
  },
  {
    /* 영어 조판 규칙(무테 지문 · 각주 우측 정렬 한 줄 · 2열 선지 · (A)(B)(C) 인라인
       라벨 + 행잡기 · 듣기 답란 밑줄 · 지문 없는 묶음 안내)이 한 쪽에 모두 들어간 표본이다.
       ⚠️ 라벨 셋과 빈 대화 줄을 지우지 말 것 — 시각 회귀가 이 표본으로 그 조판을 지킨다.
          특히 답란 밑줄은 CSS 가 그리므로 마크업만 보는 검사로는 사라진 것을 못 잡는다. */
    path: "test-fixtures/refactor-baseline/05-english-order.json",
    subject: "english",
    problems: 3,
    types: ["passage", "choices", "dialogue"],
    validate(set) {
      const parts = set.problems[0].blocks.find((b) => b.type === "passage")?.data?.parts || [];
      assert.equal(parts.length, 4, "주어진 글 + (A)(B)(C) 네 조각이어야 합니다");
      assert.deepEqual(parts.map((p) => p.label), ["", "(A)", "(B)", "(C)"],
        "순서 문항 라벨이 기준값과 달라졌습니다");
      assert.equal(set.problems[0].blocks.find((b) => b.type === "choices")?.data?.layout, "cols2",
        "영어 순서 문항의 선지는 실물처럼 2열입니다");
      const talk = set.problems[1].blocks.find((b) => b.type === "dialogue")?.data?.items || [];
      assert.equal(talk.length, 1, "듣기 답란은 말한이 한 줄입니다");
      assert.equal(talk[0].text, "", "말한 내용이 비어야 답란(밑줄)이 됩니다");
      assert.ok(talk[0].who, "누가 답하는지는 남아야 합니다");
      /* 지문 없는 묶음 안내 — 안내 글이 있어야 묶음으로 세므로 둘 다 있어야 한다. */
      assert.equal(set.problems[1].groupSpan, 2, "듣기 두 문항이 한 묶음이어야 합니다");
      assert.ok(set.problems[1].groupLead, "지문 없는 묶음은 안내 글이 있어야 그려집니다");
      assert.ok(!set.problems[1].blocks.some((b) => b.type === "passage"),
        "이 묶음은 지문이 없어야 grp-head 경로를 지킵니다");
    },
  },
  {
    /* 안내문 상자 — 실물 영어 27·28번 형식. 다섯 갈래(제목·문단·소제목·∙항목·※줄)가
       한 상자에 다 들어간 표본이다. 시각 회귀가 이걸로 안내문 조판을 지킨다.
       ⚠️ 그림은 첫 쪽만 찍으므로 문항을 늘려 뒤쪽으로 밀지 말 것. */
    path: "test-fixtures/refactor-baseline/06-english-notice.json",
    subject: "english",
    problems: 1,
    types: ["notice", "choices"],
    validate(set) {
      const ntc = set.problems[0].blocks.find((b) => b.type === "notice")?.data;
      assert.ok(ntc?.title, "안내문 상자에는 제목이 있어야 합니다");
      const kinds = new Set((ntc.items || []).map((i) => i.kind));
      for (const k of ["text", "head", "bullet", "note"]) {
        assert.ok(kinds.has(k), `안내문 표본에 ${k} 줄이 빠졌습니다`);
      }
      /* ⚠️ ∙ 와 ※ 는 렌더가 붙인다 — 입력에 적으면 두 번 나온다
         (02-korean-passage 의 `* *` · `– – … – –` 와 같은 실수). */
      for (const it of ntc.items) {
        assert.doesNotMatch(it.text || "", /^\s*[∙•※]/, "∙ 와 ※ 는 렌더가 붙입니다");
      }
    },
  },
  {
    /* 그림 선지 — 교과서의 그래프 이동 문항처럼 선지 자체가 그림인 형식.
       시각 회귀가 이걸로 3+2 배치와 '라벨은 그림 위' 를 지킨다.
       ⚠️ 그림은 첫 쪽만 찍으므로 문항을 늘려 뒤쪽으로 밀지 말 것. */
    path: "test-fixtures/refactor-baseline/07-math-image-choices.json",
    subject: "math",
    problems: 1,
    types: ["statement", "choices"],
    validate(set) {
      const ch = set.problems[0].blocks.find((b) => b.type === "choices")?.data;
      assert.equal(ch?.layout, "cols3", "3+2 는 3열이 만든다 — 배치가 달라졌습니다");
      assert.equal(ch.items.length, 5, "선지는 다섯입니다");
      assert.equal(ch.images.length, 5, "그림 배열은 선지와 **같은 길이**여야 합니다");
      assert.ok(ch.items.every((t) => typeof t === "string"),
        "items 는 문자열 배열로 둡니다 — 객체로 바꾸면 convertBlock 이 터집니다");
      for (const u of ch.images) assert.match(u, /^data:image\/png;base64,/);
    },
  },
];

for (const spec of specs) {
  const set = await readJson(spec.path);
  assert.equal(set.subject, spec.subject, spec.path + ": 과목이 달라졌습니다");
  assert.ok(Array.isArray(set.problems), spec.path + ": problems 배열이 필요합니다");
  assert.equal(set.problems.length, spec.problems, spec.path + ": 문항 수가 달라졌습니다");
  const types = new Set(set.problems.flatMap((problem) => problem.blocks || []).map((block) => block.type));
  spec.types.forEach((type) => assert.ok(types.has(type), spec.path + ": " + type + " 블록이 필요합니다"));
  spec.validate(set);
}

console.log("Reference fixture checks passed (" + specs.length + " sets)");
