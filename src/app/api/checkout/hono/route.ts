import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isStubSecret } from "@/lib/billing";
import { isProductionRuntime } from "@/lib/runtime-env";
import { createDodoCheckoutHono, planProductHint } from "@/server/dodo-hono";
import { jsonError, jsonOk } from "@/server/json";

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
    return jsonOk({
      mode: "stub",
      message: "Set DODO_PAYMENTS_API_KEY to use @dodopayments/hono Checkout.",
      products: planProductHint(env),
    });
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
