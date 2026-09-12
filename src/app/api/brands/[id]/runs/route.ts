import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { emptyEngineStatus } from "@/lib/engines";
import { assertRunCap, bumpRunsUsed, getWorkspaceSubscription } from "@/lib/usage";
import { recordDodoExtraRunUsage } from "@/lib/dodo";
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
  try {
    const cap = await assertRunCap(ctx.db, ctx.workspace.id, id);
    extraRun = Boolean(cap.extraRun);
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

  let queue = "placeholder";
  const { env } = await getCloudflareContext({ async: true });
  try {
    if (env.RUNS_QUEUE) {
      await env.RUNS_QUEUE.send(payload);
      queue = "sent";
    }
  } catch {
    queue = "placeholder";
  }

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

  await ctx.db.insert(runs).values({
    id: runId,
    brandId: id,
    status: "queued",
    periodStart: formatWeekOf(now),
    periodEnd: formatWeekOf(now),
    engineStates: JSON.stringify(emptyEngineStatus(resolved.includeStudio)),
    createdAt: now,
  });

  await bumpRunsUsed(ctx.db, ctx.workspace.id, extraRun);
  if (extraRun) {
    const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
    await recordDodoExtraRunUsage({
      env,
      customerId: sub?.dodoCustomerId,
      workspaceId: ctx.workspace.id,
      runId,
    });
  }

  return jsonOk({ runId, queue, payload, extraRun }, 201);
}
