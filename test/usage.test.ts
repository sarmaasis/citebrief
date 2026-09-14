import assert from "node:assert/strict";
import {
  EXTRA_RUN_USD,
  TRIAL_RUN_CAP,
  planHardStop,
  planIncludedRunCap,
  planManualRerunCap,
  planMonthlyRecheckCredits,
} from "@/lib/billing";
import { formatPaidRunsUsageHint } from "@/lib/usage-format";
import {
  countRechecksFromBrandWeekBuckets,
  decidePaidRunCap,
  decideUnpaidRunCap,
  inferPlanMeteringSinceFromCheckouts,
  meteringWindowStart,
  planChangeMeteringPatch,
  runCountsTowardCap,
  wonBilledAtClaim,
} from "@/lib/usage";

assert.equal(planIncludedRunCap("starter"), 2);
assert.equal(planMonthlyRecheckCredits("starter"), 2);
assert.equal(planHardStop("starter"), 6);
assert.equal(planManualRerunCap("agency"), 0);
assert.equal(planIncludedRunCap("agency"), 1);
assert.equal(planMonthlyRecheckCredits("agency"), 10);
assert.equal(planHardStop("agency"), 3);
assert.equal(planIncludedRunCap("studio"), 3);
assert.equal(planMonthlyRecheckCredits("studio"), 100);
assert.equal(planHardStop("studio"), 9);
assert.equal(planIncludedRunCap("enterprise"), 3);
assert.equal(planMonthlyRecheckCredits("enterprise"), 100);
assert.equal(planHardStop("enterprise"), 9);
assert.equal(TRIAL_RUN_CAP, 1);

const starterSoft = planIncludedRunCap("starter");
const agencySoft = planIncludedRunCap("agency");
const studioSoft = planIncludedRunCap("studio");

function assertBlockedBuyExtra(
  decision: ReturnType<typeof decidePaidRunCap>,
  plan: "starter" | "agency" | "studio" | "enterprise",
) {
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.code, "run_cap");
    assert.match(decision.message, new RegExp(`\\$${EXTRA_RUN_USD[plan]}`));
    assert.match(decision.message, /Buy an extra run/i);
  }
}

function assertAllowedFree(decision: ReturnType<typeof decidePaidRunCap>) {
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.extraRun, false);
    assert.equal(decision.consumeCredit, false);
  }
}

// --- Starter ---

// Within weekly included budget — free even when monthly rechecks are already 0.
{
  const decision = decidePaidRunCap({
    plan: "starter",
    brandWeekRunCount: 1,
    monthlyRechecksUsed: 2,
    extraRunCredits: 0,
  });
  assertAllowedFree(decision);
  if (decision.allowed) assert.equal(decision.warning, null);
}

// Past softCap with monthly recheck remaining — use included credit.
{
  const decision = decidePaidRunCap({
    plan: "starter",
    brandWeekRunCount: starterSoft,
    monthlyRechecksUsed: 0,
    extraRunCredits: 0,
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.consumeCredit, false);
    assert.equal(decision.extraRun, false);
    assert.match(decision.warning ?? "", /1\/2/);
  }
}

// Starter at 0 rechecks, no prepaid credit → block (402 run_cap). Must not auto-meter.
{
  const decision = decidePaidRunCap({
    plan: "starter",
    brandWeekRunCount: starterSoft,
    monthlyRechecksUsed: 2,
    extraRunCredits: 0,
  });
  assertBlockedBuyExtra(decision, "starter");
}

// Same position with a purchased extra-run credit → allowed (consumeCredit).
{
  const decision = decidePaidRunCap({
    plan: "starter",
    brandWeekRunCount: starterSoft,
    monthlyRechecksUsed: 2,
    extraRunCredits: 1,
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.consumeCredit, true);
    assert.equal(decision.extraRun, false);
    assert.match(decision.warning ?? "", /prepaid/i);
  }
}

