import { dashboardModulesForPlan } from "@/lib/dashboard-metrics";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { buildDashboardSnapshot } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

/** Opportunity queue with statuses, relatedPrompt/Engine, scoring (Agency+ full; trial/Starter top 3). */
export async function GET() {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const modules = dashboardModulesForPlan(ent);

  if (!modules.opportunityQueue && !modules.basicOpportunities) {
    return jsonError("Opportunities unlock on a paid plan or trial.", 403);
  }

  const snapshot = await buildDashboardSnapshot(ctx, ent);
  const opportunities = modules.opportunityQueue
    ? snapshot.opportunities
    : snapshot.opportunities.slice(0, 3);

  return jsonOk({ opportunities });
}
