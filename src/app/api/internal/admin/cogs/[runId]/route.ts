import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { prompts, runs } from "@/db/schema";
import { getDb } from "@/db";
import { estimateRunCogs } from "@/lib/cogs";
import { guardInternalRoute } from "@/lib/internal-guard";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await guardInternalRoute(request, env, "INTERNAL_ADMIN_SECRET");
  if (denied) return denied;

  const { runId } = await context.params;
  const db = await getDb();
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) return jsonError("Run not found.", 404);
  const promptRows = await db.select().from(prompts).where(eq(prompts.brandId, run.brandId));
  let engineStates: Record<string, string> = {};
  try {
    engineStates = JSON.parse(run.engineStates || "{}") as Record<string, string>;
  } catch {
    engineStates = {};
  }
  const estimate = estimateRunCogs({
    runId,
    promptCount: promptRows.length || 20,
    engineStates,
  });
  return jsonOk(estimate);
}