// Hard stop still wins over prepaid credits.
{
  const decision = decidePaidRunCap({
    plan: "starter",
    brandWeekRunCount: planHardStop("starter"),
    monthlyRechecksUsed: 2,
    extraRunCredits: 3,
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.code, "run_cap");
    assert.match(decision.message, /Hard stop/i);
  }
}

// --- Agency (Friday-only included, 0 free manuals) ---

// First weekly slot still free even when monthly rechecks are exhausted.
{
  const decision = decidePaidRunCap({
    plan: "agency",
    brandWeekRunCount: 0,
    monthlyRechecksUsed: 10,
    extraRunCredits: 0,
  });
  assertAllowedFree(decision);
  if (decision.allowed) assert.equal(decision.warning, null);
}

// Past Friday slot with monthly recheck remaining → consume monthly (not silent extra).
{
  const decision = decidePaidRunCap({
    plan: "agency",
    brandWeekRunCount: agencySoft,
    monthlyRechecksUsed: 0,
    extraRunCredits: 0,
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.extraRun, false);
    assert.equal(decision.consumeCredit, false);
    assert.match(decision.warning ?? "", /1\/10/);
  }
}

// Agency at 0 free manuals + 0 monthly rechecks, no prepaid → block (no silent free extras).
{
  const decision = decidePaidRunCap({
    plan: "agency",
    brandWeekRunCount: agencySoft,
    monthlyRechecksUsed: 10,
    extraRunCredits: 0,
  });
  assertBlockedBuyExtra(decision, "agency");
}

// Agency same position with prepaid credit → consumeCredit, never extraRun auto-meter.
{
  const decision = decidePaidRunCap({
    plan: "agency",
    brandWeekRunCount: agencySoft,
    monthlyRechecksUsed: 10,
    extraRunCredits: 1,
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.extraRun, false);
    assert.equal(decision.consumeCredit, true);
  }
}

// Agency hard stop (3) blocks even with credits.
{
  const decision = decidePaidRunCap({
    plan: "agency",
    brandWeekRunCount: planHardStop("agency"),
    monthlyRechecksUsed: 10,
    extraRunCredits: 5,
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.match(decision.message, /Hard stop/i);
}

// --- Studio (weekly + 2 free manuals → then monthly → then credit) ---

// Still inside free manuals (softCap 3) with monthly exhausted → free.
{
  const decision = decidePaidRunCap({
    plan: "studio",
    brandWeekRunCount: studioSoft - 1,
    monthlyRechecksUsed: 100,
    extraRunCredits: 0,
  });
  assertAllowedFree(decision);
}

// SoftCap exhausted, monthly remaining → monthly recheck.
{
  const decision = decidePaidRunCap({
    plan: "studio",
    brandWeekRunCount: studioSoft,
    monthlyRechecksUsed: 0,
    extraRunCredits: 0,
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.extraRun, false);
    assert.equal(decision.consumeCredit, false);
    assert.match(decision.warning ?? "", /1\/100/);
  }
}

// Studio free manuals + monthly exhausted, no prepaid → block.
{
  const decision = decidePaidRunCap({
    plan: "studio",
    brandWeekRunCount: studioSoft,
    monthlyRechecksUsed: 100,
    extraRunCredits: 0,
  });
  assertBlockedBuyExtra(decision, "studio");
}

// Studio with prepaid credit after exhaustion.
{
  const decision = decidePaidRunCap({
    plan: "studio",
    brandWeekRunCount: studioSoft,
    monthlyRechecksUsed: 100,
    extraRunCredits: 2,
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.extraRun, false);
    assert.equal(decision.consumeCredit, true);
  }
}

// --- Enterprise mirrors Studio pattern ---

{
  const decision = decidePaidRunCap({
    plan: "enterprise",
    brandWeekRunCount: planIncludedRunCap("enterprise"),
    monthlyRechecksUsed: 100,
    extraRunCredits: 0,
  });
  assertBlockedBuyExtra(decision, "enterprise");
}

{
  const decision = decidePaidRunCap({
    plan: "enterprise",
    brandWeekRunCount: planIncludedRunCap("enterprise") - 1,
    monthlyRechecksUsed: 100,
    extraRunCredits: 0,
  });
  assertAllowedFree(decision);
}

{
  const decision = decidePaidRunCap({
    plan: "enterprise",
    brandWeekRunCount: planIncludedRunCap("enterprise"),
    monthlyRechecksUsed: 100,
    extraRunCredits: 1,
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.extraRun, false);
    assert.equal(decision.consumeCredit, true);
  }
}

// --- Trial / unpaid ---

{
  const ok = decideUnpaidRunCap(0);
  assert.equal(ok.allowed, true);
  if (ok.allowed) {
    assert.equal(ok.extraRun, false);
    assert.equal(ok.consumeCredit, false);
  }
}

{
  const blocked = decideUnpaidRunCap(TRIAL_RUN_CAP);
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.equal(blocked.code, "trial_run_cap");
    assert.match(blocked.message, /Trial allows 1 full run/i);
  }
}

{
  const blocked = decideUnpaidRunCap(TRIAL_RUN_CAP + 3);
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.code, "trial_run_cap");
}

