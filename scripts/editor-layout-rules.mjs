/* 편집기의 '선지 배치' 규칙 지문 — 베타(HWPX 내보내기)
 *
 * `experiments/hwp-export/samples/choice-layout-truth.json` 은 **진짜 편집기를 띄워
 * 받아 적은 답**이다. 파이썬 변환기(`layout_of`)가 그 답과 같은지를 `test_layout.py`
 * 가 검사한다. 그런데 편집기 쪽 규칙이 바뀌면 그 정답표는 조용히 낡고, 검사는
 * **낡은 표를 상대로 계속 초록불**이 된다 — 이 저장소가 세 번 겪은 실패 방식이다.
 *
 * 그래서 정답표에 '어떤 규칙에서 잰 값인가' 를 지문으로 함께 적어 둔다.
 * 규칙이 바뀌면 `check-static.mjs` 가 빨간불을 내고, 다시 재라고 알려 준다.
 *
 * ⚠️ 브라우저로 실제 폭을 재는 대조(`check-hwpx-parity.mjs`)를 CI 에 걸지 않은 이유:
 *    `measureCh()` 는 **글꼴 실측**이라 CI 리눅스와 이 컴퓨터의 값이 조금씩 다르다.
 *    임계값에 1mm 차로 붙어 있는 선지가 있어(문항 28의 마지막 선지 21.2 vs 한도 22.2)
 *    쉽게 깜빡이는 검사가 된다. 깜빡이는 검사는 없느니만 못하다. 대신 지문으로
 *    '정답표가 낡았다' 를 잡고, 실제 재기는 사람이 규칙을 바꿀 때 돌린다.
 */
import { createHash } from "node:crypto";

/** 선지 배치를 결정하는 편집기 쪽 조각들. 하나라도 바뀌면 정답표를 다시 재야 한다. */
export const RULE_PATTERNS = [
  ["SPEC", /const SPEC=\{[^}]*\};/],
  ["measureCh", /function measureCh\(ch\)\{[\s\S]*?\n\}/],
  ["layoutOf", /function layoutOf\(p\)\{[\s\S]*?\n\}/],
  ["hasGND", /function hasGND\(ch\)\{.*?\}/],
  ["choiceItems", /function choiceItems\(p\)\{[\s\S]*?\n\}/],
];

/** 편집기 원문에서 규칙 조각을 뽑는다. 하나라도 못 찾으면 던진다(조용한 통과 금지). */
export function extractRules(editorSource) {
  return RULE_PATTERNS.map(([name, re]) => {
    const hit = editorSource.match(re);
    if (!hit) {
      throw new Error(
        `mock-exam-editor.html 에서 '${name}' 를 찾지 못했습니다. `
        + "선지 배치 규칙의 모양이 바뀌었다면 scripts/editor-layout-rules.mjs 의 "
        + "패턴과 정답표를 함께 고쳐야 합니다.");
    }
    // 들여쓰기·줄바꿈만 바뀐 것으로 지문이 흔들리지 않게 공백은 접는다.
    return `${name}:${hit[0].replace(/\s+/g, " ").trim()}`;
  }).join("\n");
}

export function fingerprint(editorSource) {
  return "sha256:" + createHash("sha256").update(extractRules(editorSource)).digest("hex").slice(0, 32);
}
