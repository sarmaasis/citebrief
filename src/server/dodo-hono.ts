import { Hono } from "hono";
import { Checkout, Webhooks } from "@dodopayments/hono";
import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { subscriptions, webhookEvents } from "@/db/schema";
import { parsePlanId } from "@/lib/billing";
import { dodoProductId } from "@/lib/dodo";

type DodoEnv = {
  Bindings: CloudflareEnv;
};

/**
 * Official @dodopayments/hono Checkout (session) for product links.
 * Auth-gated Next route remains the primary agency checkout entry.
 */
export function createDodoCheckoutHono(env: CloudflareEnv) {
  const app = new Hono<DodoEnv>();
  const returnUrl = `${(env.BETTER_AUTH_URL || "").replace(/\/$/, "")}/app/billing/success`;

  app.post(
    "/session",
    Checkout({
      bearerToken: env.DODO_PAYMENTS_API_KEY,
      environment: env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
      returnUrl,
      type: "session",
    }),
  );

  app.get(
    "/static",
    Checkout({
      bearerToken: env.DODO_PAYMENTS_API_KEY,
      environment: env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
      returnUrl,
      type: "static",
    }),
  );

  return app;
}

export function planProductHint(env: CloudflareEnv) {
  return {
    starter: dodoProductId(env, "starter"),
    agency: dodoProductId(env, "agency"),
    studio: dodoProductId(env, "studio"),
  };
}

/**
 * Official @dodopayments/hono Webhooks handler with CiteBrief subscription updates.
 */
export function createDodoWebhookHono(env: CloudflareEnv, db: Database) {
  const app = new Hono();

  const handler = Webhooks({
    webhookKey: env.DODO_PAYMENTS_WEBHOOK_KEY,
    onPayload: async (payload) => {
      await applyDodoWebhookPayload(db, payload as Record<string, unknown>);
    },
  });

  // Match both the Next route path and a root path when remounted.
  app.post("/api/webhooks/dodo", handler);
  app.post("/", handler);

  return app;
}

export async function applyDodoWebhookPayload(db: Database, event: Record<string, unknown>) {
  const eventId = String(event.event_id || event.id || crypto.randomUUID());
  const eventType = String(event.type || event.event_type || "unknown");
  const rawBody = JSON.stringify(event);

  const [seen] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)).limit(1);
  if (seen?.processedAt) {
    return { ok: true, duplicate: true, eventId, eventType };
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
      return { ok: true, duplicate: true, eventId, eventType };
    }
  }

  const data = (event.data || event.payload || {}) as Record<string, unknown>;
  const metadata = (data.metadata || {}) as Record<string, unknown>;
  const workspaceId = String(metadata.workspace_id || data.workspace_id || "");
  const plan = parsePlanId(String(metadata.plan || data.plan || "agency")) || "agency";
  const dodoCustomerId = data.customer_id ? String(data.customer_id) : null;
  const dodoSubscriptionId = data.subscription_id ? String(data.subscription_id) : null;

  if (workspaceId) {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).limit(1);

    const statusFromType = (): string => {
      if (eventType.includes("cancelled") || eventType.includes("canceled")) return "cancelled";
      if (eventType.includes("failed") || eventType.includes("past_due")) return "past_due";
      if (
        eventType.includes("active") ||
        eventType.includes("renewed") ||
        eventType.includes("succeeded") ||
        eventType.includes("subscription.active")
      ) {
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

  await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.eventId, eventId));
  return { ok: true, duplicate: false, eventId, eventType };
}
