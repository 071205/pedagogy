/* Gemini request/response shaping only. This module has no secrets, network, logs,
 * Firebase, or Durable Object dependencies so it remains testable without a key. */

export const GEMINI_STAGING_MODEL = "gemini-3.1-flash-lite";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function buildGeminiRequest({ system, parts }) {
  if (typeof system !== "string" || !system || !Array.isArray(parts) || !parts.length) {
    throw new TypeError("Gemini 요청 형식이 올바르지 않습니다");
  }
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      candidateCount: 1,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      // Gemini 3 takes a level, and the level set differs from Gemini 2.5's.
      // ⚠️ "minimal" belongs to 2.5 (and, as an exception, 3.6-flash). Sending it to
      //    gemini-3.1-flash-lite returned HTTP 400 with no tokens consumed — measured
      //    2026-09-19, and it cost two approved staging calls to see. Gemini 3 takes
      //    low / medium / high, so "low" is the least thinking this model will accept.
      //    A level can still consume thinking tokens; keep reporting actual usage
      //    rather than treating this as a zero-token mode.
      thinkingConfig: { thinkingLevel: "low", includeThoughts: false },
    },
  };
}

export function decodeGeminiEnvelope(data) {
  if (!isRecord(data)) return { invalid: true };
  const usage = isRecord(data.usageMetadata) ? data.usageMetadata : {};
  const base = {
    model: data.modelVersion,
    inputTokens: usage.promptTokenCount,
    outputTokens: usage.candidatesTokenCount,
    thinkingTokens: usage.thoughtsTokenCount ?? null,
  };
  const promptBlock = isRecord(data.promptFeedback) && data.promptFeedback.blockReason;
  if (promptBlock) return { ...base, blocked: true, finishReason: String(promptBlock) };

  if (!Array.isArray(data.candidates) || data.candidates.length !== 1 || !isRecord(data.candidates[0])) {
    return { ...base, invalid: true };
  }
  const candidate = data.candidates[0];
  if (!isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) return { ...base, invalid: true };
  const text = [];
  for (const part of candidate.content.parts) {
    if (!isRecord(part)) return { ...base, invalid: true };
    if (part.thought === true) continue;
    if (typeof part.text !== "string") return { ...base, invalid: true };
    text.push(part.text);
  }
  const joined = text.join("");
  if (!joined.trim()) return { ...base, invalid: true };
  return { ...base, text: joined, finishReason: candidate.finishReason == null ? null : String(candidate.finishReason), blocked: false };
}
