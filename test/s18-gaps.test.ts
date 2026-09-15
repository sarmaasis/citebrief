import assert from "node:assert/strict";
import { buildCacheKey } from "@/lib/engine-cache";
import { estimateRunCogs, COGS_PER_PROMPT_USD, COGS_WRITER_USD, COGS_PDF_USD } from "@/lib/cogs";
import { planBrandLimit, planAllowsStudioEngines, TRIAL_BRAND_CAP, TRIAL_PROMPT_CAP, TRIAL_RUN_CAP } from "@/lib/billing";

assert.equal(buildCacheKey("chatgpt", " Best CRM "), "chatgpt:best crm");
assert.equal(planBrandLimit("agency"), 5);
assert.equal(planBrandLimit("agency", 2), 7);
assert.equal(planBrandLimit("starter"), 2);
assert.equal(planBrandLimit("studio"), 20);
assert.equal(planAllowsStudioEngines("studio"), true);
assert.equal(planAllowsStudioEngines("agency"), false);
assert.equal(planAllowsStudioEngines("enterprise"), true);
assert.equal(TRIAL_BRAND_CAP, 1);
assert.equal(TRIAL_PROMPT_CAP, 20);
assert.equal(TRIAL_RUN_CAP, 1);

assert.equal(COGS_PER_PROMPT_USD.claude, 0.19);
assert.equal(COGS_PER_PROMPT_USD.chatgpt, 0.008);
assert.equal(COGS_PER_PROMPT_USD.gemini, 0.006);
assert.equal(COGS_PER_PROMPT_USD.grok, 0.001);
assert.ok(COGS_PER_PROMPT_USD.claude > COGS_PER_PROMPT_USD.chatgpt * 10);

const agency = estimateRunCogs({
  runId: "run_agency",
  promptCount: 20,
  engineStates: {
    chatgpt: "complete",
    gemini: "complete",
    grok: "complete",
    aio: "complete",
    claude: "skipped",
  },
});
assert.equal(agency.engines.length, 4);
const agencyUsd = Number(
  (
    20 *
      (COGS_PER_PROMPT_USD.chatgpt +
        COGS_PER_PROMPT_USD.gemini +
        COGS_PER_PROMPT_USD.grok +
        COGS_PER_PROMPT_USD.aio) +
    COGS_WRITER_USD +
    COGS_PDF_USD
  ).toFixed(4),
);
assert.equal(agency.totalUsd, agencyUsd);
assert.ok(agency.totalUsd < 1.5);

const studio = estimateRunCogs({
  runId: "run_studio",
  promptCount: 30,
  engineStates: {
    chatgpt: "complete",
    gemini: "complete",
    grok: "complete",
    aio: "complete",
    claude: "skipped",
  },
});
assert.equal(studio.engines.length, 4);
const studioUsd = Number(
  (
    30 *
      (COGS_PER_PROMPT_USD.chatgpt +
        COGS_PER_PROMPT_USD.gemini +
        COGS_PER_PROMPT_USD.grok +
        COGS_PER_PROMPT_USD.aio) +
    COGS_WRITER_USD +
    COGS_PDF_USD
  ).toFixed(4),
);
assert.equal(studio.totalUsd, studioUsd);
assert.ok(studio.totalUsd < 2);

console.log("s18-gaps.test.ts ok");
