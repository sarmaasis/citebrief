import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { webhookEvents } from "@/db/schema";
import { getDb } from "@/db";
import { writeAuditLog } from "@/lib/audit";
import { guardInternalRoute } from "@/lib/internal-guard";
import { applyDodoWebhookPayload } from "@/server/dodo-hono";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/** Re-apply a stored webhook payload (failed / support replay). */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await guardInternalRoute(request, env, "INTERNAL_ADMIN_SECRET");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { eventId?: string };
  if (!body.eventId) return jsonError("eventId is required.");

  const db = await getDb();
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, body.eventId)).limit(1);
  if (!row) return jsonError("Webhook event not found.", 404);
  if (!row.payload) return jsonError("Webhook payload missing; cannot replay.", 422);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    return jsonError("Stored payload is not valid JSON.", 422);
  }

  await db
    .update(webhookEvents)
    .set({ processedAt: null, replayedAt: new Date() })
    .where(eq(webhookEvents.id, row.id));

  await writeAuditLog(db, {
    action: "webhook.replay",
    targetType: "webhook_event",
    targetId: row.eventId,
    request,
    metadata: { eventType: row.eventType },
  });

  const result = await applyDodoWebhookPayload(db, payload, env);
  return jsonOk({ ok: true, replayed: true, result });
}
