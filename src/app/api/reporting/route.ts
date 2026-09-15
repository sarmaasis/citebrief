import { GROWTH_PLUS_LABEL } from "@/lib/billing";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { buildClientReportingCenter } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

/** Monthly client summaries, before/after movement, and client notes (Agency+ email plans). */
export async function GET(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);

  if (!ent.allowsEmailSend) {
    return jsonError(`Client reporting center requires ${GROWTH_PLUS_LABEL}.`, 403);
  }

  const brandId = new URL(request.url).searchParams.get("brandId")?.trim() || null;
  const rows = await buildClientReportingCenter(ctx, ent);
  return jsonOk({
    reporting: brandId ? rows.filter((row) => row.brandId === brandId) : rows,
  });
}
