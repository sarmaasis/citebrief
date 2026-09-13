import { Hono } from "hono";
import { Checkout, Webhooks } from "@dodopayments/hono";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { subscriptions, webhookEvents, workspaces, workspaceMembers, users } from "@/db/schema";
import { parseBillingInterval, parsePlanId } from "@/lib/billing";
import { dodoCurrentPeriodEnd, dodoProductId } from "@/lib/dodo";
import { sendTransactionalEmail } from "@/lib/email";
import { bumpExtraBrands, bumpExtraRunCredits, bumpExtraSeats, setPremiumEnginePack } from "@/lib/usage";

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
      await applyDodoWebhookPayload(db, payload as Record<string, unknown>, env);
    },
  });

  // Match both the Next route path and a root path when remounted.
  app.post("/api/webhooks/dodo", handler);
  app.post("/", handler);

  return app;
}

async function ownerEmail(db: Database, workspaceId: string): Promise<string | null> {
  const [owner] = await db
    .select({ email: users.email })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, "owner")))
    .limit(1);
  return owner?.email || null;
}

export async function applyDodoWebhookPayload(
  db: Database,
  event: Record<string, unknown>,
  env?: CloudflareEnv,
) {
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
  const interval = parseBillingInterval(String(metadata.interval || data.interval || ""));
  const addon = String(metadata.addon || "");
  const dodoCustomerId = data.customer_id ? String(data.customer_id) : null;
  const dodoSubscriptionId = data.subscription_id ? String(data.subscription_id) : null;
  const cancelAtNext =
    typeof data.cancel_at_next_billing_date === "boolean"
      ? Boolean(data.cancel_at_next_billing_date)
      : undefined;

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

    if (addon === "extra_brand" && (eventType.includes("succeeded") || eventType.includes("active"))) {
      await bumpExtraBrands(db, workspaceId, 1);
    }
    if (addon === "extra_seat" && (eventType.includes("succeeded") || eventType.includes("active"))) {
      await bumpExtraSeats(db, workspaceId, 1);
    }
    if (addon === "extra_run" && (eventType.includes("succeeded") || eventType.includes("active"))) {
      await bumpExtraRunCredits(db, workspaceId, 1);
    }
    if (addon === "premium_engine_pack" && (eventType.includes("succeeded") || eventType.includes("active"))) {
      await setPremiumEnginePack(db, workspaceId, true);
    }

    const nextInterval = addon ? (sub?.billingInterval === "annual" ? "annual" : interval) : interval;
    // Dodo Subscription.next_billing_date is the end of the current period.
    // Addon payments keep the existing period; infer only when Dodo omits the field.
    const periodEnd = addon && sub?.currentPeriodEnd
      ? sub.currentPeriodEnd
      : dodoCurrentPeriodEnd(data, nextInterval);

    if (sub) {
      await db
        .update(subscriptions)
        .set({
          plan: addon ? sub.plan : plan,
          billingInterval: addon ? sub.billingInterval : interval,
          status: addon && sub.status === "active" ? sub.status : statusFromType(),
          dodoCustomerId: dodoCustomerId || sub.dodoCustomerId,
          dodoSubscriptionId: dodoSubscriptionId || sub.dodoSubscriptionId,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd:
            cancelAtNext !== undefined
              ? cancelAtNext
              : eventType.includes("cancelled") || eventType.includes("canceled")
                ? true
                : sub.cancelAtPeriodEnd,
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
        billingInterval: interval,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: cancelAtNext ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (env && (eventType.includes("subscription.failed") || eventType.endsWith(".failed"))) {
      try {
        const to = await ownerEmail(db, workspaceId);
        const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
        if (to) {
          await sendTransactionalEmail({
            to,
            subject: "CiteBrief billing needs attention",
            html: `<p>We could not renew CiteBrief for <strong>${workspace?.name || "your workspace"}</strong>.</p><p>Update your payment method in Billing to keep Friday reports running. PDFs stay available for 90 days if the subscription ends.</p>`,
            env,
          });
        }
      } catch (error) {
        console.info("[dodo-webhook] dunning email failed", error);
      }
    }
  }

  await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.eventId, eventId));
  return { ok: true, duplicate: false, eventId, eventType };
}
