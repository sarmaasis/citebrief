import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { getWorkspaceBrand } from "@/server/workspace-data";
import { buildEngineBreakdown } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Engine breakdown for a brand (DASHBOARD_FEATURES §7). */
export async function GET(_request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const { id } = await context.params;
  const brand = await getWorkspaceBrand(ctx, id);
  if (!brand) return jsonError("Brand not found.", 404);

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  if (!ent.paid && !ent.trialing) {
    return jsonError("Subscribe to unlock engine breakdown.", 403);
  }

  const engines = await buildEngineBreakdown(ctx, id);
  return jsonOk({ brandId: id, engines });
}
