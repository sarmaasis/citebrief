import { and, eq } from "drizzle-orm";
import { brands, opportunityPlans } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { dashboardModulesForPlan, type OpportunityStatus } from "@/lib/dashboard-metrics";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

const KEYS = new Set(["geo_package", "comparison_page", "source_refresh", "pr_placement", "technical_seo"]);
const STATUSES = new Set<OpportunityStatus>(["open", "planned", "in_progress", "done", "dismissed"]);

/** Persist opportunity status: open | planned | in_progress | done | dismissed. */
export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const modules = dashboardModulesForPlan(ent);
  if (!modules.opportunityQueue && !modules.basicOpportunities) {
    return jsonError("Opportunities unlock on a paid plan or trial.", 403);
  }

  const body = (await request.json().catch(() => ({}))) as {
    brandId?: string;
    reportId?: string | null;
    key?: string;
    status?: string;
    owner?: string | null;
    effort?: string | null;
    impact?: string | null;
    suggestedAction?: string | null;
    suggestedPage?: string | null;
  };
  const brandId = body.brandId?.trim();
  const key = body.key?.trim();
  if (!brandId || !key || !KEYS.has(key)) {
    return jsonError("brandId and a known opportunity key are required.");
  }

  const status = (body.status?.trim() as OpportunityStatus | undefined) || "planned";
  if (!STATUSES.has(status)) {
    return jsonError("status must be open, planned, in_progress, done, or dismissed.");
  }

  const [brand] = await ctx.db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!brand) return jsonError("Brand not found.", 404);

  const now = new Date();
  const [existing] = await ctx.db
    .select()
    .from(opportunityPlans)
    .where(
      and(
        eq(opportunityPlans.workspaceId, ctx.workspace.id),
        eq(opportunityPlans.brandId, brandId),
        eq(opportunityPlans.opportunityKey, key),
      ),
    )
    .limit(1);

  const active = status === "open" || status === "planned" || status === "in_progress";
  const patch = {
    plannedAt: now,
    reportId: body.reportId?.trim() || existing?.reportId || null,
    status,
    owner: body.owner !== undefined ? body.owner?.trim() || null : existing?.owner || null,
    effort: body.effort !== undefined ? body.effort?.trim() || null : existing?.effort || null,
    impact: body.impact !== undefined ? body.impact?.trim() || null : existing?.impact || null,
    suggestedAction:
      body.suggestedAction !== undefined
        ? body.suggestedAction?.trim() || null
        : existing?.suggestedAction || null,
    suggestedPage:
      body.suggestedPage !== undefined
        ? body.suggestedPage?.trim() || null
        : existing?.suggestedPage || null,
    updatedAt: now,
    completedAt: status === "done" ? now : active ? null : existing?.completedAt || null,
    dismissedAt: status === "dismissed" ? now : active ? null : existing?.dismissedAt || null,
  };

  if (existing) {
    await ctx.db.update(opportunityPlans).set(patch).where(eq(opportunityPlans.id, existing.id));
  } else {
    await ctx.db.insert(opportunityPlans).values({
      id: crypto.randomUUID(),
      workspaceId: ctx.workspace.id,
      brandId,
      reportId: patch.reportId,
      opportunityKey: key,
      plannedAt: now,
      status,
      owner: patch.owner,
      effort: patch.effort,
      impact: patch.impact,
      suggestedAction: patch.suggestedAction,
      suggestedPage: patch.suggestedPage,
      updatedAt: now,
      completedAt: patch.completedAt,
      dismissedAt: patch.dismissedAt,
      createdAt: now,
    });
  }

  await writeAuditLog(ctx.db, {
    action:
      status === "done"
        ? "opportunity.completed"
        : status === "dismissed"
          ? "opportunity.dismissed"
          : "opportunity.status",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "brand",
    targetId: brandId,
    request,
    metadata: { key, reportId: body.reportId ?? null, status },
  });

  return jsonOk({
    ok: true,
    planned: status === "planned" || status === "in_progress",
    status,
    key,
    brandId,
  });
}
