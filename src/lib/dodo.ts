import DodoPayments from "dodopayments";
import { createCheckoutSession } from "@dodopayments/core";
import {
  ENTERPRISE_CONTACT_SALES_MESSAGE,
  isStubSecret,
  parsePlanId,
  type PlanId,
  PLANS,
} from "@/lib/billing";
import { isProductionRuntime } from "@/lib/runtime-env";

export const DODO_UNAVAILABLE_MESSAGE = "Billing is not configured. Try again later or contact support.";

export function dodoAllowsStub(env?: { NEXTJS_ENV?: string; BETTER_AUTH_URL?: string } | null) {
  return !isProductionRuntime(env);
}

function checkoutStubOrUnavailable(
  env: CloudflareEnv,
  stub: { url: string; message: string },
): DodoCheckoutResult {
  if (dodoAllowsStub(env)) {
    return { mode: "stub", url: stub.url, message: stub.message };
  }
  return { mode: "unavailable", message: DODO_UNAVAILABLE_MESSAGE };
}

export type DodoCheckoutResult =
  | { mode: "redirect"; url: string }
  | { mode: "stub"; url: string; message: string }
  | { mode: "unavailable"; message: string };

export function dodoProductLabel(plan: PlanId) {
  return `CiteBrief ${PLANS[plan].name}`;
}

function dodoEnvironment(env: CloudflareEnv): "test_mode" | "live_mode" {
  return env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
}

export function dodoProductId(env: CloudflareEnv, plan: PlanId): string | null {
  const fromEnv =
    plan === "starter"
      ? env.DODO_PRODUCT_STARTER
      : plan === "agency"
        ? env.DODO_PRODUCT_AGENCY
        : plan === "studio"
          ? env.DODO_PRODUCT_STUDIO
          : env.DODO_PRODUCT_ENTERPRISE;
  if (fromEnv && !isStubSecret(fromEnv)) return fromEnv;
  if (plan === "enterprise") return null;
  return `citebrief_${plan}`;
}

export function dodoExtraBrandProductId(env: CloudflareEnv): string {
  if (env.DODO_PRODUCT_EXTRA_BRAND && !isStubSecret(env.DODO_PRODUCT_EXTRA_BRAND)) {
    return env.DODO_PRODUCT_EXTRA_BRAND;
  }
  return "citebrief_extra_brand";
}

export function dodoExtraRunProductId(env: CloudflareEnv): string {
  if (env.DODO_PRODUCT_EXTRA_RUN && !isStubSecret(env.DODO_PRODUCT_EXTRA_RUN)) {
    return env.DODO_PRODUCT_EXTRA_RUN;
  }
  return "citebrief_extra_run";
}

export function dodoExtraSeatProductId(env: CloudflareEnv): string {
  if (env.DODO_PRODUCT_EXTRA_SEAT && !isStubSecret(env.DODO_PRODUCT_EXTRA_SEAT)) {
    return env.DODO_PRODUCT_EXTRA_SEAT;
  }
  return "citebrief_extra_seat";
}

export function dodoAnnualProductId(env: CloudflareEnv, plan: PlanId): string | null {
  const fromEnv =
    plan === "starter"
      ? env.DODO_PRODUCT_STARTER_ANNUAL
      : plan === "agency"
        ? env.DODO_PRODUCT_AGENCY_ANNUAL
        : plan === "studio"
          ? env.DODO_PRODUCT_STUDIO_ANNUAL
          : env.DODO_PRODUCT_ENTERPRISE_ANNUAL;
  if (fromEnv && !isStubSecret(fromEnv)) return fromEnv;
  return null;
}

export function dodoPremiumEnginePackProductId(env: CloudflareEnv): string | null {
  if (env.DODO_PRODUCT_PREMIUM_ENGINE && !isStubSecret(env.DODO_PRODUCT_PREMIUM_ENGINE)) {
    return env.DODO_PRODUCT_PREMIUM_ENGINE;
  }
  return null;
}

export function createDodoClient(env: CloudflareEnv) {
  return new DodoPayments({
    bearerToken: env.DODO_PAYMENTS_API_KEY,
    environment: dodoEnvironment(env),
    webhookKey: isStubSecret(env.DODO_PAYMENTS_WEBHOOK_KEY) ? null : env.DODO_PAYMENTS_WEBHOOK_KEY,
  });
}