// Brand×week recheck counting: 2 included + 2 excess on one brand-week = 2 used.
{
  const brandId = "brand-a";
  const week = new Date();
  const rows = Array.from({ length: 4 }, () => ({ brandId, createdAt: week }));
  assert.equal(countRechecksFromBrandWeekBuckets(rows, starterSoft), 2);
}

// Agency softCap 1: second run in a week counts as 1 monthly recheck.
{
  const brandId = "brand-b";
  const week = new Date();
  const rows = [
    { brandId, createdAt: week },
    { brandId, createdAt: week },
  ];
  assert.equal(countRechecksFromBrandWeekBuckets(rows, agencySoft), 1);
}

// Studio softCap 3: five runs → 2 monthly rechecks.
{
  const brandId = "brand-c";
  const week = new Date();
  const rows = Array.from({ length: 5 }, () => ({ brandId, createdAt: week }));
  assert.equal(countRechecksFromBrandWeekBuckets(rows, studioSoft), 2);
}

// --- Plan-change metering (Starter → Agency) ---

{
  const now = new Date("2026-09-15T12:00:00.000Z");
  const patch = planChangeMeteringPatch({
    previousPlan: "starter",
    nextPlan: "agency",
    now,
  });
  assert.ok(patch);
  assert.equal(patch?.planMeteringSince.toISOString(), now.toISOString());
  assert.equal(patch?.extraRuns, 0);
}

{
  assert.equal(
    planChangeMeteringPatch({ previousPlan: "agency", nextPlan: "agency" }),
    null,
  );
}

{
  const monthStart = new Date(2026, 8, 1); // Sep 2026 local
  const upgradeAt = new Date(2026, 8, 10, 15, 0, 0);
  const window = meteringWindowStart(upgradeAt, new Date(2026, 8, 15));
  assert.equal(window.getTime(), upgradeAt.getTime());
  assert.ok(window.getTime() > monthStart.getTime());
}

{
  const monthStart = new Date(2026, 8, 1);
  const older = new Date(2026, 7, 20); // August — clamp to Sep 1
  const window = meteringWindowStart(older, new Date(2026, 8, 15));
  assert.equal(window.getTime(), monthStart.getTime());
}

