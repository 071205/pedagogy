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
      assert.equal(set.problems[0].blocks.find((b) => b.type === "passage")?.data?.parts?.length, 2,
        "복합 지문 조각 수가 기준값과 달라졌습니다");
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
