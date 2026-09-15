// Custom OpenNext Worker: fetch + Queue consumer + scheduled Friday cron.
// @ts-expect-error `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { dbFromEnv } from "./src/db";
import { runFridayCron } from "./src/lib/cron-friday";
import { handleRunQueueMessage, type RunQueueMessage } from "./src/lib/run-queue";
import {
  canonicalRedirectLocation,
  isHealthPath,
  logProductionSecretProblems,
  productionTrafficBlocked,
} from "./src/lib/runtime-env";
import { applySecurityHeaders, canonicalRedirectResponse } from "./src/lib/security-headers";

let productionSecretGate: "ok" | "blocked" | null = null;

export type { RunQueueMessage };

export default {
  async fetch(request, env, ctx) {
    const location = canonicalRedirectLocation(request);
    if (location) return canonicalRedirectResponse(location, env, request);

    const url = new URL(request.url);
    if (productionSecretGate === null) {
      const problems = logProductionSecretProblems(env);
      productionSecretGate = problems.length > 0 ? "blocked" : "ok";
    }
    if (productionSecretGate === "blocked" && !isHealthPath(url.pathname)) {
      return applySecurityHeaders(
        new Response(JSON.stringify({ error: "Service misconfigured." }), {
          status: 503,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        }),
        env,
        request,
      );
    }

    const response = await handler.fetch(request, env, ctx);
    return applySecurityHeaders(response, env, request);
  },

  async queue(batch, env): Promise<void> {
    logProductionSecretProblems(env);
    if (productionTrafficBlocked(env)) {
      console.error("[queue] refusing to process; production secrets are stub");
      for (const message of batch.messages) {
        message.retry();
      }
      return;
    }
    const db = dbFromEnv(env);
    for (const message of batch.messages) {
      const body = (message.body || {}) as RunQueueMessage;
      if (!body.runId) {
        console.info("[queue] skip message without runId", message.id);
        message.ack();
        continue;
      }
      try {
        await handleRunQueueMessage(db, env, body);
        message.ack();
      } catch (error) {
        console.error("[queue] run job failed", body.runId, body.engineId, error);
        message.retry();
      }
    }
  },

  async scheduled(_controller, env): Promise<void> {
    logProductionSecretProblems(env);
    if (productionTrafficBlocked(env)) {
      console.error("[scheduled] refusing Friday cron; production secrets are stub");
      return;
    }
    const db = dbFromEnv(env);
    const result = await runFridayCron(db, env);
    console.info("[scheduled] friday cron", result.processed, "enqueued");
  },
} satisfies ExportedHandler<CloudflareEnv, RunQueueMessage>;

// Re-export OpenNext Durable Objects when caching features are enabled.
// @ts-expect-error generated at build time
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
