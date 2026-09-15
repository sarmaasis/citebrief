import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { isCoreEngine, type EngineId } from "@/lib/engines";
import { guardInternalRoute } from "@/lib/internal-guard";
import { handleRunQueueMessage } from "@/lib/run-queue";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/**
 * Queue consumer stand-in. POST { runId, engineId? }.
 * Protected by INTERNAL_PROCESS_SECRET (required outside development).
 */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await guardInternalRoute(request, env, "INTERNAL_PROCESS_SECRET");
  if (denied) {
    return denied;
  }

  let body: { runId?: string; engineId?: string; notifyEmail?: string };
  try {
    body = (await request.json()) as { runId?: string; engineId?: string; notifyEmail?: string };
  } catch {
    return jsonError("Invalid JSON body.");
  }
  if (!body.runId) {
    return jsonError("runId is required.");
  }
  const engineId =
    body.engineId && isCoreEngine(body.engineId) ? (body.engineId as EngineId) : undefined;

  try {
    const db = await getDb();
    const result = await handleRunQueueMessage(db, env, {
      runId: body.runId,
      engineId,
      notifyEmail: body.notifyEmail,
    });
    return jsonOk(result);
  } catch (error) {
    console.error("[internal/process-run]", error);
    return jsonError(error instanceof Error ? error.message : "Process failed.", 500);
  }
}
