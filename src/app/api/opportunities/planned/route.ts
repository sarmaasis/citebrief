import { and, eq } from "drizzle-orm";
import { brands, opportunityPlans } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { commandCenterDenial, workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

const KEYS = new Set(["geo_package", "comparison_page", "source_refresh", "pr_placement", "technical_seo"]);

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const denied = commandCenterDenial(ent);
  if (denied) return jsonError(denied.error, denied.status);

  const body = (await request.json().catch(() => ({}))) as {
    brandId?: string;
    reportId?: string | null;
    key?: string;
  };
  const brandId = body.brandId?.trim();
  const key = body.key?.trim();
  if (!brandId || !key || !KEYS.has(key)) {
    return jsonError("brandId and a known opportunity key are required.");
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

  if (existing) {
    await ctx.db
      .update(opportunityPlans)
      .set({ plannedAt: now, reportId: body.reportId?.trim() || existing.reportId })
      .where(eq(opportunityPlans.id, existing.id));
  } else {
    await ctx.db.insert(opportunityPlans).values({
      id: crypto.randomUUID(),
      workspaceId: ctx.workspace.id,
      brandId,
      reportId: body.reportId?.trim() || null,
      opportunityKey: key,
      plannedAt: now,
    });
  }

  await writeAuditLog(ctx.db, {
    action: "opportunity.planned",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "brand",
    targetId: brandId,
    request,
    metadata: { key, reportId: body.reportId ?? null },
  });

  return jsonOk({ ok: true, planned: true, key, brandId });
}
