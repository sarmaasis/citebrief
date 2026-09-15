import { and, eq, inArray } from "drizzle-orm";
import { brands, reports } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { AGENCY_PLUS_LABEL, GROWTH_PLUS_LABEL } from "@/lib/billing";
import { workspaceEntitlements } from "@/lib/entitlements";
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
    return jsonError(`Bulk approve requires ${AGENCY_PLUS_LABEL}.`, 403);
  }
  if (!ent.allowsApproval) {
    return jsonError(`Report approval is on ${GROWTH_PLUS_LABEL}.`, 403);
  }

  const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : [];
  if (ids.length === 0) return jsonError("ids is required.");
  if (ids.length > 50) return jsonError("Approve at most 50 reports at once.");

  const rows = await ctx.db
    .select({ id: reports.id })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .where(and(inArray(reports.id, ids), eq(brands.workspaceId, ctx.workspace.id)));

  const allowed = rows.map((row) => row.id);
  if (allowed.length === 0) return jsonError("No matching reports.", 404);

  await ctx.db
    .update(reports)
    .set({
      approvalState: "approved",
      approvedAt: new Date(),
      approvedByUserId: ctx.user.id,
    })
    .where(inArray(reports.id, allowed));

  await writeAuditLog(ctx.db, {
    action: "report.bulk_approve",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "report",
    targetId: allowed[0],
    request,
    metadata: { ids: allowed, count: allowed.length },
  });

  return jsonOk({ ok: true, approved: allowed.length, ids: allowed });
}
