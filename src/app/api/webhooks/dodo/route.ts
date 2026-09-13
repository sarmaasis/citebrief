import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { isStubSecret } from "@/lib/billing";
import { isProductionRuntime } from "@/lib/runtime-env";
import { verifyDodoWebhookSignature, type DodoWebhookEvent } from "@/lib/dodo";
import { applyDodoWebhookPayload, createDodoWebhookHono } from "@/server/dodo-hono";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const db = await getDb();

  // Live keys: official @dodopayments/hono Webhooks (signature + Zod).
  if (!isStubSecret(env.DODO_PAYMENTS_WEBHOOK_KEY)) {
    const app = createDodoWebhookHono(env, db);
    return app.fetch(request);
  }

  if (isProductionRuntime(env)) {
    return jsonError("Dodo webhooks are not configured.", 503);
  }

  // Stub/dev path: accept payloads so idempotent handling can be tested.
  const rawBody = await request.text();
  const signature =
    request.headers.get("webhook-signature") ||
    request.headers.get("x-dodo-signature") ||
    request.headers.get("dodo-signature");

  if (!verifyDodoWebhookSignature({ env, rawBody, signature })) {
    return jsonError("Invalid webhook signature.", 401);
  }

  let event: DodoWebhookEvent;
  try {
    event = JSON.parse(rawBody) as DodoWebhookEvent;
  } catch {
    return jsonError("Invalid JSON.");
  }

  const result = await applyDodoWebhookPayload(db, event as Record<string, unknown>, env);
  return jsonOk(result);
}
