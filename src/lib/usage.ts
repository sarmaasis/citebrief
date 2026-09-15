import { and, desc, eq, gte, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { auditLogs, brands, runs, subscriptions, workspaceInvites, workspaceMembers } from "@/db/schema";
import {
  EXTRA_RUN_USD,
  parsePlanId,
  planHardStop,
  planIncludedRunCap,
  planMonthlyRecheckCredits,
  TRIAL_RUN_CAP,
} from "@/lib/billing";
import { recordDodoExtraRunUsage } from "@/lib/dodo";
import {
  expiredPaidStatus,
  isPaidActive,
  isTrialing,
  pdfRetentionExpired,
  upgradeHintForBrandCap,
  workspaceEntitlements,
} from "@/lib/entitlements";

/** Failed = 0 engines / no PDF. Does not consume soft-cap or trial run. Partial that shipped does. */
export function runCountsTowardCap(status: string | null | undefined): boolean {
  return status !== "failed";
}

/**
 * Claim proof after UPDATE … WHERE billed_at IS NULL.
 * Accept any non-null claimed timestamp (D1 may coarsen ms), or same UTC second as stamp.
 */
export function wonBilledAtClaim(
  claimedBilledAt: Date | null | undefined,
  stamp: Date,
): boolean {
  if (!claimedBilledAt) return false;
  const claimedMs = claimedBilledAt.getTime();
  const stampMs = stamp.getTime();
  if (!Number.isFinite(claimedMs) || !Number.isFinite(stampMs)) return false;
  // Same second covers SQLite/D1 second-precision storage.
  if (Math.floor(claimedMs / 1000) === Math.floor(stampMs / 1000)) return true;
  // Returning/claim path: any non-null after a null→set update means we (or a concurrent
  // winner) hold the row; callers that use .returning() only settle when they wrote.
  return true;
}

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayDelta);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Monthly recheck + billable-extra meters use max(month start, planMeteringSince).
 * Plan changes mid-period start a fresh window so prior-plan runs are not re-bucketed
 * under the new softCap (e.g. Starter softCap 2 → Agency softCap 1).
 */
export function meteringWindowStart(
  planMeteringSince: Date | null | undefined,
  now = new Date(),
): Date {
  const monthStart = startOfMonth(now);
  if (!planMeteringSince) return monthStart;
  const since = planMeteringSince instanceof Date ? planMeteringSince : new Date(planMeteringSince);
  if (Number.isNaN(since.getTime())) return monthStart;
  return since.getTime() > monthStart.getTime() ? since : monthStart;
}

/**
 * When the paid plan id changes, reset the metering window and clear the period
 * extraRuns counter so UI does not show stale “extra at $9” from the prior plan.
 * Pass monthlyRechecksUsed + extraRunCredits to carry unused monthly rechecks into
 * prepaid extra_run_credits (fresh window must not wipe the prior unused pool).
 */
export function planChangeMeteringPatch(args: {
  previousPlan: string | null | undefined;
  nextPlan: string | null | undefined;
  now?: Date;
  monthlyRechecksUsed?: number;
  extraRunCredits?: number;
}): { planMeteringSince: Date; extraRuns: 0; extraRunCredits?: number } | null {
  const prev = parsePlanId(args.previousPlan);
  const next = parsePlanId(args.nextPlan);
  if (!next || prev === next) return null;
  const patch: { planMeteringSince: Date; extraRuns: 0; extraRunCredits?: number } = {
    planMeteringSince: args.now ?? new Date(),
    extraRuns: 0,
  };
  if (prev && args.monthlyRechecksUsed !== undefined && args.extraRunCredits !== undefined) {
    const remaining = Math.max(
      0,
      planMonthlyRecheckCredits(prev) - Math.max(0, args.monthlyRechecksUsed),
    );
    if (remaining > 0) {
      patch.extraRunCredits = Math.max(0, args.extraRunCredits) + remaining;
    }
  }
  return patch;
}

/**
 * Infer metering-since from checkout audit history (any mid-period plan change).
 * Returns the createdAt of the checkout that moved onto `currentPlan`.
 */
