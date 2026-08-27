import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (path) => readFile(new URL(path, root), "utf8");
const exists = async (path) => stat(new URL(path, root)).then(() => true, () => false);

const [index, worker, rules, storageRules, config] = await Promise.all([
  text("index.html"),
  text("worker/index.js"),
  text("firestore.rules"),
  text("storage.rules"),
  text("service-config.js"),
]);

assert.match(index, /firebase-app-check-compat\.js/, "Firebase App Check SDK가 로드돼야 합니다");
assert.match(index, /purgeAiUsage\(user\)/, "계정 삭제 때 AI 사용 기록도 지워야 합니다");
assert.match(worker, /async alarm\(\)/, "AI quota는 자동 파기 alarm이 필요합니다");
assert.match(worker, /QUOTA_RETENTION_MS/, "AI quota 보존 기간 상수가 필요합니다");
assert.match(worker, /MAX_DAILY_LIMIT/, "AI 비용을 위한 절대 일일 상한이 필요합니다");
assert.match(worker, /await quotaKey\(uid/, "Worker 저장소 이름에 UID 원문을 쓰면 안 됩니다");
assert.match(worker, /"consume"/, "외부 AI 호출 전 quota 확정이 필요합니다");
assert.doesNotMatch(worker, /detail:\s*String/, "내부 오류 원문을 클라이언트에 반환하면 안 됩니다");
assert.match(rules, /problems\.size\(\) <= 20000/, "Firestore 문제 수 상한이 필요합니다");
assert.match(rules, /affectedKeys\(\)/, "구형 sets 배열 쓰기는 막아야 합니다");
assert.match(storageRules, /image\/\(jpeg\|png\|webp\|gif\)/, "Storage MIME allowlist가 필요합니다");
assert.match(storageRules, /match \/users\/\{uid\}\/images\/\{imageId\}/,
  "Storage 이미지는 한 단계 경로로만 허용해야 합니다");
assert.match(index, /getIdTokenResult\(\)/, "플랜 표시는 서명된 Firebase claim에서 읽어야 합니다");
assert.doesNotMatch(config, /^\s*(anthropicKey|pgSecret|webhookSecret|serviceAccount|privateKey)\s*:/im,
  "공개 설정 파일에 비밀값을 넣으면 안 됩니다");
assert.equal(await exists("worker/worker-single-file.js"), false,
  "운영 Worker는 Wrangler 단일 진입점만 유지해야 합니다");

console.log("Commercial static checks passed");
