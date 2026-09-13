import assert from "node:assert/strict";
import {
  ANNUAL_MONTHS_CHARGED,
  EXTRA_BRAND_USD,
  planAllowsExtraBrands,
  planAnnualAmountUsd,
  planSeatCap,
  SEAT_OVERAGE_USD,
} from "./billing";
import {
  isPaidActive,
  isTrialing,
  pdfRetentionExpired,
  reportSendBlockedReason,
  workspaceEntitlements,
} from "./entitlements";
import { shouldSettleBillableExtra } from "./usage";
import { isLocalFirstFridaySix } from "./friday-tz";
import { generatePromptPack, validatePromptSet } from "./prompts";

assert.equal(planAllowsExtraBrands("starter"), false);
assert.equal(planAllowsExtraBrands("agency"), true);
assert.equal(planAllowsExtraBrands("studio"), true);
assert.equal(EXTRA_BRAND_USD.agency, 39);
assert.equal(EXTRA_BRAND_USD.studio, 29);
assert.equal(SEAT_OVERAGE_USD, 15);
assert.equal(ANNUAL_MONTHS_CHARGED, 10);
assert.equal(planAnnualAmountUsd("agency"), 2490);
assert.equal(planSeatCap("agency"), 3);
assert.equal(planSeatCap("agency", 2), 5);

const trial = {
  plan: "agency",
  status: "trialing",
  trialEndsAt: new Date(Date.now() + 86400000),
  currentPeriodEnd: null,
};
assert.equal(isTrialing(trial), true);
assert.equal(isPaidActive(trial), false);
assert.equal(workspaceEntitlements(trial).brandLimit, 1);
assert.equal(workspaceEntitlements(trial).allowsWeeklyCadence, false);
assert.equal(workspaceEntitlements(trial).allowsMembers, false);
assert.equal(workspaceEntitlements(trial).allowsHistory, false);
assert.equal(workspaceEntitlements(null).allowsHistory, false);

const paidAgency = {
  plan: "agency",
  status: "active",
  trialEndsAt: null,
  currentPeriodEnd: new Date(Date.now() + 20 * 86400000),
  extraBrands: 2,
  extraSeats: 1,
};
assert.equal(workspaceEntitlements(paidAgency).brandLimit, 10);
assert.equal(workspaceEntitlements(paidAgency).seatCap, 4);
assert.equal(workspaceEntitlements(paidAgency).allowsWeeklyCadence, true);
assert.equal(workspaceEntitlements(paidAgency).allowsExtraBrands, true);
assert.equal(workspaceEntitlements(paidAgency).allowsHistory, true);

const paidStarter = {
  plan: "starter",
  status: "active",
  trialEndsAt: null,
  currentPeriodEnd: new Date(Date.now() + 20 * 86400000),
};
assert.equal(workspaceEntitlements(paidStarter).allowsHistory, false);
assert.equal(workspaceEntitlements(paidStarter).allowsMembers, false);

const unpaid = {
  plan: "agency",
  status: "none",
  trialEndsAt: null,
  currentPeriodEnd: null,
};
assert.equal(workspaceEntitlements(unpaid).brandLimit, 1);
assert.equal(workspaceEntitlements(null).allowsSlack, false);

const ended = {
  plan: "agency",
  status: "cancelled",
  trialEndsAt: null,
  currentPeriodEnd: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
  cancelAtPeriodEnd: true,
};
assert.equal(pdfRetentionExpired(ended), true);
assert.equal(
  pdfRetentionExpired({
    ...ended,
    currentPeriodEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  }),
  false,
);

const firstFridayEt = new Date("2026-09-04T10:30:00.000Z");
assert.equal(isLocalFirstFridaySix("America/New_York", firstFridayEt), true);
const secondFridayEt = new Date("2026-09-11T10:30:00.000Z");
assert.equal(isLocalFirstFridaySix("America/New_York", secondFridayEt), false);

const pack = generatePromptPack({
  brand: "Northstar",
  category: "project management",
  buyer: "agencies",
  incumbent: "Asana",
  competitors: ["ClickUp"],
});
assert.equal(validatePromptSet(pack, "Northstar").ok, true);
assert.equal(validatePromptSet(pack, "Northstar", { maxCount: 30 }).ok, true);
const studioSet = [
  ...pack,
  { text: "best project management for law firms 2026", mix: "discovery" as const, sortOrder: 21 },
];
assert.equal(validatePromptSet(studioSet, "Northstar", { maxCount: 20 }).ok, false);
assert.equal(validatePromptSet(studioSet, "Northstar", { maxCount: 30 }).ok, true);

assert.equal(
  reportSendBlockedReason({ ccClient: "client@example.com", allowsClientCc: false }),
  "Client CC requires Agency or Studio.",
);
assert.equal(reportSendBlockedReason({ ccClient: "client@example.com", allowsClientCc: true }), null);
assert.equal(reportSendBlockedReason({ ccClient: "  ", allowsClientCc: false }), null);
assert.equal(reportSendBlockedReason({ allowsClientCc: false }), null);

assert.equal(shouldSettleBillableExtra("complete"), true);
assert.equal(shouldSettleBillableExtra("partial"), true);
assert.equal(shouldSettleBillableExtra("failed"), false);
assert.equal(shouldSettleBillableExtra("queued"), false);
assert.equal(shouldSettleBillableExtra("running"), false);

console.log("entitlements.test.ts ok");
