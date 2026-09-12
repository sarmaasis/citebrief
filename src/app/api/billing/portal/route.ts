import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDodoCustomerPortal } from "@/lib/dodo";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST() {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const { env } = await getCloudflareContext({ async: true });
  const origin = (env.BETTER_AUTH_URL || "").replace(/\/$/, "") || "http://localhost:3000";
  const portal = await createDodoCustomerPortal({
    env,
    customerId: sub?.dodoCustomerId || "",
    returnUrl: origin,
  });
  return jsonOk(portal);
}
