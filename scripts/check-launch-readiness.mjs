import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (path) => readFile(new URL(path, root), "utf8");
const [config, legal, workerConfig] = await Promise.all([
  text("service-config.js"),
  text("legal.html"),
  text("worker/wrangler.toml"),
]);

const blockers = [];
if (/appCheckSiteKey:\s*""/.test(config)) blockers.push("Firebase App Check site key가 비어 있습니다.");
if (/supportEmail:\s*""/.test(config)) blockers.push("공개 고객지원 이메일이 비어 있습니다.");
if (/legalVersion:\s*""/.test(config)) blockers.push("약관·개인정보처리방침 버전이 비어 있습니다.");
if (/billingPortalUrl:\s*""/.test(config)) blockers.push("결제/구독 관리 포털이 연결되지 않았습니다.");
if (/<span class="todo">/.test(legal)) blockers.push("legal.html에 운영자·수탁자 정보 TODO가 남아 있습니다.");
if (!/PLAN_DAILY_LIMITS_JSON/.test(workerConfig)) blockers.push("유료 플랜별 AI 상한 설정이 없습니다.");
if (/http:\/\/127\.0\.0\.1|http:\/\/localhost/.test(workerConfig)) {
  blockers.push("운영 Worker 허용 출처에 localhost가 남아 있습니다. staging/production Worker를 분리하세요.");
}

if (blockers.length) {
  console.error("상용 출시 차단 항목:");
  blockers.forEach((item) => console.error(`- ${item}`));
  process.exitCode = 1;
} else {
  console.log("상용 출시 게이트 통과");
}
