import { and, eq, gte, inArray } from "drizzle-orm";
import type { Database } from "@/db";
import { brands, runs, subscriptions } from "@/db/schema";
import {
  planBrandLimit,
  planHardStop,
  planManualRerunCap,
  TRIAL_BRAND_CAP,
  TRIAL_RUN_CAP,
} from "@/lib/billing";

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayDelta);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function getWorkspaceSubscription(db: Database, workspaceId: string) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).limit(1);
  return sub ?? null;
}

function isTrialing(sub: { status: string; trialEndsAt: Date | null } | null) {
  if (!sub) return false;
  if (sub.status !== "trialing") return false;
  if (sub.trialEndsAt && sub.trialEndsAt.getTime() < Date.now()) return false;
  return true;
}

export async function assertBrandCap(db: Database, workspaceId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  const active = await db.select().from(brands).where(eq(brands.workspaceId, workspaceId));
  const count = active.filter((row) => !row.archivedAt).length;

  if (isTrialing(sub) && count >= TRIAL_BRAND_CAP) {
    throw new Error(`Trial allows ${TRIAL_BRAND_CAP} brand. Upgrade to add more.`);
  }

  const limit = planBrandLimit(sub?.plan, sub?.extraBrands || 0);
  if (count >= limit) {
    throw new Error(
      `Plan cap: ${limit} brands on ${sub?.plan || "agency"} (includes ${sub?.extraBrands || 0} extra). Upgrade or buy an extra brand.`,
    );
  }
}

export async function assertRunCap(db: Database, workspaceId: string, brandId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);

  if (isTrialing(sub)) {
    const workspaceBrands = await db.select({ id: brands.id }).from(brands).where(eq(brands.workspaceId, workspaceId));
    const ids = workspaceBrands.map((row) => row.id);
    let trialRuns = 0;
    if (ids.length > 0) {
      const rows = await db.select({ id: runs.id }).from(runs).where(inArray(runs.brandId, ids));
      trialRuns = rows.length;
    }
    if (trialRuns >= TRIAL_RUN_CAP) {
      throw new Error(`Trial allows ${TRIAL_RUN_CAP} full run. Upgrade to keep running.`);
    }
    return { allowed: true as const, warning: null, extraRun: false };
  }

  if (sub?.cancelAtPeriodEnd && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) {
    throw new Error("Subscription ended. PDFs stay available for 90 days. Reactivate to run again.");
  }

  const weekStart = startOfWeek();
  const rows = await db
    .select()
    .from(runs)
    .where(and(eq(runs.brandId, brandId), gte(runs.createdAt, weekStart)));

  const count = rows.length;
  const softCap = 1 + planManualRerunCap(sub?.plan);
  const hardCap = planHardStop(sub?.plan);

  if (count >= hardCap) {
    throw new Error(`Hard stop: ${hardCap} runs this week for this brand. Try again next week.`);
  }
  if (count >= softCap) {
    return {
      allowed: true as const,
      warning: `Past included ${softCap} runs this week. Extra run will be metered.`,
      extraRun: true,
    };
  }
  return { allowed: true as const, warning: null, extraRun: false };
}

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