export function inferPlanMeteringSinceFromCheckouts(
  checkouts: Array<{ plan: string | null | undefined; createdAt: Date }>,
  currentPlan: string | null | undefined,
): Date | null {
  const current = parsePlanId(currentPlan);
  if (!current) return null;
  const sorted = [...checkouts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let prev: string | null = null;
  let since: Date | null = null;
  for (const row of sorted) {
    const plan = parsePlanId(row.plan);
    if (!plan) continue;
    if (prev !== null && prev !== plan && plan === current) {
      since = row.createdAt;
    }
    prev = plan;
  }
  return since;
}

/** Excess runs past softCap, summed across brand×week buckets in the month. */
export function countRechecksFromBrandWeekBuckets(
  rows: Array<{ brandId: string; createdAt: Date }>,
  softCap: number,
): number {
  const byBrandWeek = new Map<string, number>();
  for (const row of rows) {
    const week = startOfWeek(row.createdAt).toISOString();
    const key = `${row.brandId}:${week}`;
    byBrandWeek.set(key, (byBrandWeek.get(key) || 0) + 1);
  }
  let used = 0;
  for (const weeklyCount of byBrandWeek.values()) {
    used += Math.max(0, weeklyCount - softCap);
  }
  return used;
}

export type PaidRunCapDecision =
  | { allowed: true; warning: string | null; extraRun: false; consumeCredit: boolean }
  | { allowed: false; code: "run_cap"; message: string };

export type UnpaidRunCapDecision =
  | { allowed: true; warning: null; extraRun: false; consumeCredit: false }
  | { allowed: false; code: "trial_run_cap"; message: string };

/** Trial / unpaid: hard stop at TRIAL_RUN_CAP workspace runs. No extras, no unlimited. */
export function decideUnpaidRunCap(trialRuns: number): UnpaidRunCapDecision {
  if (trialRuns >= TRIAL_RUN_CAP) {
    return {
      allowed: false,
      code: "trial_run_cap",
      message: `Trial allows ${TRIAL_RUN_CAP} full run. Upgrade to keep running.`,
    };
  }
  return { allowed: true, warning: null, extraRun: false, consumeCredit: false };
}

/**
 * Pure gate for paid plans after weekly softCap is hit.
 * Monthly re-check credits first, then prepaid extra-run credits; otherwise block
 * until the user buys a $9 extra run (no silent auto-meter for any plan).
 */
export function decidePaidRunCap(args: {
  plan: string | null | undefined;
  brandWeekRunCount: number;
  monthlyRechecksUsed: number;
  extraRunCredits: number;
}): PaidRunCapDecision {
  const softCap = planIncludedRunCap(args.plan);
  const hardCap = planHardStop(args.plan);
  const monthlyAllowance = planMonthlyRecheckCredits(args.plan);
  const planId = parsePlanId(args.plan) ?? "agency";
  const extraUsd = EXTRA_RUN_USD[planId];

  if (args.brandWeekRunCount >= hardCap) {
    return {
      allowed: false,
      code: "run_cap",
      message: `Hard stop: ${hardCap} runs this week for this brand. Try again next week.`,
    };
  }
  if (args.brandWeekRunCount < softCap) {
    return { allowed: true, warning: null, extraRun: false, consumeCredit: false };
  }
  if (monthlyAllowance > 0 && args.monthlyRechecksUsed < monthlyAllowance) {
    return {
      allowed: true,
      warning: `Using included monthly re-check ${args.monthlyRechecksUsed + 1}/${monthlyAllowance}.`,
      extraRun: false,
      consumeCredit: false,
    };
  }
  if (args.extraRunCredits > 0) {
    return {
      allowed: true,
      warning: "Using a prepaid extra-run credit.",
      extraRun: false,
      consumeCredit: true,
    };
  }
  return {
    allowed: false,
    code: "run_cap",
    message: `Past included runs and monthly re-check credits. Buy an extra run ($${extraUsd}) to continue.`,
  };
}

export async function getWorkspaceSubscription(db: Database, workspaceId: string) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).limit(1);
  if (!sub) return null;
  // Lazy reconcile: period ended but webhook never flipped status off `active`.
  const nextStatus = expiredPaidStatus(sub);
  if (nextStatus && nextStatus !== sub.status) {
    const now = new Date();
    await db
      .update(subscriptions)
      .set({ status: nextStatus, updatedAt: now })
      .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.status, "active")));
    return { ...sub, status: nextStatus, updatedAt: now };
  }
  return sub;
}

export async function countActiveBrands(db: Database, workspaceId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(brands)
    .where(and(eq(brands.workspaceId, workspaceId), isNull(brands.archivedAt)));
  return Number(row?.count ?? 0);
}

export async function countOccupiedSeats(db: Database, workspaceId: string) {
  const members = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  const now = Date.now();
  const pending = (
    await db
      .select()
      .from(workspaceInvites)
      .where(and(eq(workspaceInvites.workspaceId, workspaceId)))
  ).filter((invite) => invite.acceptedAt == null && invite.expiresAt.getTime() >= now);
  return { members: members.length, pending: pending.length, occupied: members.length + pending.length };
}

