import { Hono } from "hono";
import { Checkout, Webhooks } from "@dodopayments/hono";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { subscriptions, webhookEvents, workspaces, workspaceMembers, users } from "@/db/schema";
import { parseBillingInterval, parsePlanId } from "@/lib/billing";
import {
  dodoEventConfirmsPaidPlan,
  dodoEventIsPaymentFailure,
  dodoProductId,
  resolvePlanFromDodoProductId,
  resolveSubscriptionPeriodEnd,
  resolveWebhookSubscriptionPlan,
  shouldIgnoreFailedPlanSwitch,
} from "@/lib/dodo";
import { dunningEmail } from "@/emails";
import { sendTransactionalEmail } from "@/lib/email";
import { workspaceEntitlements } from "@/lib/entitlements";
import { topUpWorkspaceBrandPrompts } from "@/lib/prompt-topup";
import {
  bumpExtraBrands,
  bumpExtraRunCredits,
  bumpExtraSeats,
  countMonthlyRechecksUsed,
  planChangeMeteringPatch,
  setPremiumEnginePack,
} from "@/lib/usage";

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
  const productHint = env
    ? resolvePlanFromDodoProductId(env, data.product_id ? String(data.product_id) : null)
    : null;
  const plan =
    parsePlanId(String(metadata.plan || data.plan || "")) || productHint?.plan || "agency";
  const intervalRaw = metadata.interval ?? data.interval;
  const interval = intervalRaw
    ? parseBillingInterval(String(intervalRaw))
    : productHint?.interval ?? "monthly";
  const addon = String(metadata.addon || "");
  const dodoCustomerId = data.customer_id ? String(data.customer_id) : null;
  const dodoSubscriptionId = data.subscription_id ? String(data.subscription_id) : null;
  const cancelAtNext =
    typeof data.cancel_at_next_billing_date === "boolean"
      ? Boolean(data.cancel_at_next_billing_date)
      : undefined;

  if (workspaceId) {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).limit(1);
    const prevPromptCap = workspaceEntitlements(sub).promptCap;
    const isAddon = Boolean(addon);
    const confirmsPaid = dodoEventConfirmsPaidPlan(eventType);

    // Declined switch checkout must not rewrite plan/status (e.g. Agency → Starter fail).
    if (
      shouldIgnoreFailedPlanSwitch({
        eventType,
        requestedPlan: plan,
        existingPlan: sub?.plan,
        existingStatus: sub?.status,
        isAddon,
      })
    ) {
      await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.eventId, eventId));
      return { ok: true, duplicate: false, eventId, eventType, ignored: "failed_plan_switch" };
    }

    const statusFromType = (): string => {
      if (eventType.includes("cancelled") || eventType.includes("canceled")) return "cancelled";
      if (dodoEventIsPaymentFailure(eventType)) return "past_due";
      if (confirmsPaid) return "active";
      return sub?.status || "active";
    };

    if (addon === "extra_brand" && confirmsPaid) {
      await bumpExtraBrands(db, workspaceId, 1);
    }
    if (addon === "extra_seat" && confirmsPaid) {
      await bumpExtraSeats(db, workspaceId, 1);
    }
    if (addon === "extra_run" && confirmsPaid) {
      await bumpExtraRunCredits(db, workspaceId, 1);
    }
    if (addon === "premium_engine_pack" && confirmsPaid) {
      await setPremiumEnginePack(db, workspaceId, true);
    }

    const nextPlan = resolveWebhookSubscriptionPlan({
      eventType,
      requestedPlan: plan,
      existingPlan: sub?.plan,
      isAddon,
    });
    const nextInterval = isAddon
      ? parseBillingInterval(sub?.billingInterval)
      : confirmsPaid || !sub
        ? interval
        : parseBillingInterval(sub.billingInterval);
    // Trust Dodo next_billing_date; if omitted leaving annual, keep prepaid paid-through.
    const periodEnd = resolveSubscriptionPeriodEnd({
      data,
      nextInterval,
      previousInterval: sub?.billingInterval,
      previousPeriodEnd: sub?.currentPeriodEnd ?? null,
      isAddon,
    });

    const nextStatus = isAddon && sub?.status === "active" ? sub.status : statusFromType();
    const nextBillingInterval = isAddon && sub ? sub.billingInterval : nextInterval;
    const nextCancelAtPeriodEnd =
      cancelAtNext !== undefined
        ? cancelAtNext
        : eventType.includes("cancelled") || eventType.includes("canceled")
          ? true
          : (sub?.cancelAtPeriodEnd ?? false);

    let metering: ReturnType<typeof planChangeMeteringPatch> = null;
    if (confirmsPaid && !isAddon) {
      const planChanging = Boolean(sub && parsePlanId(sub.plan) !== parsePlanId(nextPlan));
      let monthlyRechecksUsed: number | undefined;
      let extraRunCredits: number | undefined;
      if (planChanging && sub) {
        monthlyRechecksUsed = await countMonthlyRechecksUsed(
          db,
          workspaceId,
          sub.plan,
          sub.planMeteringSince ?? null,
        );
        extraRunCredits = sub.extraRunCredits || 0;
      }
      metering = planChangeMeteringPatch({
        previousPlan: sub?.plan,
        nextPlan,
        monthlyRechecksUsed,
        extraRunCredits,
      });
    }

    if (sub) {
      await db
        .update(subscriptions)
        .set({
          plan: nextPlan,
          billingInterval: nextBillingInterval,
          status: nextStatus,
          dodoCustomerId: dodoCustomerId || sub.dodoCustomerId,
          dodoSubscriptionId: dodoSubscriptionId || sub.dodoSubscriptionId,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: nextCancelAtPeriodEnd,
          ...(metering ?? {}),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id));
    } else if (confirmsPaid || !dodoEventIsPaymentFailure(eventType)) {
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        workspaceId,
        plan: nextPlan,
        status: nextStatus,
        dodoCustomerId,
        dodoSubscriptionId,
        billingInterval: nextBillingInterval,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: nextCancelAtPeriodEnd,
        planMeteringSince: new Date(),
        extraRuns: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const nextPromptCap = workspaceEntitlements({
      plan: nextPlan,
      status: nextStatus,
      trialEndsAt: sub?.trialEndsAt ?? null,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: nextCancelAtPeriodEnd,
      extraBrands: sub?.extraBrands,
      extraSeats: sub?.extraSeats,
      extraRuns: sub?.extraRuns,
      extraRunCredits: metering?.extraRunCredits ?? sub?.extraRunCredits,
      billingInterval: nextBillingInterval,
      premiumEnginePack: sub?.premiumEnginePack,
    }).promptCap;

    if (nextPromptCap > prevPromptCap) {
      try {
        await topUpWorkspaceBrandPrompts(db, workspaceId, nextPromptCap);
      } catch (error) {
        console.info("[dodo-webhook] prompt top-up failed", error);
      }
    }

    if (env && (eventType.includes("subscription.failed") || eventType.endsWith(".failed"))) {
      try {
        const to = await ownerEmail(db, workspaceId);
        const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
        if (to) {
          const origin = (env.BETTER_AUTH_URL || "").replace(/\/$/, "");
          const mail = dunningEmail({
            workspaceName: workspace?.name || "your workspace",
            billingUrl: origin ? `${origin}/app/settings/billing` : undefined,
          });
          await sendTransactionalEmail({
            to,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
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
