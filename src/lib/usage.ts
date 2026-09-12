import { and, eq, gte } from "drizzle-orm";
import type { Database } from "@/db";
import { brands, runs, subscriptions } from "@/db/schema";
import { planBrandLimit, planHardStop, planManualRerunCap } from "@/lib/billing";

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

export async function assertBrandCap(db: Database, workspaceId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  const limit = planBrandLimit(sub?.plan);
  const active = await db
    .select()
    .from(brands)
    .where(and(eq(brands.workspaceId, workspaceId)));
  const count = active.filter((row) => !row.archivedAt).length;
  if (count >= limit) {
    throw new Error(`Plan cap: ${limit} brands on ${sub?.plan || "agency"}. Upgrade to add more.`);
  }
}

export async function assertRunCap(db: Database, workspaceId: string, brandId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
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
    // Still allow until hard stop, but surface guidance via error? Product: 2 manual re-runs on Agency.
    // Soft message by throwing only at hard stop; return warning instead.
    return { allowed: true as const, warning: `You are past the included ${softCap} runs this week.` };
  }
  return { allowed: true as const, warning: null };
}

export async function bumpRunsUsed(db: Database, workspaceId: string) {
  const sub = await getWorkspaceSubscription(db, workspaceId);
  if (!sub) return;
  await db
    .update(subscriptions)
    .set({ runsUsed: (sub.runsUsed || 0) + 1, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));
}