// Six Starter-era runs in one brand-week recount as 5 Agency rechecks (softCap 1).
// After upgrade metering window, those runs fall outside → 0 used → 10/10 left.
{
  const brandId = "brand-upgrade";
  const week = new Date(2026, 8, 8);
  const starterEraRuns = Array.from({ length: 6 }, () => ({ brandId, createdAt: week }));
  assert.equal(countRechecksFromBrandWeekBuckets(starterEraRuns, agencySoft), 5);

  const upgradeAt = new Date(2026, 8, 12);
  const window = meteringWindowStart(upgradeAt, new Date(2026, 8, 15));
  const postUpgradeRows = starterEraRuns.filter((row) => row.createdAt.getTime() >= window.getTime());
  assert.equal(postUpgradeRows.length, 0);
  assert.equal(countRechecksFromBrandWeekBuckets(postUpgradeRows, agencySoft), 0);

  const remaining = planMonthlyRecheckCredits("agency") - 0;
  assert.equal(remaining, 10);

  const hint = formatPaidRunsUsageHint({
    plan: "agency",
    billableExtrasThisPeriod: 0,
    monthlyRecheckCredits: 10,
    monthlyRechecksRemaining: remaining,
    extraRunCredits: 0,
  });
  assert.equal(hint, "10/10 rechecks left this month");
  assert.doesNotMatch(hint, /extra at/);
  assert.doesNotMatch(hint, /included ·/);
}

// Stale lifetime extraRuns must not invent "$9" copy — only settled extras in window.
{
  const staleLifetimeExtras = 1;
  const settledInWindow = 0;
  assert.notEqual(staleLifetimeExtras, settledInWindow);
  const hint = formatPaidRunsUsageHint({
    plan: "agency",
    billableExtrasThisPeriod: settledInWindow,
    monthlyRecheckCredits: 10,
    monthlyRechecksRemaining: 10,
    extraRunCredits: 0,
  });
  assert.doesNotMatch(hint, /extra at \$9/);
}

{
  const hint = formatPaidRunsUsageHint({
    plan: "agency",
    billableExtrasThisPeriod: 1,
    monthlyRecheckCredits: 10,
    monthlyRechecksRemaining: 5,
    extraRunCredits: 2,
  });
  assert.equal(hint, "5/10 rechecks left this month · 1 extra at $9 · 2 extra-run credits");
}

{
  const starterAt = new Date("2026-09-01T10:00:00.000Z");
  const agencyAt = new Date("2026-09-12T10:00:00.000Z");
  const inferred = inferPlanMeteringSinceFromCheckouts(
    [
      { plan: "starter", createdAt: starterAt },
      { plan: "agency", createdAt: agencyAt },
    ],
    "agency",
  );
  assert.equal(inferred?.toISOString(), agencyAt.toISOString());
}

{
  assert.equal(
    inferPlanMeteringSinceFromCheckouts([{ plan: "agency", createdAt: new Date() }], "agency"),
    null,
  );
}

// --- Plan-change metering (Agency → Studio / any plan change) ---

{
  const now = new Date("2026-09-15T12:00:00.000Z");
  const patch = planChangeMeteringPatch({
    previousPlan: "agency",
    nextPlan: "studio",
    now,
  });
  assert.ok(patch);
  assert.equal(patch?.planMeteringSince.toISOString(), now.toISOString());
  assert.equal(patch?.extraRuns, 0);
}

{
  const now = new Date("2026-09-15T12:00:00.000Z");
  const down = planChangeMeteringPatch({
    previousPlan: "studio",
    nextPlan: "agency",
    now,
  });
  assert.ok(down);
  assert.equal(down?.planMeteringSince.toISOString(), now.toISOString());
  assert.equal(down?.extraRuns, 0);
}

{
  assert.equal(
    planChangeMeteringPatch({ previousPlan: "studio", nextPlan: "studio" }),
    null,
  );
}

// Ten Agency-era runs in one brand-week recount as 7 Studio rechecks (softCap 3).
// After upgrade metering window, those runs fall outside → 0 used → 100/100 left.
{
  const brandId = "brand-agency-to-studio";
  const week = new Date(2026, 8, 8);
  const agencyEraRuns = Array.from({ length: 10 }, () => ({ brandId, createdAt: week }));
  assert.equal(countRechecksFromBrandWeekBuckets(agencyEraRuns, agencySoft), 9);
  assert.equal(countRechecksFromBrandWeekBuckets(agencyEraRuns, studioSoft), 7);

  const upgradeAt = new Date(2026, 8, 12);
  const window = meteringWindowStart(upgradeAt, new Date(2026, 8, 15));
  const postUpgradeRows = agencyEraRuns.filter((row) => row.createdAt.getTime() >= window.getTime());
  assert.equal(postUpgradeRows.length, 0);
  assert.equal(countRechecksFromBrandWeekBuckets(postUpgradeRows, studioSoft), 0);

  const remaining = planMonthlyRecheckCredits("studio") - 0;
  assert.equal(remaining, 100);

  const hint = formatPaidRunsUsageHint({
    plan: "studio",
    billableExtrasThisPeriod: 0,
    monthlyRecheckCredits: 100,
    monthlyRechecksRemaining: remaining,
    extraRunCredits: 0,
  });
  assert.equal(hint, "100/100 rechecks left this month");
  assert.doesNotMatch(hint, /extra at/);
}

