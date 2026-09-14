import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { brands, runs, subscriptions, workspaceInvites, workspaceMembers } from "@/db/schema";
import { planHardStop, planIncludedRunCap, planMonthlyRecheckCredits, TRIAL_RUN_CAP } from "@/lib/billing";
import { recordDodoExtraRunUsage } from "@/lib/dodo";
import {
  isPaidActive,
  isTrialing,
  pdfRetentionExpired,
  upgradeHintForBrandCap,
  workspaceEntitlements,
} from "@/lib/entitlements";

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

export async function getWorkspaceSubscription(db: Database, workspaceId: string) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).limit(1);
  return sub ?? null;
}

export async function countActiveBrands(db: Database, workspaceId: string) {
  const active = await db.select().from(brands).where(eq(brands.workspaceId, workspaceId));
  return active.filter((row) => !row.archivedAt).length;
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
      const rows = await db.select({ id: runs.id }).from(runs).where(inArray(runs.brandId, ids));
      trialRuns = rows.length;
    }
    if (trialRuns >= TRIAL_RUN_CAP) {
      const err = new Error(`Trial allows ${TRIAL_RUN_CAP} full run. Upgrade to keep running.`) as Error & {
        code: CapDenial["code"];
      };
      err.code = "trial_run_cap";
      throw err;
    }
    return { allowed: true as const, warning: null, extraRun: false, consumeCredit: false };
  }

  if (sub?.cancelAtPeriodEnd && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) {
    const err = new Error("Subscription ended. PDFs stay available for 90 days. Reactivate to run again.") as Error & {
      code: CapDenial["code"];
    };
    err.code = "subscription_ended";
    throw err;
  }

  const weekStart = startOfWeek();
  const rows = await db
    .select()
    .from(runs)
    .where(and(eq(runs.brandId, brandId), gte(runs.createdAt, weekStart)));

  const count = rows.length;
  const softCap = planIncludedRunCap(sub?.plan);
  const hardCap = planHardStop(sub?.plan);

  if (count >= hardCap) {
    const err = new Error(`Hard stop: ${hardCap} runs this week for this brand. Try again next week.`) as Error & {
      code: CapDenial["code"];
    };
    err.code = "run_cap";
    throw err;
  }
  if (count >= softCap) {
    const monthlyAllowance = planMonthlyRecheckCredits(sub?.plan);
    if (monthlyAllowance > 0) {
      const workspaceBrands = await db.select({ id: brands.id }).from(brands).where(eq(brands.workspaceId, workspaceId));
      const ids = workspaceBrands.map((row) => row.id);
      let includedMonthlyRechecks = 0;
      if (ids.length > 0) {
        const monthRows = await db
          .select({ brandId: runs.brandId, createdAt: runs.createdAt })
          .from(runs)
          .where(and(inArray(runs.brandId, ids), gte(runs.createdAt, startOfMonth())));
        const byBrandWeek = new Map<string, number>();
        for (const row of monthRows) {
          const week = startOfWeek(row.createdAt).toISOString();
          const key = `${row.brandId}:${week}`;
          byBrandWeek.set(key, (byBrandWeek.get(key) || 0) + 1);
        }
        for (const weeklyCount of byBrandWeek.values()) {
          includedMonthlyRechecks += Math.max(0, weeklyCount - softCap);
        }
      }
      if (includedMonthlyRechecks < monthlyAllowance) {
        return {
          allowed: true as const,
          warning: `Using included monthly re-check ${includedMonthlyRechecks + 1}/${monthlyAllowance}.`,
          extraRun: false,
          consumeCredit: false,
        };
      }
    }
    if ((sub?.extraRunCredits || 0) > 0) {
      return {
        allowed: true as const,
        warning: "Using a prepaid extra-run credit.",
        extraRun: false,
        consumeCredit: true,
      };
    }
    return {
      allowed: true as const,
      warning: `Past included ${softCap} run${softCap === 1 ? "" : "s"} this week. Extra run will be metered.`,
      extraRun: true,
      consumeCredit: false,
    };
  }
  return { allowed: true as const, warning: null, extraRun: false, consumeCredit: false };
}

/** Attempt counter. Do not pass extraRun=true here — extras settle after a report. */
export async function bumpRunsUsed(db: Database, workspaceId: string, extraRun = false) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  if (!sub) return;
  await db
    .update(subscriptions)
    .set({
      runsUsed: (sub.runsUsed || 0) + 1,
      extraRuns: extraRun ? (sub.extraRuns || 0) + 1 : sub.extraRuns || 0,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));
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
  await args.db
    .update(runs)
    .set({ billedAt: stamp })
    .where(and(eq(runs.id, args.runId), isNull(runs.billedAt)));
  const [claimed] = await args.db.select().from(runs).where(eq(runs.id, args.runId)).limit(1);
  if (!claimed?.billedAt || Math.abs(claimed.billedAt.getTime() - stamp.getTime()) > 5) {
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

export async function countMonthlyRechecksUsed(db: Database, workspaceId: string, plan: string | null | undefined) {
  const softCap = planIncludedRunCap(plan);
  const workspaceBrands = await db.select({ id: brands.id }).from(brands).where(eq(brands.workspaceId, workspaceId));
  const ids = workspaceBrands.map((row) => row.id);
  if (ids.length === 0) return 0;
  const monthRows = await db
    .select({ brandId: runs.brandId, createdAt: runs.createdAt })
    .from(runs)
    .where(and(inArray(runs.brandId, ids), gte(runs.createdAt, startOfMonth())));
  const byBrandWeek = new Map<string, number>();
  for (const row of monthRows) {
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

export async function getUsageSnapshot(db: Database, workspaceId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  const ent = workspaceEntitlements(sub);
  const brandsUsed = await countActiveBrands(db, workspaceId);
  const seats = await countOccupiedSeats(db, workspaceId);
  const monthlyRechecksUsed = ent.paid ? await countMonthlyRechecksUsed(db, workspaceId, sub?.plan) : 0;
  const monthlyRechecksRemaining = Math.max(0, ent.monthlyRecheckCredits - monthlyRechecksUsed);
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
    extraRuns: sub?.extraRuns || 0,
    extraRunCredits: ent.extraRunCredits,
    monthlyRecheckCredits: ent.monthlyRecheckCredits,
    monthlyRechecksUsed,
    monthlyRechecksRemaining,
    trialEndsAt: sub?.trialEndsAt ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    dodoCustomerId: sub?.dodoCustomerId ?? null,
    allowsExtraBrands: ent.allowsExtraBrands,
    allowsMembers: ent.allowsMembers,
    allowsWeeklyCadence: ent.allowsWeeklyCadence,
    allowsCustomSender: ent.allowsCustomSender,
    allowsClientCc: ent.allowsClientCc,
  };
}

export { isPaidActive, isTrialing };
