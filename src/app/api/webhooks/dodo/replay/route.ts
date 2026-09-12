import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { webhookEvents } from "@/db/schema";
import { getDb } from "@/db";
import { requireInternalSecret } from "@/lib/internal-auth";
import { applyDodoWebhookPayload } from "@/server/dodo-hono";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/** Alias: failed webhook replay (Bearer INTERNAL_ADMIN_SECRET or INTERNAL_PROCESS_SECRET). */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const adminDenied = requireInternalSecret(request, env, "INTERNAL_ADMIN_SECRET");
  const processDenied = requireInternalSecret(request, env, "INTERNAL_PROCESS_SECRET");
  if (adminDenied && processDenied) {
    return adminDenied;
  }

  const body = (await request.json().catch(() => ({}))) as { eventId?: string };
  if (!body.eventId) return jsonError("eventId is required.");
  const db = await getDb();
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, body.eventId)).limit(1);
  if (!row) return jsonError("Webhook event not found.", 404);

  await db
    .update(webhookEvents)
    .set({ processedAt: null, replayedAt: new Date() })
    .where(eq(webhookEvents.id, row.id));

  if (row.payload) {
    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      const result = await applyDodoWebhookPayload(db, payload, env);
      return jsonOk({ ok: true, replayed: true, result });
    } catch (error) {
      console.info("[webhook-replay] apply failed", error);
    }
  }

  return jsonOk({
    ok: true,
    replayed: false,
    message: "Event marked for replay. Re-POST the payload to /api/webhooks/dodo if payload missing.",
    eventId: body.eventId,
  });
}