{
  const agencyAt = new Date("2026-09-01T10:00:00.000Z");
  const studioAt = new Date("2026-09-12T10:00:00.000Z");
  const inferred = inferPlanMeteringSinceFromCheckouts(
    [
      { plan: "agency", createdAt: agencyAt },
      { plan: "studio", createdAt: studioAt },
    ],
    "studio",
  );
  assert.equal(inferred?.toISOString(), studioAt.toISOString());
}

// --- billedAt claim proof (coarse timestamps must not skip settlement) ---

{
  const stamp = new Date("2026-09-15T12:00:00.450Z");
  const coarsened = new Date("2026-09-15T12:00:00.000Z"); // second precision
  assert.equal(Math.abs(coarsened.getTime() - stamp.getTime()) > 5, true);
  assert.equal(wonBilledAtClaim(coarsened, stamp), true);
  assert.equal(wonBilledAtClaim(stamp, stamp), true);
  assert.equal(wonBilledAtClaim(null, stamp), false);
  assert.equal(wonBilledAtClaim(undefined, stamp), false);
}

// --- Failed runs do not consume soft-cap / trial slots ---

assert.equal(runCountsTowardCap("failed"), false);
assert.equal(runCountsTowardCap("complete"), true);
assert.equal(runCountsTowardCap("partial"), true);
assert.equal(runCountsTowardCap("queued"), true);
assert.equal(runCountsTowardCap("running"), true);

{
  // One failed run this week → brandWeekRunCount stays 0 → next free attempt allowed.
  const weekStatuses = ["failed"];
  const brandWeekRunCount = weekStatuses.filter(runCountsTowardCap).length;
  assert.equal(brandWeekRunCount, 0);
  const decision = decidePaidRunCap({
    plan: "agency",
    brandWeekRunCount,
    monthlyRechecksUsed: 10,
    extraRunCredits: 0,
  });
  assertAllowedFree(decision);
}

{
  // Failed + complete: only complete consumes the Agency softCap of 1.
  const weekStatuses = ["failed", "complete"];
  const brandWeekRunCount = weekStatuses.filter(runCountsTowardCap).length;
  assert.equal(brandWeekRunCount, 1);
  const decision = decidePaidRunCap({
    plan: "agency",
    brandWeekRunCount,
    monthlyRechecksUsed: 10,
    extraRunCredits: 0,
  });
  assertBlockedBuyExtra(decision, "agency");
}

{
  // Soft-fail partial that shipped a report does consume the slot.
  const weekStatuses = ["partial"];
  const brandWeekRunCount = weekStatuses.filter(runCountsTowardCap).length;
  assert.equal(brandWeekRunCount, 1);
  const decision = decidePaidRunCap({
    plan: "agency",
    brandWeekRunCount,
    monthlyRechecksUsed: 10,
    extraRunCredits: 0,
  });
  assertBlockedBuyExtra(decision, "agency");
}

{
  // Trial: failed run does not burn the single full-run allowance.
  const trialRunStatuses = ["failed"];
  const trialRuns = trialRunStatuses.filter(runCountsTowardCap).length;
  assert.equal(decideUnpaidRunCap(trialRuns).allowed, true);
  assert.equal(decideUnpaidRunCap(trialRuns + 1).allowed, false);
}

console.log("usage.test.ts ok");
