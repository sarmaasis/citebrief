import assert from "node:assert/strict";
import { AiGatewayError, assertGatewayRunBudget, gatewayRunCallCount, resetGatewayRunBudget } from "@/lib/ai-gateway";
import {
  DEFAULT_ENGINE_STRING,
  TRIAL_DEFAULT_ENGINE_STRING,
  defaultEngineStringForPlan,
  enginesForRun,
  parseRequestedEngines,
  selectableEngineIds,
  validateDefaultEngines,
} from "@/lib/plan-engines";
import {
  AGENCY_ENGINE_IDS,
  SOFT_FAIL_MIN_CORE,
  STUDIO_ENGINE_IDS,
  TRIAL_ENGINE_IDS,
  TRIAL_MAX_GATEWAY_REQUESTS,
  scheduledEngineStatus,
  softFailMinCore,
} from "@/lib/engines";

assert.deepEqual(TRIAL_ENGINE_IDS, ["chatgpt", "gemini"]);
assert.deepEqual(AGENCY_ENGINE_IDS, ["chatgpt", "gemini", "grok", "aio"]);
assert.deepEqual(STUDIO_ENGINE_IDS, ["chatgpt", "gemini", "grok", "aio"]);
assert.equal(TRIAL_MAX_GATEWAY_REQUESTS, 15);
assert.ok(TRIAL_MAX_GATEWAY_REQUESTS >= 5 * TRIAL_ENGINE_IDS.length);

assert.deepEqual(selectableEngineIds({ paid: false }), ["chatgpt", "gemini"]);
assert.deepEqual(selectableEngineIds({ paid: true }), ["chatgpt", "gemini", "grok", "aio"]);
assert.deepEqual(selectableEngineIds({ paid: true, allowsStudioEngines: true }), [
  "chatgpt",
  "gemini",
  "grok",
  "aio",
]);
assert.equal(defaultEngineStringForPlan({ paid: false }), TRIAL_DEFAULT_ENGINE_STRING);
assert.equal(defaultEngineStringForPlan({ paid: true }), DEFAULT_ENGINE_STRING);

const trialValidated = validateDefaultEngines("chatgpt,gemini,grok,aio,claude", { paid: false });
assert.equal(trialValidated.ok, true);
if (trialValidated.ok) {
  assert.equal(trialValidated.normalized, "chatgpt,gemini");
}

const paidValidated = validateDefaultEngines("chatgpt,gemini,claude,grok", {
  paid: true,
  allowsStudioEngines: false,
});
assert.equal(paidValidated.ok, true);
if (paidValidated.ok) {
  assert.equal(paidValidated.normalized, "chatgpt,gemini,grok");
}

const requested = parseRequestedEngines(DEFAULT_ENGINE_STRING);
const trial = enginesForRun({ requested, paid: false });
assert.deepEqual(
  trial.map((engine) => engine.id),
  ["chatgpt", "gemini"],
);

const agency = enginesForRun({ requested: parseRequestedEngines("chatgpt,gemini,claude,grok,aio"), paid: true });
assert.deepEqual(
  agency.map((engine) => engine.id),
  ["chatgpt", "gemini", "grok", "aio"],
);
assert.ok(!agency.some((engine) => engine.id === "claude"));

const studio = enginesForRun({
  requested: parseRequestedEngines("chatgpt,gemini,claude,grok,aio"),
  paid: true,
  allowsStudioEngines: true,
});
assert.deepEqual(
  studio.map((engine) => engine.id),
  ["chatgpt", "gemini", "grok", "aio"],
);
assert.ok(!studio.some((engine) => engine.id === "claude"));

const studioDefault = enginesForRun({
  requested: [],
  paid: true,
  allowsStudioEngines: true,
});
assert.deepEqual(
  studioDefault.map((engine) => engine.id),
  STUDIO_ENGINE_IDS,
);
assert.ok(studioDefault.some((engine) => engine.id === "grok"));

const grokOnly = enginesForRun({ requested: ["grok", "aio"], paid: false });
assert.deepEqual(
  grokOnly.map((engine) => engine.id),
  ["chatgpt", "gemini"],
);

assert.equal(softFailMinCore(2), 2);
assert.equal(softFailMinCore(4), 3);
assert.equal(softFailMinCore(5), SOFT_FAIL_MIN_CORE);
assert.equal(softFailMinCore(1), 1);
assert.equal(softFailMinCore(3), 2);

const trialStates = scheduledEngineStatus(trial.map((engine) => engine.id));
assert.equal(trialStates.chatgpt, "queued");
assert.equal(trialStates.gemini, "queued");
assert.equal(trialStates.claude, "skipped");
assert.equal(trialStates.grok, "skipped");
assert.equal(trialStates.aio, "skipped");

const agencyStates = scheduledEngineStatus(agency.map((engine) => engine.id));
assert.equal(agencyStates.claude, "skipped");
assert.equal(agencyStates.grok, "queued");

const trialCalls = 5 * trial.length;
assert.ok(trialCalls <= TRIAL_MAX_GATEWAY_REQUESTS);

async function assertTrialGatewayBudget() {
  resetGatewayRunBudget("trial-cap");
  for (let i = 0; i < TRIAL_MAX_GATEWAY_REQUESTS; i += 1) {
    await assertGatewayRunBudget("trial-cap", TRIAL_MAX_GATEWAY_REQUESTS);
  }
  assert.equal(gatewayRunCallCount("trial-cap"), TRIAL_MAX_GATEWAY_REQUESTS);
  await assert.rejects(
    () => assertGatewayRunBudget("trial-cap", TRIAL_MAX_GATEWAY_REQUESTS),
    (error: unknown) => error instanceof AiGatewayError && error.status === 429,
  );
  assert.equal(gatewayRunCallCount("trial-cap"), TRIAL_MAX_GATEWAY_REQUESTS);
  console.log("trial-run.test.ts ok");
}

void assertTrialGatewayBudget();