export type CapDenial = {
  code: "trial_brand_cap" | "brand_cap" | "trial_run_cap" | "run_cap" | "subscription_ended";
  message: string;
};

export async function assertBrandCap(db: Database, workspaceId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  const count = await countActiveBrands(db, workspaceId);
  const ent = workspaceEntitlements(sub);

  if (count >= ent.brandLimit) {
    const err = new Error(upgradeHintForBrandCap(ent)) as Error & { code: CapDenial["code"] };
    err.code = !ent.paid ? "trial_brand_cap" : "brand_cap";
    throw err;
  }
}

export function capDenialFromError(error: unknown): CapDenial | null {
  if (!(error instanceof Error)) return null;
  const code = (error as Error & { code?: CapDenial["code"] }).code;
  if (
    code === "trial_brand_cap" ||
    code === "brand_cap" ||
    code === "trial_run_cap" ||
    code === "run_cap" ||
    code === "subscription_ended"
  ) {
    return { code, message: error.message };
  }
  return null;
}

export async function assertRunCap(db: Database, workspaceId: string, brandId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  const ent = workspaceEntitlements(sub);

  if (pdfRetentionExpired(sub)) {
    const err = new Error("Subscription ended more than 90 days ago. Reactivate to run again.") as Error & {
      code: CapDenial["code"];
    };
    err.code = "subscription_ended";
    throw err;
  }

  if (!ent.paid) {
    if (ent.ended) {
      const err = new Error(
        "Subscription ended. PDFs stay available for 90 days. Reactivate to run again.",
      ) as Error & { code: CapDenial["code"] };
      err.code = "subscription_ended";
      throw err;
    }
    const workspaceBrands = await db.select({ id: brands.id }).from(brands).where(eq(brands.workspaceId, workspaceId));
    const ids = workspaceBrands.map((row) => row.id);
    let trialRuns = 0;
    if (ids.length > 0) {
      const rows = await db
        .select({ id: runs.id })
        .from(runs)
        .where(and(inArray(runs.brandId, ids), ne(runs.status, "failed")));
      trialRuns = rows.length;
    }
    const trialDecision = decideUnpaidRunCap(trialRuns);
    if (!trialDecision.allowed) {
      const err = new Error(trialDecision.message) as Error & { code: CapDenial["code"] };
      err.code = trialDecision.code;
      throw err;
    }
    return {
      allowed: true as const,
      warning: trialDecision.warning,
      extraRun: trialDecision.extraRun,
      consumeCredit: trialDecision.consumeCredit,
    };
  }

  if (sub?.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) {
    const err = new Error("Subscription ended. PDFs stay available for 90 days. Reactivate to run again.") as Error & {
      code: CapDenial["code"];
    };
    err.code = "subscription_ended";
    throw err;
  }

  const weekStart = startOfWeek();
  const rows = await db
    .select({ id: runs.id, status: runs.status })
    .from(runs)
    .where(and(eq(runs.brandId, brandId), gte(runs.createdAt, weekStart), ne(runs.status, "failed")));

  const planMeteringSince = sub ? await resolvePlanMeteringSince(db, workspaceId, sub) : null;
  const monthlyRechecksUsed = await countMonthlyRechecksUsed(db, workspaceId, sub?.plan, planMeteringSince);
  const decision = decidePaidRunCap({
    plan: sub?.plan,
    brandWeekRunCount: rows.length,
    monthlyRechecksUsed,
    extraRunCredits: sub?.extraRunCredits || 0,
  });

  if (!decision.allowed) {
    const err = new Error(decision.message) as Error & { code: CapDenial["code"] };
    err.code = decision.code;
    throw err;
  }
  return {
    allowed: true as const,
    warning: decision.warning,
    extraRun: decision.extraRun,
    consumeCredit: decision.consumeCredit,
  };
}

/** Attempt counter. Do not pass extraRun=true here — extras settle after a report. */
export async function bumpRunsUsed(db: Database, workspaceId: string, extraRun = false) {
  await db
    .update(subscriptions)
    .set({
      runsUsed: sql`${subscriptions.runsUsed} + 1`,
      ...(extraRun ? { extraRuns: sql`${subscriptions.extraRuns} + 1` } : {}),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.workspaceId, workspaceId));
}

/**
 * When a run ends with no report (`failed`), undo the enqueue-time runsUsed bump
 * so engine outages do not burn monthly attempt display / trust.
 * Soft-cap / recheck math already excludes failed rows via `ne(status, failed)`.
 */
