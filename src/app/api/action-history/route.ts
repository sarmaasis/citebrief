import { GROWTH_PLUS_LABEL } from "@/lib/billing";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { buildActionHistory } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

/** Action history (DASHBOARD_FEATURES §10). Agency+ or paid history plans. */
export async function GET(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  if (!ent.allowsHistory && !ent.allowsCommandCenter) {
    return jsonError(`Action history requires ${GROWTH_PLUS_LABEL}.`, 403);
  }

  const limitRaw = Number(new URL(request.url).searchParams.get("limit") || "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 50;
  const items = await buildActionHistory(ctx, limit);
  return jsonOk({ items });
}
