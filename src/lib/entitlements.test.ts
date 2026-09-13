import assert from "node:assert/strict";
import {
  ANNUAL_MONTHS_CHARGED,
  EXTRA_BRAND_USD,
  billingPageIntro,
  shouldWriteStubPaidSubscription,
  stubPaidSubscriptionPatch,
  planAllowsExtraBrands,
  planAnnualAmountUsd,
  planCardState,
  planSeatCap,
  resolveSelectedPlan,
  SEAT_OVERAGE_USD,
} from "./billing";
import {
  isPaidActive,
  isTrialing,
  pdfRetentionExpired,
  reportSendBlockedReason,
  reportSendDenial,
  workspaceEntitlements,
} from "./entitlements";
import { shouldSettleBillableExtra } from "./usage";
import { isLocalFirstFridaySix } from "./friday-tz";
import { generatePromptPack, validatePromptSet } from "./prompts";

assert.equal(planAllowsExtraBrands("starter"), false);
assert.equal(planAllowsExtraBrands("agency"), true);
assert.equal(planAllowsExtraBrands("studio"), true);
assert.equal(EXTRA_BRAND_USD.agency, 29);
assert.equal(EXTRA_BRAND_USD.studio, 19);
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
assert.equal(workspaceEntitlements(trial).trialRunCap, 1);
assert.equal(workspaceEntitlements(trial).seatCap, 1);
assert.equal(workspaceEntitlements(trial).allowsWeeklyCadence, false);
assert.equal(workspaceEntitlements(trial).allowsMembers, false);
assert.equal(workspaceEntitlements(trial).allowsHistory, false);
assert.equal(workspaceEntitlements(trial).allowsClientCc, false);
assert.equal(workspaceEntitlements(trial).allowsSlack, false);
assert.equal(workspaceEntitlements(trial).allowsEmailSend, false);
assert.equal(workspaceEntitlements(null).allowsHistory, false);

const paidAgency = {
  plan: "agency",
  status: "active",
  trialEndsAt: null,
  currentPeriodEnd: new Date(Date.now() + 20 * 86400000),
  extraBrands: 2,
  extraSeats: 1,
};
assert.equal(workspaceEntitlements(paidAgency).brandLimit, 12);
assert.equal(workspaceEntitlements(paidAgency).seatCap, 4);
assert.equal(workspaceEntitlements(paidAgency).extraBrandUsd, 29);
assert.equal(workspaceEntitlements(paidAgency).allowsWeeklyCadence, true);
assert.equal(workspaceEntitlements(paidAgency).allowsExtraBrands, true);
assert.equal(workspaceEntitlements(paidAgency).allowsHistory, true);
assert.equal(workspaceEntitlements(paidAgency).allowsClientCc, true);
assert.equal(workspaceEntitlements(paidAgency).allowsSlack, true);
assert.equal(workspaceEntitlements(paidAgency).allowsEmailSend, true);

const paidStarter = {
  plan: "starter",
  status: "active",
  trialEndsAt: null,
  currentPeriodEnd: new Date(Date.now() + 20 * 86400000),
};
assert.equal(workspaceEntitlements(paidStarter).brandLimit, 2);
assert.equal(workspaceEntitlements(paidStarter).allowsHistory, false);
assert.equal(workspaceEntitlements(paidStarter).allowsMembers, false);
assert.equal(workspaceEntitlements(paidStarter).allowsWeeklyCadence, false);
assert.equal(workspaceEntitlements(paidStarter).allowsExtraBrands, false);
assert.equal(workspaceEntitlements(paidStarter).allowsEmailSend, false);
assert.equal(
  workspaceEntitlements({
    plan: "studio",
    status: "active",
    trialEndsAt: null,
    currentPeriodEnd: new Date(Date.now() + 20 * 86400000),
  }).allowsEmailSend,
  true,
);

const unpaid = {
  plan: "agency",
  status: "none",
  trialEndsAt: null,
  currentPeriodEnd: null,
};
assert.equal(workspaceEntitlements(unpaid).brandLimit, 1);
assert.equal(workspaceEntitlements(unpaid).allowsEmailSend, false);
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
  reportSendBlockedReason({
    ccClient: "client@example.com",
    allowsEmailSend: true,
    allowsClientCc: false,
  }),
  "Client CC requires Agency or Studio.",
);
assert.equal(
  reportSendBlockedReason({ ccClient: "client@example.com", allowsEmailSend: true, allowsClientCc: true }),
  null,
);
assert.equal(reportSendBlockedReason({ ccClient: "  ", allowsEmailSend: true, allowsClientCc: false }), null);
assert.equal(reportSendBlockedReason({ allowsEmailSend: true, allowsClientCc: false }), null);

const starterSend = reportSendDenial({
  allowsEmailSend: workspaceEntitlements(paidStarter).allowsEmailSend,
  allowsClientCc: workspaceEntitlements(paidStarter).allowsClientCc,
});
assert.equal(starterSend?.status, 403);
assert.equal(starterSend?.error, "Email sending requires Agency or Studio.");

const agencySend = reportSendDenial({
  allowsEmailSend: workspaceEntitlements(paidAgency).allowsEmailSend,
  allowsClientCc: workspaceEntitlements(paidAgency).allowsClientCc,
});
assert.equal(agencySend, null);

const trialSend = reportSendDenial({
  allowsEmailSend: workspaceEntitlements(trial).allowsEmailSend,
  allowsClientCc: workspaceEntitlements(trial).allowsClientCc,
});
assert.equal(trialSend?.status, 403);

