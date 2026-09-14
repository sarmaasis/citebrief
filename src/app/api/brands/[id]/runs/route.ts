import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, isNull } from "drizzle-orm";
import { scheduledEngineStatus } from "@/lib/engines";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { assertRunCap, bumpRunsUsed, capDenialFromError, getWorkspaceSubscription } from "@/lib/usage";
import { formatWeekOf } from "@/lib/friday";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";
import { getWorkspaceBrand } from "@/server/workspace-data";
import { prompts, runs, workspaces } from "@/db/schema";
import { resolveRunEngines } from "@/lib/plan-engines";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const { id } = await context.params;
  const brand = await getWorkspaceBrand(ctx, id);
  if (!brand) {
    return jsonError("Brand not found.", 404);
  }
  if (brand.archivedAt) {
    return jsonError("Archived brands cannot run.");
  }

  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.runCreate, ctx.workspace.id);
  if (limited) return limited;

  const promptRows = await ctx.db
    .select()
    .from(prompts)
    .where(and(eq(prompts.brandId, id), isNull(prompts.archivedAt)));
  if (promptRows.length === 0) {
    const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
    const cap = workspaceEntitlements(sub).promptCap;
    return jsonError(`Generate ${cap} buyer questions before you run.`);
  }

  let extraRun = false;
  let consumeCredit = false;
  try {
    const cap = await assertRunCap(ctx.db, ctx.workspace.id, id);
    extraRun = Boolean(cap.extraRun);
    consumeCredit = Boolean(cap.consumeCredit);
    if (cap.warning) {
      console.info("[runs] cap warning", cap.warning);
    }
  } catch (error) {
    const denial = capDenialFromError(error);
    return jsonError(error instanceof Error ? error.message : "Run cap reached.", 402, {
      code: denial?.code ?? "run_cap",
    });
  }

  const now = new Date();
  const runId = crypto.randomUUID();
  const payload = {
    runId,
    brandId: id,
    workspaceId: ctx.workspace.id,
    queuedAt: now.toISOString(),
  };

  const [workspaceRow] = await ctx.db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspace.id))
    .limit(1);
  const resolved = await resolveRunEngines({
    db: ctx.db,
    workspaceId: ctx.workspace.id,
    defaultEngines: workspaceRow?.defaultEngines,
    env,
  });

  const engineStates = scheduledEngineStatus(resolved.engines.map((engine) => engine.id));

  // Insert before enqueue so the queue consumer can load the row.
  await ctx.db.insert(runs).values({
    id: runId,
    brandId: id,
    status: "queued",
    periodStart: formatWeekOf(now),
    periodEnd: formatWeekOf(now),
    engineStates: JSON.stringify(engineStates),
    extraRun,
    consumeCredit,
    createdAt: now,
  });

  // Weekly included quota is reserved by the inserted row. Attempt counter
  // increments here; Dodo extra-run meter + extraRuns + prepaid credits wait
  // until a report exists (settleBillableExtraRun in processRun).
  await bumpRunsUsed(ctx.db, ctx.workspace.id, false);

  let queue = "placeholder";
  if (env.RUNS_QUEUE) {
    try {
      await env.RUNS_QUEUE.send(payload);
      queue = "sent";
    } catch (error) {
      console.error("[runs] enqueue failed after insert", runId, error);
      await ctx.db
        .update(runs)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(runs.id, runId));
      queue = "failed";
    }
  }

  return jsonOk({ runId, queue, payload, extraRun, consumeCredit, engines: engineStates }, 201);
}
