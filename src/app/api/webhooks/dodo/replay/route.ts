import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookEvents } from "@/db/schema";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/** Failed webhook replay stub: re-marks an event for processing. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { eventId?: string };
  if (!body.eventId) return jsonError("eventId is required.");
  const db = await getDb();
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, body.eventId)).limit(1);
  if (!row) return jsonError("Webhook event not found.", 404);

  await db
    .update(webhookEvents)
    .set({ processedAt: null, replayedAt: new Date() })
    .where(eq(webhookEvents.id, row.id));

  return jsonOk({
    ok: true,
    stub: true,
    message: "Event marked for replay. Re-POST the payload to /api/webhooks/dodo to process.",
    eventId: body.eventId,
  });
}
