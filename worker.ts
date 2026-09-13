// Custom OpenNext Worker: fetch + Queue consumer + scheduled Friday cron.
// @ts-expect-error `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { dbFromEnv } from "./src/db";
import { runFridayCron } from "./src/lib/cron-friday";
import { processRun } from "./src/lib/run-processor";
import { canonicalRedirectLocation, logProductionSecretProblems } from "./src/lib/runtime-env";
import { applySecurityHeaders, canonicalRedirectResponse } from "./src/lib/security-headers";

export type RunQueueMessage = {
  runId?: string;
  brandId?: string;
  workspaceId?: string;
  notifyEmail?: string | null;
  source?: string;
};

export default {
  async fetch(request, env, ctx) {
    const location = canonicalRedirectLocation(request);
    if (location) return canonicalRedirectResponse(location);
    const response = await handler.fetch(request, env, ctx);
    return applySecurityHeaders(response);
  },

  async queue(batch, env): Promise<void> {
    logProductionSecretProblems(env);
    const db = dbFromEnv(env);
    for (const message of batch.messages) {
      const body = (message.body || {}) as RunQueueMessage;
      if (!body.runId) {
        console.info("[queue] skip message without runId", message.id);
        message.ack();
        continue;
      }
      try {
        await processRun(db, env, body.runId, { notifyEmail: body.notifyEmail ?? undefined });
        message.ack();
      } catch (error) {
        console.error("[queue] processRun failed", body.runId, error);
        message.retry();
      }
    }
  },

  async scheduled(_controller, env): Promise<void> {
    logProductionSecretProblems(env);
    const db = dbFromEnv(env);
    const result = await runFridayCron(db, env);
    console.info("[scheduled] friday cron", result.processed, "enqueued");
  },
} satisfies ExportedHandler<CloudflareEnv, RunQueueMessage>;

// Re-export OpenNext Durable Objects when caching features are enabled.
// @ts-expect-error generated at build time
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
