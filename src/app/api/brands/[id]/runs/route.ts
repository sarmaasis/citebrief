import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { emptyEngineStatus } from "@/lib/engines";
import { assertRunCap, bumpRunsUsed } from "@/lib/usage";
import { formatWeekOf } from "@/lib/friday";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";
import { getWorkspaceBrand } from "@/server/workspace-data";
import { prompts, runs, workspaces } from "@/db/schema";
import { resolveRunEngines } from "@/lib/plan-engines";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
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

  const promptRows = await ctx.db.select().from(prompts).where(eq(prompts.brandId, id));
  if (promptRows.length === 0) {
    return jsonError("Generate twenty buyer questions before you run.");
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
    return jsonError(error instanceof Error ? error.message : "Run cap reached.", 402);
  }

  const now = new Date();
  const runId = crypto.randomUUID();
  const payload = {
    runId,
    brandId: id,
    workspaceId: ctx.workspace.id,
    queuedAt: now.toISOString(),
  };

  const { env } = await getCloudflareContext({ async: true });
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

  // Insert before enqueue so the queue consumer can load the row.
  await ctx.db.insert(runs).values({
    id: runId,
    brandId: id,
    status: "queued",
    periodStart: formatWeekOf(now),
    periodEnd: formatWeekOf(now),
    engineStates: JSON.stringify(emptyEngineStatus(resolved.includeStudio)),
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

  return jsonOk({ runId, queue, payload, extraRun }, 201);
}
