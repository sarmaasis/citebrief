import { and, eq } from "drizzle-orm";
import { brands, reports } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { GROWTH_PLUS_LABEL } from "@/lib/billing";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);

  const { id } = await context.params;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  if (!ent.allowsApproval) {
    return jsonError(`Report approval is on ${GROWTH_PLUS_LABEL}.`, 403);
  }

  const [row] = await ctx.db
    .select({ report: reports })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .where(and(eq(reports.id, id), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) return jsonError("Report not found.", 404);

  await ctx.db
    .update(reports)
    .set({
      approvalState: "approved",
      approvedAt: new Date(),
      approvedByUserId: ctx.user.id,
    })
    .where(eq(reports.id, id));

  await writeAuditLog(ctx.db, {
    action: "report.approve",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "report",
    targetId: id,
  });

  return jsonOk({ ok: true, approvalState: "approved" });
}