export async function refundFailedRunAttempt(db: Database, workspaceId: string) {
  await db
    .update(subscriptions)
    .set({
      runsUsed: sql`max(${subscriptions.runsUsed} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.workspaceId, workspaceId));
}

/**
 * runsUsed bumps only after a successful enqueue (or local placeholder with no queue).
 * Failed queue sends must not permanently inflate the attempt counter — the run is
 * marked failed and excluded from soft-cap via runCountsTowardCap / ne(failed).
 */
export function shouldBumpRunsUsedAfterEnqueue(
  queue: "sent" | "failed" | "placeholder",
): boolean {
  return queue !== "failed";
}

/** Dodo extra-run meter + extraRuns + prepaid credits settle only after a report exists. */
export function shouldSettleBillableExtra(status: string): boolean {
  return status === "complete" || status === "partial";
}

async function incrementExtraRunsMeter(db: Database, workspaceId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  if (!sub) return;
  await db
    .update(subscriptions)
    .set({
      extraRuns: (sub.extraRuns || 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));
}

/**
 * Charge billable extras after a complete or 3/4-partial report — never on enqueue
 * and never for a run that failed without a report.
 *
 * Included weekly quota is reserved by inserting the run row (assertRunCap counts
 * created runs). runsUsed may increment on start. Dodo usage events, extraRuns,
 * and prepaid extra-run credits wait until a report exists.
 */
export async function settleBillableExtraRun(args: {
  db: Database;
  env: CloudflareEnv;
  workspaceId: string;
  runId: string;
}): Promise<{ settled: boolean; skipped: boolean }> {
  const [run] = await args.db.select().from(runs).where(eq(runs.id, args.runId)).limit(1);
  if (!run || run.billedAt) {
    return { settled: false, skipped: true };
  }
  if (!run.extraRun && !run.consumeCredit) {
    return { settled: false, skipped: true };
  }

  const stamp = new Date();
  // Atomic claim: only the writer that flips null→non-null settles. .returning()
  // is the claim proof (avoids fragile 5 ms equality when D1 coarsens timestamps).
  const claimed = await args.db
    .update(runs)
    .set({ billedAt: stamp })
    .where(and(eq(runs.id, args.runId), isNull(runs.billedAt)))
    .returning({ billedAt: runs.billedAt });
  if (claimed.length === 0 || !wonBilledAtClaim(claimed[0]?.billedAt, stamp)) {
    return { settled: false, skipped: true };
  }

  if (run.consumeCredit) {
    await consumeExtraRunCredit(args.db, args.workspaceId);
  }
  if (run.extraRun) {
    await incrementExtraRunsMeter(args.db, args.workspaceId);
    const sub = await getWorkspaceSubscription(args.db, args.workspaceId);
    await recordDodoExtraRunUsage({
      env: args.env,
      customerId: sub?.dodoCustomerId,
      workspaceId: args.workspaceId,
      runId: args.runId,
    });
  }
  return { settled: true, skipped: false };
}

export async function consumeExtraRunCredit(db: Database, workspaceId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  if (!sub || (sub.extraRunCredits || 0) <= 0) return false;
  await db
    .update(subscriptions)
    .set({
      extraRunCredits: Math.max(0, (sub.extraRunCredits || 0) - 1),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));
  return true;
}

export async function bumpExtraBrands(db: Database, workspaceId: string, delta = 1) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  if (!sub) return;
  await db
    .update(subscriptions)
    .set({
      extraBrands: Math.max(0, (sub.extraBrands || 0) + delta),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));
}

export async function bumpExtraSeats(db: Database, workspaceId: string, delta = 1) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  if (!sub) return;
  await db
    .update(subscriptions)
    .set({
      extraSeats: Math.max(0, (sub.extraSeats || 0) + delta),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));
}

export async function setPremiumEnginePack(db: Database, workspaceId: string, enabled = true) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  if (!sub) return;
  await db
    .update(subscriptions)
    .set({
      premiumEnginePack: enabled,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));
}

export async function bumpExtraRunCredits(db: Database, workspaceId: string, delta = 1) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  if (!sub) return;
  await db
    .update(subscriptions)
    .set({
      extraRunCredits: Math.max(0, (sub.extraRunCredits || 0) + delta),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));
}

/**
 * Resolve the metering window start for a subscription. Persists inferred
 * planMeteringSince from checkout audits when a mid-period plan change is found
 * and the column is still null (repairs upgrades that predate the column).
 */
export async function resolvePlanMeteringSince(
  db: Database,
  workspaceId: string,
  sub: {
    id: string;
    plan: string;
    planMeteringSince?: Date | null;
    extraRuns?: number | null;
  },
): Promise<Date | null> {
  if (sub.planMeteringSince) return sub.planMeteringSince;

  const checkouts = await db
    .select({
      plan: auditLogs.targetId,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.workspaceId, workspaceId), eq(auditLogs.action, "billing.checkout")))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);

  const inferred = inferPlanMeteringSinceFromCheckouts(checkouts, sub.plan);
  if (!inferred) return null;

  await db
    .update(subscriptions)
    .set({
      planMeteringSince: inferred,
      // Drop stale lifetime extras from the prior plan / silent-extra bug era.
      extraRuns: 0,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));
  return inferred;
}

export async function countMonthlyRechecksUsed(
  db: Database,
  workspaceId: string,
  plan: string | null | undefined,
  planMeteringSince?: Date | null,
) {
  const softCap = planIncludedRunCap(plan);
  const workspaceBrands = await db.select({ id: brands.id }).from(brands).where(eq(brands.workspaceId, workspaceId));
  const ids = workspaceBrands.map((row) => row.id);
  if (ids.length === 0) return 0;
  const windowStart = meteringWindowStart(planMeteringSince);
  const monthRows = await db
    .select({ brandId: runs.brandId, createdAt: runs.createdAt })
    .from(runs)
    .where(and(inArray(runs.brandId, ids), gte(runs.createdAt, windowStart), ne(runs.status, "failed")));
  return countRechecksFromBrandWeekBuckets(monthRows, softCap);
}

/** Settled Dodo-metered extras in the current metering window (not prepaid credits). */
export async function countSettledBillableExtras(
  db: Database,
  workspaceId: string,
  planMeteringSince?: Date | null,
) {
  const workspaceBrands = await db.select({ id: brands.id }).from(brands).where(eq(brands.workspaceId, workspaceId));
  const ids = workspaceBrands.map((row) => row.id);
  if (ids.length === 0) return 0;
  const windowStart = meteringWindowStart(planMeteringSince);
  const rows = await db
    .select({ id: runs.id })
    .from(runs)
    .where(
      and(
        inArray(runs.brandId, ids),
        eq(runs.extraRun, true),
        isNotNull(runs.billedAt),
        gte(runs.createdAt, windowStart),
      ),
    );
  return rows.length;
}

export async function getUsageSnapshot(db: Database, workspaceId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  const ent = workspaceEntitlements(sub);
  const brandsUsed = await countActiveBrands(db, workspaceId);
  const seats = await countOccupiedSeats(db, workspaceId);
  const planMeteringSince = sub
    ? await resolvePlanMeteringSince(db, workspaceId, sub)
    : null;
  const monthlyRechecksUsed = ent.paid
    ? await countMonthlyRechecksUsed(db, workspaceId, sub?.plan, planMeteringSince)
    : 0;
  const monthlyRechecksRemaining = Math.max(0, ent.monthlyRecheckCredits - monthlyRechecksUsed);
  const billableExtrasThisPeriod = ent.paid
    ? await countSettledBillableExtras(db, workspaceId, planMeteringSince)
    : 0;
  return {
    plan: ent.plan,
    status: sub?.status || "none",
    paid: ent.paid,
    trialing: ent.trialing,
    billingInterval: ent.billingInterval,
    brandsUsed,
    brandLimit: ent.brandLimit,
    brandsIncluded: ent.paid ? ent.brandLimit - ent.extraBrands : ent.brandLimit,
    extraBrands: ent.extraBrands,
    extraBrandBillable: ent.extraBrands,
    seatsUsed: seats.occupied,
    seatCap: ent.seatCap,
    seatsIncluded: ent.paid ? ent.seatCap - ent.extraSeats : ent.seatCap,
    extraSeats: ent.extraSeats,
    runsUsed: sub?.runsUsed || 0,
    /** Settled billable extras in the current plan metering window (UI). */
    extraRuns: billableExtrasThisPeriod,
    extraRunCredits: ent.extraRunCredits,
    monthlyRecheckCredits: ent.monthlyRecheckCredits,
    monthlyRechecksUsed,
    monthlyRechecksRemaining,
    planMeteringSince: planMeteringSince ?? null,
    trialEndsAt: sub?.trialEndsAt ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    dodoCustomerId: sub?.dodoCustomerId ?? null,
    allowsExtraBrands: ent.allowsExtraBrands,
    allowsMembers: ent.allowsMembers,
    allowsWeeklyCadence: ent.allowsWeeklyCadence,
    allowsCustomSender: ent.allowsCustomSender,
    allowsClientCc: ent.allowsClientCc,
    allowsTrialClientCc: ent.allowsTrialClientCc,
  };
}

export { isPaidActive, isTrialing };
