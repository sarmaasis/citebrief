import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { parseEngineStatus } from "@/lib/engines";
import { processRun } from "@/lib/run-processor";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";
import { brands, reports, runs } from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const { id } = await context.params;

  const [row] = await ctx.db
    .select({
      run: runs,
      workspaceId: brands.workspaceId,
    })
    .from(runs)
    .innerJoin(brands, eq(brands.id, runs.brandId))
    .where(and(eq(runs.id, id), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);

  if (!row) {
    return jsonError("Run not found.", 404);
  }

  let status = row.run.status;
  let engines = parseEngineStatus(row.run.engineStates);
  let reportId: string | null = null;
  let scoreMentioned: number | null = null;
  let scoreRecommended: number | null = null;

  if (status === "queued" || status === "running") {
    try {
      const { env } = await getCloudflareContext({ async: true });
      const result = await processRun(ctx.db, env, id, { notifyEmail: ctx.user.email });
      status = result.status;
      engines = result.engines;
      reportId = result.reportId;
      scoreMentioned = result.scoreMentioned;
    } catch (error) {
      console.error("[api/runs] process failed", error);
      return jsonError("Could not process this run.", 500);
    }
  } else {
    const [existing] = await ctx.db.select().from(reports).where(eq(reports.runId, id)).limit(1);
    reportId = existing?.id ?? null;
    scoreMentioned = existing?.scoreMentioned ?? null;
    scoreRecommended = existing?.scoreRecommended ?? null;
  }

  return jsonOk({
    id,
    brandId: row.run.brandId,
    status,
    engines,
    periodStart: row.run.periodStart,
    completedAt: row.run.completedAt,
    reportId,
    scoreMentioned,
    scoreRecommended,
  });
}
