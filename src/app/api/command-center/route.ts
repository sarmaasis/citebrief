import { AGENCY_PLUS_LABEL } from "@/lib/billing";
import { commandCenterDenial, workspaceEntitlements } from "@/lib/entitlements";
import { commandCenterCsv } from "@/lib/command-center";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildCommandCenterSnapshot, filtersFromSearch, loadCommandRows } from "@/server/command-center-data";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const denied = commandCenterDenial(ent);
  if (denied) return jsonError(denied.error, denied.status);

  const url = new URL(request.url);
  const filters = filtersFromSearch(url.searchParams);

  if (url.searchParams.get("format") === "csv") {
    if (!ent.allowsPortfolioExport) {
      return jsonError(`Portfolio export requires ${AGENCY_PLUS_LABEL}.`, 403);
    }
    const { rows } = await loadCommandRows(ctx, ent.allowsWeeklyCadence);
    return new Response(commandCenterCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=citebrief-portfolio.csv",
        "Cache-Control": "no-store",
      },
    });
  }

  const snapshot = await buildCommandCenterSnapshot(ctx, ent, filters);
  return jsonOk(snapshot);
}
