import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ENTERPRISE_CONTACT_SALES_MESSAGE, isStubSecret, parsePlanId } from "@/lib/billing";
import { isProductionRuntime } from "@/lib/runtime-env";
import { createDodoCheckoutHono } from "@/server/dodo-hono";
import { jsonError } from "@/server/json";

export const dynamic = "force-dynamic";

/**
 * Thin mount for official @dodopayments/hono Checkout handlers.
 * Primary agency checkout remains GET /api/checkout (auth + metadata).
 */
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (isStubSecret(env.DODO_PAYMENTS_API_KEY)) {
    if (isProductionRuntime(env)) {
      return jsonError("Billing is not configured.", 503);
    }
    const url = new URL(request.url);
    const plan = parsePlanId(url.searchParams.get("plan") || "agency");
    if (plan === "enterprise") {
      return jsonError(ENTERPRISE_CONTACT_SALES_MESSAGE, 403);
    }
    const dest = new URL("/api/checkout", url.origin);
    dest.searchParams.set("plan", url.searchParams.get("plan") || "agency");
    dest.searchParams.set("interval", url.searchParams.get("interval") || "monthly");
    dest.searchParams.set("redirect", url.searchParams.get("redirect") || "0");
    return Response.redirect(dest, 302);
  }
  const app = createDodoCheckoutHono(env);
  return app.fetch(new Request(new URL("/static" + new URL(request.url).search, "http://dodo.local"), request));
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (isStubSecret(env.DODO_PAYMENTS_API_KEY)) {
    return jsonError("DODO_PAYMENTS_API_KEY required for Hono checkout session.", 503);
  }
  const app = createDodoCheckoutHono(env);
  const body = await request.text();
  return app.fetch(
    new Request("http://dodo.local/session", {
      method: "POST",
      headers: request.headers,
      body,
    }),
  );
}