export async function createDodoCheckout(args: {
  env: CloudflareEnv;
  plan: PlanId;
  workspaceId: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  interval?: "monthly" | "annual";
}): Promise<DodoCheckoutResult> {
  const interval = args.interval === "annual" ? "annual" : "monthly";
  const successPath = `/app/billing/success?plan=${args.plan}${interval === "annual" ? "&interval=annual" : ""}`;
  const stubUrl = `${args.returnUrl}${successPath}&stub=1`;

  if (isStubSecret(args.env.DODO_PAYMENTS_API_KEY)) {
    if (args.plan === "enterprise") {
      return { mode: "unavailable", message: ENTERPRISE_CONTACT_SALES_MESSAGE };
    }
    return checkoutStubOrUnavailable(args.env, {
      url: stubUrl,
      message: "Dodo API key missing. Using stub checkout success URL.",
    });
  }

  const annualId = interval === "annual" ? dodoAnnualProductId(args.env, args.plan) : null;
  if (interval === "annual" && !annualId) {
    return {
      mode: "unavailable",
      message:
        "Annual billing is not configured yet (missing Dodo annual product IDs). Use monthly, or contact support.",
    };
  }
  const productId = annualId || dodoProductId(args.env, args.plan);
  if (!productId) {
    return {
      mode: "unavailable",
      message: ENTERPRISE_CONTACT_SALES_MESSAGE,
    };
  }
  const returnUrl = `${args.returnUrl}${successPath}`;
  const metadata = {
    workspace_id: args.workspaceId,
    plan: args.plan,
    interval,
  };

  try {
    // Prefer official @dodopayments/core session helper (same stack as @dodopayments/hono).
    const session = await createCheckoutSession(
      {
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: {
          email: args.customerEmail,
          name: args.customerName,
        },
        return_url: returnUrl,
        metadata,
      },
      {
        bearerToken: args.env.DODO_PAYMENTS_API_KEY,
        environment: dodoEnvironment(args.env),
      },
    );

    const url = session.checkout_url;
    if (!url) {
      return checkoutStubOrUnavailable(args.env, {
        url: stubUrl,
        message: "Dodo response missing URL; stub used.",
      });
    }
    return { mode: "redirect", url };
  } catch (error) {
    console.info("[dodo] createCheckoutSession failed; trying SDK", error);
  }

  try {
    const client = createDodoClient(args.env);
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email: args.customerEmail,
        name: args.customerName,
      },
      return_url: returnUrl,
      metadata,
    });
    const url = session.checkout_url;
    if (!url) {
      return checkoutStubOrUnavailable(args.env, {
        url: stubUrl,
        message: "Dodo SDK missing URL; stub used.",
      });
    }
    return { mode: "redirect", url };
  } catch (error) {
    console.info("[dodo] checkout error", error);
    return checkoutStubOrUnavailable(args.env, {
      url: stubUrl,
      message: "Dodo unreachable; stub URL used.",
    });
  }
}

export function verifyDodoWebhookSignature(args: {
  env: CloudflareEnv;
  rawBody: string;
  signature: string | null;
}): boolean {
  if (isStubSecret(args.env.DODO_PAYMENTS_WEBHOOK_KEY)) {
    return dodoAllowsStub(args.env);
  }
  if (!args.signature) {
    return false;
  }
  // Fallback verifier when not using @dodopayments/hono Webhooks middleware.
  return (
    args.signature === args.env.DODO_PAYMENTS_WEBHOOK_KEY ||
    args.signature.includes(args.env.DODO_PAYMENTS_WEBHOOK_KEY)
  );
}

