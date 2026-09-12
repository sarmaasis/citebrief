import { isStubSecret, type PlanId, PLANS } from "@/lib/billing";

export type DodoCheckoutResult =
  | { mode: "redirect"; url: string }
  | { mode: "stub"; url: string; message: string };

export function dodoProductLabel(plan: PlanId) {
  return `CiteBrief ${PLANS[plan].name}`;
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

  // Hosted checkout stub shape when keys exist but full @dodopayments/hono adapter is not wired.
  // Real integration: swap this body for Dodo SDK / Hono checkout helper.
  try {
    const base =
      args.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
        ? "https://live.dodopayments.com"
        : "https://test.dodopayments.com";
    const response = await fetch(`${base}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.env.DODO_PAYMENTS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: `citebrief_${args.plan}`,
            quantity: 1,
          },
        ],
        customer: {
          email: args.customerEmail,
          name: args.customerName,
        },
        return_url: `${args.returnUrl}${successPath}`,
        metadata: {
          workspace_id: args.workspaceId,
          plan: args.plan,
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.info("[dodo] checkout failed, falling back to stub", response.status, detail);
      return { mode: "stub", url: stubUrl, message: "Dodo checkout failed; stub URL used." };
    }

    const data = (await response.json()) as { checkout_url?: string; url?: string };
    const url = data.checkout_url || data.url;
    if (!url) {
      return { mode: "stub", url: stubUrl, message: "Dodo response missing URL; stub used." };
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
    // Local/dev: accept payloads so idempotent handling can be tested.
    return true;
  }
  if (!args.signature) {
    return false;
  }
  // Minimal stub verifier: require matching shared secret header until official SDK is wired.
  return args.signature === args.env.DODO_PAYMENTS_WEBHOOK_KEY || args.signature.includes(args.env.DODO_PAYMENTS_WEBHOOK_KEY);
}

export type DodoWebhookEvent = {
  id?: string;
  event_id?: string;
  type?: string;
  event_type?: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};
