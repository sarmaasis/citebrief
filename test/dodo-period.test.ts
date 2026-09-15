import assert from "node:assert/strict";
import { stubPaidSubscriptionPatch } from "@/lib/billing";
import {
  dodoCurrentPeriodEnd,
  dodoEventConfirmsPaidPlan,
  dodoEventIsPaymentFailure,
  parseDodoTimestamp,
  resolveDodoPlanProductId,
  resolvePlanFromDodoProductId,
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

// --- Product id selection (Studio annual changePlan / checkout) ---
const productEnv = {
  DODO_PRODUCT_AGENCY: "prod_agency_mo",
  DODO_PRODUCT_STUDIO: "prod_studio_mo",
  DODO_PRODUCT_AGENCY_ANNUAL: "prod_agency_yr",
  DODO_PRODUCT_STUDIO_ANNUAL: "prod_studio_yr",
} as CloudflareEnv;

{
  const studioAnnual = resolveDodoPlanProductId(productEnv, "studio", "annual");
  assert.equal(studioAnnual.ok, true);
  if (studioAnnual.ok) assert.equal(studioAnnual.productId, "prod_studio_yr");
  assert.deepEqual(resolvePlanFromDodoProductId(productEnv, "prod_studio_yr"), {
    plan: "studio",
    interval: "annual",
  });
}

{
  const agencyAnnual = resolveDodoPlanProductId(productEnv, "agency", "annual");
  assert.equal(agencyAnnual.ok, true);
  if (agencyAnnual.ok) assert.equal(agencyAnnual.productId, "prod_agency_yr");
}

// Swapped / colliding annual IDs must fail closed (not send Agency cart for Studio).
{
  const swapped = {
    ...productEnv,
    DODO_PRODUCT_STUDIO_ANNUAL: "prod_agency_yr",
  } as CloudflareEnv;
  const bad = resolveDodoPlanProductId(swapped, "studio", "annual");
  assert.equal(bad.ok, false);
}

// Missing annual id → unavailable (do not silently fall back to monthly).
{
  const noAnnual = {
    DODO_PRODUCT_STUDIO: "prod_studio_mo",
  } as CloudflareEnv;
  const missing = resolveDodoPlanProductId(noAnnual, "studio", "annual");
  assert.equal(missing.ok, false);
}

// Webhook guard: product id wins over stale metadata (abandoned Studio switch left metadata).
{
  const fromProduct = resolvePlanFromDodoProductId(productEnv, "prod_agency_yr");
  assert.deepEqual(fromProduct, { plan: "agency", interval: "annual" });
  // Simulate resolver preference used in dodo-hono: productHint || metaPlan
  const metaPlan = "studio";
  const plan = fromProduct?.plan || metaPlan;
  assert.equal(plan, "agency");
}

console.log("dodo-period.test.ts ok");
