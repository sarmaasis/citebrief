import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CORE_ENGINES, isStudioEngine, parseEngineStatus, type EngineId } from "@/lib/engines";
import { retryFailedEngine } from "@/lib/run-processor";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";
import { brands, reports, runs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getWorkspaceSubscription } from "@/lib/usage";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { engine?: string };
  const engine = body.engine?.trim().toLowerCase() as EngineId | undefined;
  if (!engine) return jsonError("engine is required.");

  const [row] = await ctx.db
    .select({ run: runs, workspaceId: brands.workspaceId })
    .from(runs)
    .innerJoin(brands, eq(brands.id, runs.brandId))
    .where(and(eq(runs.id, id), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) return jsonError("Run not found.", 404);

  const states = parseEngineStatus(row.run.engineStates);
  if (states[engine] !== "failed") {
    return jsonError("Only a failed engine can be retried.");
  }

  if (isStudioEngine(engine)) {
    const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
    const ent = workspaceEntitlements(sub);
    if (!ent.allowsStudioEngines) {
      return jsonError("Claude and Grok require Studio.", 403);
    }
  } else if (!CORE_ENGINES.some((item) => item.id === engine)) {
    return jsonError("Unknown engine.");
  }

  const { env } = await getCloudflareContext({ async: true });
  try {
    const result = await retryFailedEngine(ctx.db, env, id, engine);
    const [existing] = result.reportId
      ? await ctx.db
          .select({ approvalState: reports.approvalState })
          .from(reports)
          .where(eq(reports.id, result.reportId))
          .limit(1)
      : [];
    return jsonOk({ ...result, approvalState: existing?.approvalState ?? null });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Retry failed.", 500);
  }
}