export type DodoWebhookEvent = {
  id?: string;
  event_id?: string;
  type?: string;
  event_type?: string;
  business_id?: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

/**
 * Parse a Dodo timestamp. Webhook middleware may already coerce ISO strings
 * to Date; raw JSON (Next route / replay) keeps strings.
 */
export function parseDodoTimestamp(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Dodo Subscription.next_billing_date is "the end of current billing period"
 * (SDK + webhook schemas). Use it when present. Fallback to now+30/365 only
 * when Dodo omits the field (payment-only / addon payloads).
 */
export function dodoCurrentPeriodEnd(
  data: Record<string, unknown>,
  fallbackInterval: string,
): Date {
  const fromDodo = parseDodoTimestamp(data.next_billing_date);
  if (fromDodo) return fromDodo;
  const periodMs = (fallbackInterval === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + periodMs);
}

/** Confirmed payment / active subscription — only then may paid plan change. */
export function dodoEventConfirmsPaidPlan(eventType: string): boolean {
  const t = eventType.toLowerCase();
  if (t.includes("failed") || t.includes("past_due")) return false;
  if (t.includes("cancelled") || t.includes("canceled")) return false;
  return (
    t.includes("succeeded") ||
    t.includes("renewed") ||
    t.includes("subscription.active") ||
    t.endsWith(".active") ||
    t.includes(".active")
  );
}

export function dodoEventIsPaymentFailure(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return t.includes("failed") || t.includes("past_due");
}

/**
 * Declined checkout for a *different* plan than the current row must not mutate
 * the subscription (Agency stays Agency; trial stays trialing).
 */
export function shouldIgnoreFailedPlanSwitch(args: {
  eventType: string;
  requestedPlan: PlanId;
  existingPlan: string | null | undefined;
  existingStatus: string | null | undefined;
  isAddon?: boolean;
}): boolean {
  if (args.isAddon) return false;
  if (!dodoEventIsPaymentFailure(args.eventType)) return false;
  const existing = parsePlanId(args.existingPlan);
  if (!existing) return false;
  if (existing !== args.requestedPlan) return true;
  return args.existingStatus === "trialing" || args.existingStatus === "none";
}

/** Plan to persist: change only after confirmed payment (addons never change plan). */
export function resolveWebhookSubscriptionPlan(args: {
  eventType: string;
  requestedPlan: PlanId;
  existingPlan: string | null | undefined;
  isAddon?: boolean;
}): PlanId {
  if (args.isAddon) {
    return parsePlanId(args.existingPlan) ?? args.requestedPlan;
  }
  if (dodoEventConfirmsPaidPlan(args.eventType)) return args.requestedPlan;
  return parsePlanId(args.existingPlan) ?? args.requestedPlan;
}


export async function createDodoCustomerPortal(args: {
  env: CloudflareEnv;
  customerId: string;
  returnUrl: string;
}): Promise<
  | { mode: "redirect"; url: string }
  | { mode: "stub"; url: string; message?: string }
  | { mode: "unavailable"; message: string }
> {
  if (isStubSecret(args.env.DODO_PAYMENTS_API_KEY) || !args.customerId) {
    if (!dodoAllowsStub(args.env)) {
      return { mode: "unavailable", message: DODO_UNAVAILABLE_MESSAGE };
    }
    return {
      mode: "stub",
      url: `${args.returnUrl}/app/settings/billing?portal=stub`,
      message: "Dodo customer portal needs a live API key and customer id.",
    };
  }
  try {
    const client = createDodoClient(args.env);
    const session = await client.customers.customerPortal.create(args.customerId, {
      return_url: `${args.returnUrl}/app/settings/billing`,
    });
    if (!session.link) {
      if (!dodoAllowsStub(args.env)) {
        return { mode: "unavailable", message: DODO_UNAVAILABLE_MESSAGE };
      }
      return { mode: "stub", url: `${args.returnUrl}/app/settings/billing?portal=missing`, message: "Portal link missing." };
    }
    return { mode: "redirect", url: session.link };
  } catch (error) {
    console.info("[dodo] customer portal error", error);
    if (!dodoAllowsStub(args.env)) {
      return { mode: "unavailable", message: DODO_UNAVAILABLE_MESSAGE };
    }
    return {
      mode: "stub",
      url: `${args.returnUrl}/app/settings/billing?portal=error`,
      message: "Could not open Dodo portal. Try again or check DODO_PAYMENTS_API_KEY.",
    };
  }
}

export async function scheduleDodoCancelAtPeriodEnd(args: {
  env: CloudflareEnv;
  subscriptionId: string;
  cancel: boolean;
}): Promise<{ ok: boolean; stubbed: boolean; message?: string }> {
  if (isStubSecret(args.env.DODO_PAYMENTS_API_KEY) || !args.subscriptionId) {
    if (!dodoAllowsStub(args.env)) {
      return { ok: false, stubbed: false, message: DODO_UNAVAILABLE_MESSAGE };
    }
    return { ok: true, stubbed: true, message: "Cancel-at-period-end recorded locally (Dodo stub)." };
  }
  try {
    const client = createDodoClient(args.env);
    await client.subscriptions.update(args.subscriptionId, {
      cancel_at_next_billing_date: args.cancel,
      ...(args.cancel
        ? { cancel_reason: "cancelled_by_customer" as const }
        : {}),
    });
    return { ok: true, stubbed: false };
  } catch (error) {
    console.info("[dodo] cancel-at-period-end error", error);
    return { ok: false, stubbed: false, message: "Dodo could not update cancel_at_next_billing_date." };
  }
}

export async function recordDodoExtraRunUsage(args: {
  env: CloudflareEnv;
  customerId: string | null | undefined;
  workspaceId: string;
  runId?: string;
}): Promise<{ ok: boolean; stubbed: boolean }> {
  if (isStubSecret(args.env.DODO_PAYMENTS_API_KEY) || !args.customerId) {
    if (!dodoAllowsStub(args.env)) {
      return { ok: false, stubbed: false };
    }
    console.info("[dodo stub] extra run usage", { workspaceId: args.workspaceId, runId: args.runId });
    return { ok: true, stubbed: true };
  }
  try {
    const client = createDodoClient(args.env);
    await client.usageEvents.ingest({
      events: [
        {
          customer_id: args.customerId,
          event_id: args.runId || crypto.randomUUID(),
          event_name: "citebrief_extra_run",
          metadata: {
            workspace_id: args.workspaceId,
            product_hint: dodoExtraRunProductId(args.env),
          },
        },
      ],
    });
    return { ok: true, stubbed: false };
  } catch (error) {
    console.info("[dodo] usage ingest error", error);
    return { ok: false, stubbed: false };
  }
}

export type DodoAddon = "extra_brand" | "extra_run" | "extra_seat" | "premium_engine_pack";

export async function createDodoAddonCheckout(args: {
  env: CloudflareEnv;
  workspaceId: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  addon: DodoAddon;
}): Promise<DodoCheckoutResult> {
  const successPath = `/app/billing/success?addon=${args.addon}`;
  const stubUrl = `${args.returnUrl}${successPath}&stub=1`;
  if (isStubSecret(args.env.DODO_PAYMENTS_API_KEY)) {
    return checkoutStubOrUnavailable(args.env, {
      url: stubUrl,
      message: "Dodo API key missing. Stub addon checkout.",
    });
  }
  const productId =
    args.addon === "extra_brand"
      ? dodoExtraBrandProductId(args.env)
      : args.addon === "extra_seat"
        ? dodoExtraSeatProductId(args.env)
        : args.addon === "premium_engine_pack"
          ? dodoPremiumEnginePackProductId(args.env)
          : dodoExtraRunProductId(args.env);
  if (!productId) {
    return {
      mode: "unavailable",
      message: "Premium engine pack is not configured yet (missing Dodo product ID).",
    };
  }
  try {
    const session = await createCheckoutSession(
      {
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: args.customerEmail, name: args.customerName },
        return_url: `${args.returnUrl}${successPath}`,
        metadata: {
          workspace_id: args.workspaceId,
          addon: args.addon,
        },
      },
      {
        bearerToken: args.env.DODO_PAYMENTS_API_KEY,
        environment: dodoEnvironment(args.env),
      },
    );
    const url = session.checkout_url;
    if (!url) {
      return checkoutStubOrUnavailable(args.env, {
        url: stubUrl,
        message: "Addon checkout missing URL.",
      });
    }
    return { mode: "redirect", url };
  } catch (error) {
    console.info("[dodo] addon checkout error", error);
    return checkoutStubOrUnavailable(args.env, {
      url: stubUrl,
      message: "Addon checkout unreachable; stub used.",
    });
  }
}
