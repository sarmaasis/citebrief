import type { Database } from "@/db";
import type { EngineId } from "@/lib/engines";
import {
  nextPendingEngineId,
  processRun,
  processRunEngineJob,
  startOrContinueRunQueue,
  type ProcessRunResult,
} from "@/lib/run-processor";

/** Queue body for citebrief-runs. Orchestrator has no engineId; engine jobs set engineId. */
export type RunQueueMessage = {
  runId?: string;
  engineId?: EngineId;
  brandId?: string;
  workspaceId?: string;
  notifyEmail?: string | null;
  source?: string;
};

/** Entry for worker.ts — one engine per message after fan-out. */
export async function handleRunQueueMessage(
  db: Database,
  env: CloudflareEnv,
  body: RunQueueMessage,
): Promise<ProcessRunResult> {
  if (!body.runId) throw new Error("runId required");
  if (!env.RUNS_QUEUE) {
    return processRun(db, env, body.runId, { notifyEmail: body.notifyEmail });
  }
  if (!body.engineId) {
    return startOrContinueRunQueue(db, env, body.runId, body.notifyEmail);
  }
  return processRunEngineJob(db, env, body.runId, body.engineId, {
    notifyEmail: body.notifyEmail,
  });
}

export { nextPendingEngineId };
