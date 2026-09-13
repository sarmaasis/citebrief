import { commandCenterDenial, workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildCommandCenterSnapshot, filtersFromSearch } from "@/server/command-center-data";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const denied = commandCenterDenial(ent);
  if (denied) return jsonError(denied.error, denied.status);
  if (!ent.allowsWeeklySendQueue) {
    return jsonError("The Friday send queue requires Agency, Studio, or Enterprise.", 403);
  }
  const snapshot = await buildCommandCenterSnapshot(ctx, ent, filtersFromSearch(new URL(request.url).searchParams));
  return jsonOk({
    pipeline: snapshot.pipeline,
    rows: snapshot.rows,
    actions: snapshot.actions,
  });
}
