import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray } from "drizzle-orm";
import { brands, reports } from "@/db/schema";
import { workspaceEntitlements } from "@/lib/entitlements";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { deliverApprovedReport } from "@/lib/report-send";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  if (!ent.allowsBulkSend) {
    return jsonError("Bulk send requires Studio or Enterprise.", 403);
  }

  const body = (await request.json().catch(() => ({}))) as { ids?: unknown; to?: string; ccClient?: string };
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : [];
  if (ids.length === 0) return jsonError("ids is required.");
  if (ids.length > 25) return jsonError("Send at most 25 reports at once.");

  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.reportSend, ctx.workspace.id);
  if (limited) return limited;

  const rows = await ctx.db
    .select({ report: reports, brandName: brands.name })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .where(and(inArray(reports.id, ids), eq(brands.workspaceId, ctx.workspace.id)));

  if (rows.length === 0) return jsonError("No matching reports.", 404);

  const to = body.to?.trim() || ctx.user.email;
  const sent: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const row of rows) {
    const result = await deliverApprovedReport({
      db: ctx.db,
      env,
      workspaceId: ctx.workspace.id,
      workspaceName: ctx.workspace.name,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email,
      request,
      row,
      ent,
      to,
      ccClient: body.ccClient,
    });
    if (result.ok) sent.push(row.report.id);
    else errors.push({ id: row.report.id, error: result.error });
  }

  return jsonOk({ ok: errors.length === 0, sent: sent.length, ids: sent, errors });
}
