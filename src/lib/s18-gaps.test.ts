import assert from "node:assert/strict";
import { buildCacheKey } from "./engine-cache";
import { estimateRunCogs } from "./cogs";
import { planBrandLimit, planAllowsStudioEngines, TRIAL_BRAND_CAP, TRIAL_RUN_CAP } from "./billing";

assert.equal(buildCacheKey("chatgpt", " Best CRM "), "chatgpt:best crm");
assert.equal(planBrandLimit("agency", 2), 10);
assert.equal(planAllowsStudioEngines("studio"), true);
assert.equal(planAllowsStudioEngines("agency"), false);
assert.equal(TRIAL_BRAND_CAP, 1);
assert.equal(TRIAL_RUN_CAP, 1);

const cogs = estimateRunCogs({
  runId: "run_1",
  promptCount: 20,
  engineStates: { chatgpt: "complete", perplexity: "complete", gemini: "complete", aio: "failed" },
});
assert.ok(cogs.totalUsd > 0);
assert.equal(cogs.engines.length, 4);

console.log("s18-gaps.test.ts ok");
