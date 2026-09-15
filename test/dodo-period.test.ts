import assert from "node:assert/strict";
import { stubPaidSubscriptionPatch } from "@/lib/billing";
import {
  dodoCurrentPeriodEnd,
  dodoEventConfirmsPaidPlan,
  dodoEventIsPaymentFailure,
  parseDodoTimestamp,
  resolveSubscriptionPeriodEnd,
  resolveWebhookSubscriptionPlan,
  shouldIgnoreFailedPlanSwitch,
} from "@/lib/dodo";

const iso = "2026-10-15T12:00:00.000Z";
const fromString = parseDodoTimestamp(iso);
assert.ok(fromString);
assert.equal(fromString.toISOString(), iso);

const fromDate = parseDodoTimestamp(new Date(iso));
assert.ok(fromDate);
assert.equal(fromDate.toISOString(), iso);

assert.equal(parseDodoTimestamp(""), null);
assert.equal(parseDodoTimestamp(undefined), null);
assert.equal(parseDodoTimestamp("not-a-date"), null);

const withField = dodoCurrentPeriodEnd({ next_billing_date: iso }, "monthly");
assert.equal(withField.toISOString(), iso);

const fromDateField = dodoCurrentPeriodEnd({ next_billing_date: new Date(iso) }, "annual");
assert.equal(fromDateField.toISOString(), iso);

const before = Date.now();
const inferredMonthly = dodoCurrentPeriodEnd({}, "monthly");
const after = Date.now();
const monthlyMs = 30 * 24 * 60 * 60 * 1000;
assert.ok(inferredMonthly.getTime() >= before + monthlyMs - 5);
assert.ok(inferredMonthly.getTime() <= after + monthlyMs + 5);

const inferredAnnual = dodoCurrentPeriodEnd({ next_billing_date: null }, "annual");
const annualMs = 365 * 24 * 60 * 60 * 1000;
assert.ok(inferredAnnual.getTime() >= before + annualMs - 5);
assert.ok(inferredAnnual.getTime() <= after + annualMs + 5);

assert.equal(dodoEventConfirmsPaidPlan("payment.succeeded"), true);
assert.equal(dodoEventConfirmsPaidPlan("subscription.active"), true);
assert.equal(dodoEventConfirmsPaidPlan("subscription.renewed"), true);
assert.equal(dodoEventConfirmsPaidPlan("subscription.plan_changed"), true);
assert.equal(dodoEventConfirmsPaidPlan("subscription.failed"), false);
assert.equal(dodoEventConfirmsPaidPlan("payment.failed"), false);
assert.equal(dodoEventConfirmsPaidPlan("subscription.past_due"), false);
assert.equal(dodoEventIsPaymentFailure("subscription.failed"), true);
assert.equal(dodoEventIsPaymentFailure("subscription.active"), false);

// Agency → Starter declined: keep Agency.
assert.equal(
  resolveWebhookSubscriptionPlan({
    eventType: "payment.failed",
    requestedPlan: "starter",
    existingPlan: "agency",
  }),
  "agency",
);
assert.equal(
  shouldIgnoreFailedPlanSwitch({
    eventType: "payment.failed",
    requestedPlan: "starter",
    existingPlan: "agency",
    existingStatus: "active",
  }),
  true,
);

// Same-plan renewal failure: apply past_due path (do not ignore).
assert.equal(
  shouldIgnoreFailedPlanSwitch({
    eventType: "subscription.failed",
    requestedPlan: "agency",
    existingPlan: "agency",
    existingStatus: "active",
  }),
  false,
);

// Confirmed payment may switch plan.
assert.equal(
  resolveWebhookSubscriptionPlan({
    eventType: "subscription.active",
    requestedPlan: "starter",
    existingPlan: "agency",
  }),
  "starter",
);
assert.equal(
  resolveWebhookSubscriptionPlan({
    eventType: "subscription.plan_changed",
    requestedPlan: "studio",
    existingPlan: "agency",
  }),
  "studio",
);

// Trial declined charge: ignore (stay trialing).
assert.equal(
  shouldIgnoreFailedPlanSwitch({
    eventType: "payment.failed",
    requestedPlan: "agency",
    existingPlan: "agency",
    existingStatus: "trialing",
  }),
  true,
);

// Annual → monthly without Dodo next_billing_date: keep prepaid paid-through.
const prepaidEnd = new Date("2027-06-01T00:00:00.000Z");
const preserved = resolveSubscriptionPeriodEnd({
  data: {},
  nextInterval: "monthly",
  previousInterval: "annual",
  previousPeriodEnd: prepaidEnd,
});
assert.equal(preserved.toISOString(), prepaidEnd.toISOString());

// When Dodo sends next_billing_date, trust it (proration may reset the cycle).
const fromProration = resolveSubscriptionPeriodEnd({
  data: { next_billing_date: "2026-10-15T00:00:00.000Z" },
  nextInterval: "monthly",
  previousInterval: "annual",
  previousPeriodEnd: prepaidEnd,
});
assert.equal(fromProration.toISOString(), "2026-10-15T00:00:00.000Z");

// Addon keeps prior period.
const addonKept = resolveSubscriptionPeriodEnd({
  data: {},
  nextInterval: "monthly",
  previousInterval: "annual",
  previousPeriodEnd: prepaidEnd,
  isAddon: true,
});
assert.equal(addonKept.toISOString(), prepaidEnd.toISOString());

// Stub annual → monthly preserves prepaid end.
const stubNow = new Date("2026-09-15T00:00:00.000Z");
const stubSwitch = stubPaidSubscriptionPatch({
  plan: "studio",
  interval: "monthly",
  now: stubNow,
  previousInterval: "annual",
  previousPeriodEnd: prepaidEnd,
});
assert.equal(stubSwitch.billingInterval, "monthly");
assert.equal(stubSwitch.plan, "studio");
assert.equal(stubSwitch.currentPeriodEnd.toISOString(), prepaidEnd.toISOString());

console.log("dodo-period.test.ts ok");
