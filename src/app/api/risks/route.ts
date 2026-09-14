import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { buildDashboardSnapshot } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

/** Risk alerts with firstSeen, affected prompts/engines (Agency+). */
export async function GET() {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  if (!ent.allowsPortfolioRollups) {
    return jsonError("Risk rollups require Agency, Studio, or Enterprise.", 403);
  }

  const snapshot = await buildDashboardSnapshot(ctx, ent);
  return jsonOk({ risks: snapshot.risks });
}
