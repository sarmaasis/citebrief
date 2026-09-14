import assert from "node:assert/strict";
import { isAiGatewayConfigured, promptHash } from "@/lib/ai-gateway";
import {
  EXTRA_BRAND_USD,
  EXTRA_RUN_USD,
  PLANS,
  planAllowsClientCc,
  planAllowsBulkSend,
  planAllowsCommandCenter,
  planAllowsCustomSender,
  planAllowsEmailSend,
  planAllowsStudioEngines,
  planAllowsWeeklyCadence,
  planHardStop,
  planIncludedRunCap,
  planManualRerunCap,
  planMonthlyRecheckCredits,
  planSeatCap,
} from "@/lib/billing";
import { isEngineApiConfigured, usesDeterministicStub } from "@/lib/engine-adapters";

assert.equal(PLANS.starter.amountUsd, 99);
assert.equal(PLANS.agency.amountUsd, 249);
assert.equal(PLANS.studio.amountUsd, 799);
assert.equal(PLANS.enterprise.amountUsd, 1499);
assert.equal(PLANS.starter.brands, 2);
assert.equal(PLANS.agency.brands, 10);
assert.equal(PLANS.studio.brands, 25);
assert.equal(PLANS.starter.seats, 1);
assert.equal(PLANS.agency.seats, 3);
assert.equal(PLANS.studio.seats, 10);
assert.equal(planSeatCap("agency"), 3);
assert.equal(planSeatCap("studio"), 10);
assert.equal(planSeatCap("starter"), 1);

assert.equal(EXTRA_BRAND_USD.agency, 29);
assert.equal(EXTRA_BRAND_USD.studio, 29);
assert.equal(EXTRA_BRAND_USD.enterprise, 29);
assert.equal(EXTRA_RUN_USD.agency, 9);
assert.equal(EXTRA_RUN_USD.studio, 9);
assert.equal(PLANS.agency.manualRerunsPerBrandPerWeek, 0);
assert.equal(PLANS.agency.includedRunsPerBrandPerWeek, 1);
assert.equal(planManualRerunCap("agency"), 0);
assert.equal(planMonthlyRecheckCredits("agency"), 10);
assert.equal(planIncludedRunCap("agency"), 1);
assert.equal(planHardStop("agency"), 3);
assert.equal(PLANS.starter.manualRerunsPerBrandPerWeek, 1);
assert.equal(planMonthlyRecheckCredits("starter"), 2);
assert.equal(planIncludedRunCap("starter"), 2);
assert.equal(PLANS.studio.manualRerunsPerBrandPerWeek, 2);
assert.equal(planMonthlyRecheckCredits("studio"), 100);
assert.equal(planIncludedRunCap("studio"), 3);
assert.equal(planHardStop("studio"), 9);

assert.equal(planAllowsWeeklyCadence("starter"), false);
assert.equal(planAllowsWeeklyCadence("agency"), true);
assert.equal(planAllowsClientCc("starter"), false);
assert.equal(planAllowsClientCc("agency"), true);
assert.equal(planAllowsEmailSend("starter"), false);
assert.equal(planAllowsEmailSend("agency"), true);
assert.equal(planAllowsEmailSend("studio"), true);
assert.equal(planAllowsEmailSend("enterprise"), true);
assert.equal(planAllowsCustomSender("agency"), false);
assert.equal(planAllowsCustomSender("studio"), true);
assert.equal(planAllowsCustomSender("enterprise"), true);
assert.equal(planAllowsStudioEngines("agency"), false);
assert.equal(planAllowsStudioEngines("enterprise"), true);
assert.equal(planAllowsBulkSend("agency"), false);
assert.equal(planAllowsBulkSend("studio"), true);
assert.equal(planAllowsCommandCenter("starter"), false);
assert.equal(planAllowsCommandCenter("agency"), true);
assert.equal(planAllowsCommandCenter("studio"), true);

// Stub gateway detection
assert.equal(isAiGatewayConfigured(undefined), false);
assert.equal(
  isAiGatewayConfigured({
    CF_ACCOUNT_ID: "stub",
    AI_GATEWAY_ID: "stub",
    CF_AI_GATEWAY_TOKEN: "stub",
  } as CloudflareEnv),
  false,
);
assert.equal(
  isAiGatewayConfigured({
    CF_ACCOUNT_ID: "",
    AI_GATEWAY_ID: "gw",
    CF_AI_GATEWAY_TOKEN: "tok",
  } as CloudflareEnv),
  false,
);

const prevAccount = process.env.CF_ACCOUNT_ID;
const prevGw = process.env.AI_GATEWAY_ID;
const prevTok = process.env.CF_AI_GATEWAY_TOKEN;
process.env.CF_ACCOUNT_ID = "acct_live";
process.env.AI_GATEWAY_ID = "gw_live";
process.env.CF_AI_GATEWAY_TOKEN = "tok_live";
assert.equal(isAiGatewayConfigured(undefined), true);
assert.equal(isEngineApiConfigured("chatgpt", undefined), true);
assert.equal(isEngineApiConfigured("aio", undefined), false);
assert.equal(usesDeterministicStub("chatgpt", undefined), false);
assert.equal(usesDeterministicStub("aio", undefined), true);
if (prevAccount === undefined) delete process.env.CF_ACCOUNT_ID;
else process.env.CF_ACCOUNT_ID = prevAccount;
if (prevGw === undefined) delete process.env.AI_GATEWAY_ID;
else process.env.AI_GATEWAY_ID = prevGw;
if (prevTok === undefined) delete process.env.CF_AI_GATEWAY_TOKEN;
else process.env.CF_AI_GATEWAY_TOKEN = prevTok;

assert.ok(promptHash("best crm for agencies").length > 0);
assert.notEqual(promptHash("a"), promptHash("b"));

// Seat cap math used by invite POST: occupied >= cap → 403
function wouldRejectInvite(members: number, pending: number, plan: string) {
  return members + pending >= planSeatCap(plan);
}
assert.equal(planSeatCap("agency", 1), 4);
assert.equal(wouldRejectInvite(3, 0, "agency"), true);
assert.equal(wouldRejectInvite(2, 0, "agency"), false);
assert.equal(wouldRejectInvite(2, 1, "agency"), true);
assert.equal(wouldRejectInvite(10, 0, "studio"), true);
assert.equal(wouldRejectInvite(9, 0, "studio"), false);

// seatsUsed mirrors invite POST occupancy: members + pending invites
function seatsUsed(members: number, pending: number) {
  return members + pending;
}
assert.equal(seatsUsed(2, 1), 3);
assert.equal(seatsUsed(3, 0), 3);
assert.equal(seatsUsed(1, 0), 1);

console.log("prd-v22.test.ts ok");
