import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { brands, prompts, runs, workspaces } from "@/db/schema";
import { emptyEngineStatus } from "@/lib/engines";
import { formatWeekOf } from "@/lib/friday";
import { sendTransactionalEmail } from "@/lib/email";
import { processRun } from "@/lib/run-processor";

/**
 * Friday cron stub: enqueue/process one run per active brand.
 * Wrangler cron can hit POST /api/cron/friday.
 */
export async function runFridayCron(db: Database, env: CloudflareEnv) {
  const allWorkspaces = await db.select().from(workspaces);
  const results: Array<{ workspaceId: string; brandId: string; runId: string }> = [];

  for (const workspace of allWorkspaces) {
    const activeBrands = await db
      .select()
      .from(brands)
      .where(and(eq(brands.workspaceId, workspace.id), isNull(brands.archivedAt)));

    for (const brand of activeBrands) {
      const promptRows = await db.select().from(prompts).where(eq(prompts.brandId, brand.id));
      if (promptRows.length === 0) continue;

      const runId = crypto.randomUUID();
      const now = new Date();
      await db.insert(runs).values({
        id: runId,
        brandId: brand.id,
        status: "queued",
        periodStart: formatWeekOf(now),
        periodEnd: formatWeekOf(now),
        engineStates: JSON.stringify(emptyEngineStatus()),
        createdAt: now,
      });

      try {
        if (env.RUNS_QUEUE) {
          await env.RUNS_QUEUE.send({ runId, brandId: brand.id, workspaceId: workspace.id, source: "friday-cron" });
        }
      } catch {
        // continue; process inline
      }

      await processRun(db, env, runId);

      await sendTransactionalEmail({
        to: "agency@getcitebrief.com",
        subject: `[cron stub] ${brand.name} Friday report`,
        html: `<p>Friday cron stub processed ${brand.name} for ${workspace.name} (${workspace.timezone}).</p>`,
        env,
      });

      results.push({ workspaceId: workspace.id, brandId: brand.id, runId });
    }
  }

  return { processed: results.length, results };
}
