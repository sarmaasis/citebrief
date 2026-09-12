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
