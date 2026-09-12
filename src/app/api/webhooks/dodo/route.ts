import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { subscriptions, webhookEvents } from "@/db/schema";
import { parsePlanId } from "@/lib/billing";
import { verifyDodoWebhookSignature, type DodoWebhookEvent } from "@/lib/dodo";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const { env } = await getCloudflareContext({ async: true });
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

  const eventId = String(event.event_id || event.id || crypto.randomUUID());
  const eventType = String(event.type || event.event_type || "unknown");
  const db = await getDb();

  const [seen] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)).limit(1);
  if (seen?.processedAt) {
    return jsonOk({ ok: true, duplicate: true });
  }

  if (!seen) {
    try {
      await db.insert(webhookEvents).values({
        id: crypto.randomUUID(),
        provider: "dodo",
        eventId,
        eventType,
        payload: rawBody,
        createdAt: new Date(),
      });
    } catch {
      // Unique race: treat as duplicate candidate.
      return jsonOk({ ok: true, duplicate: true });
    }
  }

  const data = (event.data || event.payload || {}) as Record<string, unknown>;
  const metadata = (data.metadata || {}) as Record<string, unknown>;
  const workspaceId = String(metadata.workspace_id || data.workspace_id || "");
  const plan = parsePlanId(String(metadata.plan || data.plan || "agency")) || "agency";
  const dodoCustomerId = data.customer_id ? String(data.customer_id) : null;
  const dodoSubscriptionId = data.subscription_id ? String(data.subscription_id) : null;

  if (workspaceId) {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1);

    const statusFromType = (): string => {
      if (eventType.includes("cancelled") || eventType.includes("canceled")) return "cancelled";
      if (eventType.includes("failed")) return "past_due";
      if (eventType.includes("active") || eventType.includes("renewed") || eventType.includes("succeeded")) {
        return "active";
      }
      return sub?.status || "active";
    };

    if (sub) {
      await db
        .update(subscriptions)
        .set({
          plan,
          status: statusFromType(),
          dodoCustomerId: dodoCustomerId || sub.dodoCustomerId,
          dodoSubscriptionId: dodoSubscriptionId || sub.dodoSubscriptionId,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id));
    } else {
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        workspaceId,
        plan,
        status: statusFromType(),
        dodoCustomerId,
        dodoSubscriptionId,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  await db
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(webhookEvents.eventId, eventId));

  return jsonOk({ ok: true, eventId, eventType });
}
