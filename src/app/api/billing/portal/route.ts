import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDodoCustomerPortal } from "@/lib/dodo";
import { requireOwner } from "@/lib/permissions";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST() {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const denied = requireOwner(ctx, "Only the workspace owner can open the billing portal.");
  if (denied) return denied;
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