assert.equal(shouldSettleBillableExtra("complete"), true);
assert.equal(shouldSettleBillableExtra("partial"), true);
assert.equal(shouldSettleBillableExtra("failed"), false);
assert.equal(shouldSettleBillableExtra("queued"), false);
assert.equal(shouldSettleBillableExtra("running"), false);

assert.equal(resolveSelectedPlan("starter"), "starter");
assert.equal(resolveSelectedPlan("agency"), "agency");
assert.equal(resolveSelectedPlan(""), "agency");

const trialStarterCards = (["starter", "agency", "studio"] as const).map((id) =>
  planCardState({
    id,
    selectedPlan: "starter",
    isPaid: false,
    isTrialing: true,
    currentInterval: "monthly",
    viewingAnnual: false,
  }),
);
assert.equal(trialStarterCards.filter((card) => card.highlighted).length, 1);
assert.equal(trialStarterCards[0].highlighted, true);
assert.equal(trialStarterCards[0].badge, "After trial");
assert.equal(trialStarterCards[0].cta, "Continue with Starter");
assert.equal(trialStarterCards[1].highlighted, false);
assert.equal(trialStarterCards[1].badge, null);
assert.equal(trialStarterCards[1].cta, "Choose Agency");
assert.equal(
  billingPageIntro({ trialing: true, paid: false, plan: "starter" }).includes("Agency"),
  false,
);

const trialAgencyCards = (["starter", "agency", "studio"] as const).map((id) =>
  planCardState({
    id,
    selectedPlan: "agency",
    isPaid: false,
    isTrialing: true,
    currentInterval: "monthly",
    viewingAnnual: false,
  }),
);
assert.equal(trialAgencyCards.filter((card) => card.highlighted).length, 1);
assert.equal(trialAgencyCards[1].highlighted, true);
assert.equal(trialAgencyCards[1].badge, "After trial");
assert.equal(trialAgencyCards[0].badge, null);
assert.ok(billingPageIntro({ trialing: true, paid: false, plan: "agency" }).includes("Agency"));

const paidAgencyCards = (["starter", "agency", "studio"] as const).map((id) =>
  planCardState({
    id,
    selectedPlan: "agency",
    isPaid: true,
    isTrialing: false,
    currentInterval: "monthly",
    viewingAnnual: false,
  }),
);
assert.equal(paidAgencyCards.filter((card) => card.highlighted).length, 1);
assert.equal(paidAgencyCards[1].badge, "Current plan");
assert.equal(paidAgencyCards[1].cta, "Current plan");
assert.equal(paidAgencyCards[0].badge, null);
assert.equal(paidAgencyCards[0].cta, "Choose Starter");

const stubPaidAgency = planCardState({
  id: "agency",
  selectedPlan: "agency",
  isPaid: true,
  isTrialing: true,
  currentInterval: "monthly",
  viewingAnnual: false,
});
assert.equal(stubPaidAgency.badge, "Current plan");
assert.equal(stubPaidAgency.cta, "Current plan");

assert.equal(shouldWriteStubPaidSubscription({ mode: "stub", isProduction: false }), true);
assert.equal(shouldWriteStubPaidSubscription({ mode: "stub", isProduction: true }), false);
assert.equal(shouldWriteStubPaidSubscription({ mode: "unavailable", isProduction: false }), false);
assert.equal(shouldWriteStubPaidSubscription({ mode: "redirect", isProduction: false }), false);

const stubNow = new Date("2026-09-14T00:00:00.000Z");
const stubAgencyPatch = stubPaidSubscriptionPatch({
  plan: "agency",
  interval: "monthly",
  now: stubNow,
});
assert.equal(stubAgencyPatch.status, "active");
assert.equal(stubAgencyPatch.plan, "agency");
assert.equal(stubAgencyPatch.billingInterval, "monthly");
assert.equal(stubAgencyPatch.trialEndsAt, null);
assert.equal(stubAgencyPatch.cancelAtPeriodEnd, false);

const afterStubAgency = workspaceEntitlements({
  plan: stubAgencyPatch.plan,
  status: stubAgencyPatch.status,
  trialEndsAt: stubAgencyPatch.trialEndsAt,
  currentPeriodEnd: stubAgencyPatch.currentPeriodEnd,
  billingInterval: stubAgencyPatch.billingInterval,
});
assert.equal(afterStubAgency.paid, true);
assert.equal(afterStubAgency.trialing, false);
assert.equal(afterStubAgency.plan, "agency");
assert.equal(afterStubAgency.brandLimit, 10);
assert.equal(afterStubAgency.allowsWeeklyCadence, true);

const stubStarterPatch = stubPaidSubscriptionPatch({ plan: "starter", interval: "annual", now: stubNow });
const afterStubStarter = workspaceEntitlements({
  plan: stubStarterPatch.plan,
  status: stubStarterPatch.status,
  trialEndsAt: stubStarterPatch.trialEndsAt,
  currentPeriodEnd: stubStarterPatch.currentPeriodEnd,
  billingInterval: stubStarterPatch.billingInterval,
});
assert.equal(afterStubStarter.paid, true);
assert.equal(afterStubStarter.trialing, false);
assert.equal(afterStubStarter.plan, "starter");
assert.equal(afterStubStarter.brandLimit, 2);
assert.equal(afterStubStarter.allowsEmailSend, false);

const leftoverTrial = workspaceEntitlements({
  plan: "agency",
  status: "trialing",
  trialEndsAt: new Date(Date.now() + 86400000),
  currentPeriodEnd: null,
});
assert.equal(leftoverTrial.paid, false);
assert.equal(leftoverTrial.trialing, true);

console.log("entitlements.test.ts ok");
