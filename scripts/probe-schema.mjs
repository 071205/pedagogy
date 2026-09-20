/* 실험 — 지금 안 쓰고 있는 장치 셋을 켜면 형식이 잡히는가.
 *   ① responseSchema (구조 강제)  ② 계약의 빈 칸 다섯을 프롬프트에 넣기  ③ 갈래 판별 규칙 명시
 * ⚠️ 제품 파일(worker/*)은 건드리지 않는다. 여기서 재고 값이 서면 그때 설계한다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const REPO = process.env.PEDAGOGY_ROOT || "/Users/huryul/pedagogy-main";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const t = a.replace(/^--/, ""); const i = t.indexOf("=");
  return i < 0 ? [t, true] : [t.slice(0, i), t.slice(i + 1)];
}));
const MODEL = args.model || "gemini-3.1-flash-lite";
const IMAGE = args.image || "test-fixtures/visual-baseline/darwin/math-print.png";

const key = readFileSync(process.env.GEMINI_KEY_FILE.replace(/^~/, process.env.HOME), "utf8").trim();

/* ② + ③ — 빈 칸 다섯(정답·지문·각주·출처·묶음안내)을 넣고, 갈래를 무엇으로 가르는지 말해 준다. */
const SYSTEM = `너는 한국 문제집 편집기의 입력 도우미다.
이미지에 든 문제를 **화면에 보이는 그대로** 구조화한다. 없는 것을 지어내지 않는다.

수식은 전부 LaTeX 로 쓰고 $...$(인라인) 또는 $$...$$(별행)로 감싼다.
⚠️ 선지가 숫자 하나뿐이어도 수식이다 — "0" 이 아니라 "$0$" 로 쓴다.
⚠️ 별행으로 가운데 놓인 수식은 $$...$$ 로 감싼다.
⚠️ 적분·시그마·극한이 인라인에 있으면 \\displaystyle 을 붙인다.

블록 갈래는 **테두리와 라벨로** 가른다:
- statement : 테두리 없이 본문으로 흐르는 글. 발문 다음에 이어지는 식·조건도 여기다.
- conditions: **테두리 상자** 안에 (가)(나)(다) 로 나열된 것.
- examples  : **테두리 상자** 안에 ㄱ. ㄴ. ㄷ. 로 나열된 것(<보기>).
- boxed     : **테두리 상자** 안에 라벨 없이 든 것(주로 별행 수식 하나).
- passage   : 여러 문단짜리 지문. 출처(– 이름, 「제목」 –)는 source 에, 각주(* 낱말: 뜻)는 notes 에.
- choices   : ①②③④⑤ 선지. 정확히 5개.

라벨 기호((가),①,ㄱ. 등)는 items 에 적지 않는다. 내용만 적는다.
화면에 '정답: ③' 처럼 답이 보이면 answer 에 적는다. 안 보이면 비운다.
'[02~03] 다음을 듣고…' 처럼 여러 문항이 함께 쓰는 안내문은 groupLead 에 적는다.`;

/* ① responseSchema — 구조를 모델이 지어내지 못하게 못박는다. */
const BLOCK = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["statement", "passage", "conditions", "examples", "boxed", "choices"] },
    text: { type: "string", description: "statement·boxed·passage 의 본문" },
    items: { type: "array", items: { type: "string" }, description: "conditions·examples·choices 의 항목" },
    label: { type: "string", description: "상자 제목(<보기> 등). 없으면 비움" },
    source: { type: "string", description: "passage 의 출처. 앞뒤 – 는 빼고" },
    notes: { type: "array", items: { type: "string" }, description: "passage 의 각주. 앞의 * 는 빼고" },
  },
  required: ["type"],
  propertyOrdering: ["type", "text", "items", "label", "source", "notes"],
};
const SCHEMA = {
  type: "object",
  properties: {
    problems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          numLabel: { type: "string", description: "화면의 문항 번호" },
          desc: { type: "string", description: "발문" },
          answer: { type: "string", description: "화면에 보이는 정답. 없으면 비움" },
          groupLead: { type: "string", description: "여러 문항이 함께 쓰는 안내문. 없으면 비움" },
          blocks: { type: "array", items: BLOCK },
        },
        required: ["blocks"],
        propertyOrdering: ["numLabel", "desc", "answer", "groupLead", "blocks"],
      },
    },
  },
  required: ["problems"],
  propertyOrdering: ["problems"],
};

const bytes = readFileSync(`${REPO}/${IMAGE}`);
const body = {
  systemInstruction: { parts: [{ text: SYSTEM }] },
  contents: [{ role: "user", parts: [
    { text: "이 이미지의 문제를 구조화해 줘." },
    { inlineData: { mimeType: "image/png", data: bytes.toString("base64") } },
  ] }],
  generationConfig: {
    candidateCount: 1,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseSchema: SCHEMA,
    thinkingConfig: { thinkingLevel: "low", includeThoughts: false },
  },
};

const t0 = Date.now();
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-goog-api-key": key },
  body: JSON.stringify(body),
  redirect: "manual",
});
const ms = Date.now() - t0;
const data = await res.json().catch(() => null);
console.log(`[스키마 강제] 모델 ${MODEL} · ${IMAGE.split("/").pop()} · HTTP ${res.status} · ${ms}ms`);
if (!res.ok) { console.error("거절:", data?.error?.status, "-", String(data?.error?.message || "").slice(0, 200)); process.exit(2); }
const u = data.usageMetadata || {};
console.log(`토큰 입력 ${u.promptTokenCount} · 출력 ${u.candidatesTokenCount} · 사고 ${u.thoughtsTokenCount ?? 0}`);
console.log(JSON.stringify(JSON.parse(data.candidates[0].content.parts.map((p) => p.text || "").join("")), null, 2));
