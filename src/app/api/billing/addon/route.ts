import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDodoAddonCheckout } from "@/lib/dodo";
import { bumpExtraBrands } from "@/lib/usage";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const body = (await request.json().catch(() => ({}))) as { addon?: string };
  const addon = body.addon === "extra_run" ? "extra_run" : body.addon === "extra_brand" ? "extra_brand" : null;
  if (!addon) return jsonError("addon must be extra_brand or extra_run.");

  const { env } = await getCloudflareContext({ async: true });
  const origin = (env.BETTER_AUTH_URL || "").replace(/\/$/, "") || "http://localhost:3000";
  const checkout = await createDodoAddonCheckout({
    env,
    workspaceId: ctx.workspace.id,
    customerEmail: ctx.user.email,
    customerName: ctx.user.name,
    returnUrl: origin,
    addon,
  });

  // Stub mode: apply extra brand immediately so local caps reflect purchase.
  if (checkout.mode === "stub" && addon === "extra_brand") {
    await bumpExtraBrands(ctx.db, ctx.workspace.id, 1);
  }

  return jsonOk({ addon, ...checkout });
}
