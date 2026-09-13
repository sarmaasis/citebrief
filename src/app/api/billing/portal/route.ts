import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDodoCustomerPortal } from "@/lib/dodo";
import { writeAuditLog } from "@/lib/audit";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireOwner } from "@/lib/permissions";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const denied = requireOwner(ctx, "Only the workspace owner can open the billing portal.");
  if (denied) return denied;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.billing, ctx.workspace.id);
  if (limited) return limited;
  const origin = (env.BETTER_AUTH_URL || "").replace(/\/$/, "") || "http://localhost:3000";
  const portal = await createDodoCustomerPortal({
    env,
    customerId: sub?.dodoCustomerId || "",
    returnUrl: origin,
  });
  if (portal.mode === "unavailable") {
    return jsonError(portal.message, 503);
  }
  await writeAuditLog(ctx.db, {
    action: "billing.portal",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "subscription",
    targetId: sub?.id,
    request,
    metadata: { mode: portal.mode },
  });
  return jsonOk(portal);
}
