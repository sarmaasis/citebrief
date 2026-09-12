import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { processRun } from "@/lib/run-processor";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/**
 * Queue consumer stand-in. POST { runId }.
 * When a dedicated Worker consumer exists, point RUNS_QUEUE here or call processRun directly.
 */
export async function POST(request: Request) {
  let body: { runId?: string; notifyEmail?: string };
  try {
    body = (await request.json()) as { runId?: string; notifyEmail?: string };
  } catch {
    return jsonError("Invalid JSON body.");
  }
  if (!body.runId) {
    return jsonError("runId is required.");
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = await getDb();
    const result = await processRun(db, env, body.runId, { notifyEmail: body.notifyEmail });
    return jsonOk(result);
  } catch (error) {
    console.error("[internal/process-run]", error);
    return jsonError(error instanceof Error ? error.message : "Process failed.", 500);
  }
}
