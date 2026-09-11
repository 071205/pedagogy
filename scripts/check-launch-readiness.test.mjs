import assert from "node:assert/strict";
import { collectLaunchBlockers } from "./check-launch-readiness.mjs";

const base = {
  config: 'appCheckSiteKey: "configured"\nsupportEmail: "support@example.test"\nlegalVersion: "v1"\nbillingPortalUrl: "https://billing.example.test"',
  legal: "<main>ready</main>",
};
const missingPlan = "유료 플랜별 AI 상한 설정이 없습니다.";

assert.ok(
  collectLaunchBlockers({ ...base, workerConfig: "# PLAN_DAILY_LIMITS_JSON = '{}'" }).includes(missingPlan),
  "주석의 PLAN_DAILY_LIMITS_JSON을 실제 운영 설정으로 인정하면 안 됩니다",
);
assert.ok(
  !collectLaunchBlockers({ ...base, workerConfig: "PLAN_DAILY_LIMITS_JSON = '{}'" }).includes(missingPlan),
  "실제 TOML 대입은 유료 플랜 상한 설정으로 인정해야 합니다",
);

console.log("상용 출시 게이트 설정 검사 통과");
