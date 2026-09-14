import { parseAgencySavedView } from "@/lib/dashboard-metrics";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { buildDashboardSnapshot } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

/** Executive overview, scorecards, opportunities, risks, competitor leaderboard.
 * Query: `view=` or `saved=` = needs_attention|reports_due|recent_wins|competitor_threats
 */
export async function GET(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);

  // Starter/trial get overview + scorecards; Agency+ get full command-center modules.
  if (!ent.paid && !ent.trialing) {
    return jsonError("Subscribe to unlock the dashboard.", 403);
  }

  const params = new URL(request.url).searchParams;
  const view = parseAgencySavedView(params.get("view") || params.get("saved"));
  const snapshot = await buildDashboardSnapshot(ctx, ent, { view });

  // Soft-gate advanced modules in the payload; pages still use entitlements.
  if (!ent.allowsCommandCenter) {
    return jsonOk({
      ...snapshot,
      competitorLeaderboard: snapshot.modules.competitorLeaderboard
        ? snapshot.competitorLeaderboard
        : snapshot.competitorLeaderboard.slice(0, 5),
      risks: snapshot.modules.riskAlerts ? snapshot.risks : [],
      opportunities: snapshot.modules.opportunityQueue
        ? snapshot.opportunities
        : snapshot.opportunities.slice(0, 3),
    });
  }

  return jsonOk(snapshot);
}
