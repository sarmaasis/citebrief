import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { brands, prompts, runs, users, workspaceMembers, workspaces } from "@/db/schema";
import { emptyEngineStatus } from "@/lib/engines";
import { formatWeekOf } from "@/lib/friday";
import { isLocalFirstFridaySix, isLocalFridaySix } from "@/lib/friday-tz";
import { fridayQueuedEmail } from "@/emails";
import { sendTransactionalEmail } from "@/lib/email";
import { workspaceEntitlements } from "@/lib/entitlements";
import { postSlackIncomingWebhook } from "@/lib/slack";
import { getWorkspaceSubscription } from "@/lib/usage";

const FALLBACK_NOTIFY_EMAIL = "agency@getcitebrief.com";

/** Prefer workspace owner email for Friday notify; fallback only if missing. */
async function ownerNotifyEmail(db: Database, workspaceId: string): Promise<string> {
  const [owner] = await db
    .select({ email: users.email })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, "owner")))
    .limit(1);
  const email = owner?.email?.trim();
  return email || FALLBACK_NOTIFY_EMAIL;
}

export type FridayCronOptions = {
  /** When true, ignore local Friday 06:00 window (manual / local testing). */
  force?: boolean;
  now?: Date;
};

/**
 * Friday cron: enqueue one run per active brand whose workspace timezone
 * is currently Friday 06:00 local (hourly trigger). Not a single UTC stub.
 */
export async function runFridayCron(db: Database, env: CloudflareEnv, options: FridayCronOptions = {}) {
  const now = options.now ?? new Date();
  const allWorkspaces = await db.select().from(workspaces);
  const results: Array<{ workspaceId: string; brandId: string; runId: string; timezone: string }> = [];
  const skipped: Array<{ workspaceId: string; reason: string }> = [];

  for (const workspace of allWorkspaces) {
    const tz = workspace.timezone || "America/New_York";
    if (!options.force && !isLocalFridaySix(tz, now)) {
      skipped.push({ workspaceId: workspace.id, reason: `not Friday 06:00 in ${tz}` });
      continue;
    }

    const sub = await getWorkspaceSubscription(db, workspace.id);
    const ent = workspaceEntitlements(sub, now.getTime());
    if (!ent.paid && !options.force) {
      skipped.push({
        workspaceId: workspace.id,
        reason: ent.trialing ? "trial has no recurring Friday send" : "unpaid workspace",
      });
      continue;
    }
    if (ent.allowsMonthlyCadence && !ent.allowsWeeklyCadence) {
      if (!options.force && !isLocalFirstFridaySix(tz, now)) {
        skipped.push({ workspaceId: workspace.id, reason: `Starter monthly: not first Friday 06:00 in ${tz}` });
        continue;
      }
    } else if (!ent.allowsWeeklyCadence) {
      skipped.push({ workspaceId: workspace.id, reason: "plan does not include Friday cadence" });
      continue;
    }

    const notifyTo = await ownerNotifyEmail(db, workspace.id);

    const activeBrands = await db
      .select()
      .from(brands)
      .where(and(eq(brands.workspaceId, workspace.id), isNull(brands.archivedAt)));

    for (const brand of activeBrands) {
      const promptRows = await db.select().from(prompts).where(eq(prompts.brandId, brand.id));
      if (promptRows.length === 0) {
        skipped.push({ workspaceId: workspace.id, reason: `brand ${brand.id} has no prompts` });
        continue;
      }

      const week = formatWeekOf(now);
      const [existing] = await db
        .select()
        .from(runs)
        .where(and(eq(runs.brandId, brand.id), eq(runs.periodStart, week)))
        .limit(1);
      if (existing && !options.force) {
        skipped.push({ workspaceId: workspace.id, reason: `brand ${brand.id} already has week ${week}` });
        continue;
      }

      const runId = crypto.randomUUID();
      await db.insert(runs).values({
        id: runId,
        brandId: brand.id,
        status: "queued",
        periodStart: week,
        periodEnd: week,
        engineStates: JSON.stringify(emptyEngineStatus()),
        createdAt: now,
      });

      let queued = false;
      try {
        if (env.RUNS_QUEUE) {
          await env.RUNS_QUEUE.send({
            runId,
            brandId: brand.id,
            workspaceId: workspace.id,
            source: "friday-cron",
          });
          queued = true;
        }
      } catch (error) {
        console.info("[friday-cron] queue send failed; caller may process inline", error);
      }

      // Local/dev without a consumer: process via internal path is preferred.
      // Production consumer picks up the queue message. Avoid double-process when queued.
      if (!queued) {
        const { processRun } = await import("@/lib/run-processor");
        await processRun(db, env, runId);
      }

      if (ent.allowsEmailSend) {
        const origin = (env.BETTER_AUTH_URL || "").replace(/\/$/, "");
        const mail = fridayQueuedEmail({
          brandName: brand.name,
          workspaceName: workspace.name,
          timezone: tz,
          runId,
          url: origin ? `${origin}/app/brands/${brand.id}` : undefined,
        });
        await sendTransactionalEmail({
          to: notifyTo,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          env,
        });
      }

      try {
        if (ent.allowsSlack && workspace.slackWebhookUrl) {
          await postSlackIncomingWebhook({
            webhookUrl: workspace.slackWebhookUrl,
            text: `CiteBrief Friday: queued ${brand.name} (${tz}).`,
          });
        }
      } catch (error) {
        console.info("[friday-cron] slack skipped", error);
      }

      results.push({ workspaceId: workspace.id, brandId: brand.id, runId, timezone: tz });
    }
  }

  return { processed: results.length, results, skipped: skipped.slice(0, 50), force: Boolean(options.force) };
}
