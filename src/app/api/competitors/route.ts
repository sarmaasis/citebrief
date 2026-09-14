import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { buildDashboardSnapshot } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

/**
 * Competitor leaderboard.
 * Trial/Starter: basic top-5 mentions (matches /app/competitors page).
 * Agency+: full leaderboard; advanced cited-page intel flagged separately.
 */
export async function GET() {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);

  if (!ent.paid && !ent.trialing) {
    return jsonError("Subscribe to unlock competitor intelligence.", 403);
  }

  const snapshot = await buildDashboardSnapshot(ctx, ent);
  const full = snapshot.modules.competitorLeaderboard;
  const competitors = full
    ? snapshot.competitorLeaderboard
    : snapshot.competitorLeaderboard.slice(0, 5);

  return jsonOk({
    competitors,
    basic: !full,
    advanced: snapshot.modules.advancedCompetitorIntel,
  });
}
