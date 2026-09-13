import assert from "node:assert/strict";
import { isAiGatewayConfigured, promptHash } from "./ai-gateway";
import {
  EXTRA_BRAND_USD,
  EXTRA_RUN_USD,
  PLANS,
  planAllowsClientCc,
  planAllowsCustomSender,
  planAllowsWeeklyCadence,
  planSeatCap,
} from "./billing";
import { isEngineApiConfigured } from "./engine-adapters";

assert.equal(PLANS.starter.amountUsd, 149);
assert.equal(PLANS.agency.amountUsd, 249);
assert.equal(PLANS.studio.amountUsd, 499);
assert.equal(PLANS.starter.seats, 1);
assert.equal(PLANS.agency.seats, 3);
assert.equal(PLANS.studio.seats, 10);
assert.equal(planSeatCap("agency"), 3);
assert.equal(planSeatCap("studio"), 10);
assert.equal(planSeatCap("starter"), 1);

assert.equal(EXTRA_BRAND_USD.agency, 39);
assert.equal(EXTRA_BRAND_USD.studio, 29);
assert.equal(EXTRA_RUN_USD.agency, 9);
assert.equal(EXTRA_RUN_USD.studio, 9);

assert.equal(planAllowsWeeklyCadence("starter"), false);
assert.equal(planAllowsWeeklyCadence("agency"), true);
assert.equal(planAllowsClientCc("starter"), false);
assert.equal(planAllowsClientCc("agency"), true);
assert.equal(planAllowsCustomSender("agency"), false);
assert.equal(planAllowsCustomSender("studio"), true);

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
assert.equal(wouldRejectInvite(3, 0, "agency"), true);
assert.equal(wouldRejectInvite(2, 0, "agency"), false);
assert.equal(wouldRejectInvite(2, 1, "agency"), true);
assert.equal(wouldRejectInvite(10, 0, "studio"), true);
assert.equal(wouldRejectInvite(9, 0, "studio"), false);

console.log("prd-v22.test.ts ok");
