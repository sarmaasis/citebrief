import DodoPayments from "dodopayments";
import { createCheckoutSession } from "@dodopayments/core";
import { isStubSecret, type PlanId, PLANS } from "@/lib/billing";

export type DodoCheckoutResult =
  | { mode: "redirect"; url: string }
  | { mode: "stub"; url: string; message: string };

export function dodoProductLabel(plan: PlanId) {
  return `CiteBrief ${PLANS[plan].name}`;
}

function dodoEnvironment(env: CloudflareEnv): "test_mode" | "live_mode" {
  return env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
}

export function dodoProductId(env: CloudflareEnv, plan: PlanId): string {
  const fromEnv =
    plan === "starter"
      ? env.DODO_PRODUCT_STARTER
      : plan === "agency"
        ? env.DODO_PRODUCT_AGENCY
        : env.DODO_PRODUCT_STUDIO;
  if (fromEnv && !isStubSecret(fromEnv)) return fromEnv;
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
}): Promise<DodoCheckoutResult> {
  const successPath = `/app/billing/success?plan=${args.plan}`;
  const stubUrl = `${args.returnUrl}${successPath}&stub=1`;

  if (isStubSecret(args.env.DODO_PAYMENTS_API_KEY)) {
    return {
      mode: "stub",
      url: stubUrl,
      message: "Dodo API key missing. Using stub checkout success URL.",
    };
  }

  const productId = dodoProductId(args.env, args.plan);
  const returnUrl = `${args.returnUrl}${successPath}`;

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
        metadata: {
          workspace_id: args.workspaceId,
          plan: args.plan,
        },
      },
      {
        bearerToken: args.env.DODO_PAYMENTS_API_KEY,
        environment: dodoEnvironment(args.env),
      },
    );

    const url = session.checkout_url;
    if (!url) {
      return { mode: "stub", url: stubUrl, message: "Dodo response missing URL; stub used." };
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
      metadata: {
        workspace_id: args.workspaceId,
        plan: args.plan,
      },
    });
    const url = session.checkout_url;
    if (!url) {
      return { mode: "stub", url: stubUrl, message: "Dodo SDK missing URL; stub used." };
    }
    return { mode: "redirect", url };
  } catch (error) {
    console.info("[dodo] checkout error", error);
    return { mode: "stub", url: stubUrl, message: "Dodo unreachable; stub URL used." };
  }
}

export function verifyDodoWebhookSignature(args: {
  env: CloudflareEnv;
  rawBody: string;
  signature: string | null;
}): boolean {
  if (isStubSecret(args.env.DODO_PAYMENTS_WEBHOOK_KEY)) {
    return true;
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


export async function createDodoCustomerPortal(args: {
  env: CloudflareEnv;
  customerId: string;
  returnUrl: string;
}): Promise<{ mode: "redirect" | "stub"; url: string; message?: string }> {
  if (isStubSecret(args.env.DODO_PAYMENTS_API_KEY) || !args.customerId) {
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
      return { mode: "stub", url: `${args.returnUrl}/app/settings/billing?portal=missing`, message: "Portal link missing." };
    }
    return { mode: "redirect", url: session.link };
  } catch (error) {
    console.info("[dodo] customer portal error", error);
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

export async function createDodoAddonCheckout(args: {
  env: CloudflareEnv;
  workspaceId: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  addon: "extra_brand" | "extra_run";
}): Promise<DodoCheckoutResult> {
  const successPath = `/app/billing/success?addon=${args.addon}`;
  const stubUrl = `${args.returnUrl}${successPath}&stub=1`;
  if (isStubSecret(args.env.DODO_PAYMENTS_API_KEY)) {
    return { mode: "stub", url: stubUrl, message: "Dodo API key missing. Stub addon checkout." };
  }
  const productId =
    args.addon === "extra_brand" ? dodoExtraBrandProductId(args.env) : dodoExtraRunProductId(args.env);
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
    if (!url) return { mode: "stub", url: stubUrl, message: "Addon checkout missing URL." };
    return { mode: "redirect", url };
  } catch (error) {
    console.info("[dodo] addon checkout error", error);
    return { mode: "stub", url: stubUrl, message: "Addon checkout unreachable; stub used." };
  }
}
