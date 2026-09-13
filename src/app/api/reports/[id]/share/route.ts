import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { brands, reports } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getAppContext } from "@/lib/session";
import { revokeClientLink, rotateClientLink, shareAccessState } from "@/lib/share";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function loadOwnedReport(reportId: string) {
  const ctx = await getAppContext();
  if (!ctx) return { ctx: null as null, row: null };
  const [row] = await ctx.db
    .select({ report: reports, brandName: brands.name })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .where(and(eq(reports.id, reportId), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);
  return { ctx, row: row ?? null };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { ctx, row } = await loadOwnedReport(id);
  if (!ctx) return jsonError("Sign in required.", 401);
  if (!row) return jsonError("Report not found.", 404);
  return jsonOk({
    shareToken: row.report.shareToken,
    shareExpiresAt: row.report.shareExpiresAt,
    shareRevokedAt: row.report.shareRevokedAt,
    state: shareAccessState(row.report),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { ctx, row } = await loadOwnedReport(id);
  if (!ctx) return jsonError("Sign in required.", 401);
  if (!row) return jsonError("Report not found.", 404);

  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.shareManage, ctx.workspace.id);
  if (limited) return limited;

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action === "rotate" ? "rotate" : "revoke";

  if (action === "rotate") {
    const next = await rotateClientLink(ctx.db, id);
    await writeAuditLog(ctx.db, {
      action: "report.share_rotate",
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email,
      targetType: "report",
      targetId: id,
      request,
    });
    return jsonOk({
      ok: true,
      rotated: true,
      shareToken: next.token,
      shareExpiresAt: next.expiresAt.toISOString(),
      shareRevokedAt: null,
      state: "live" as const,
    });
  }

  await revokeClientLink(ctx.db, id);
  await writeAuditLog(ctx.db, {
    action: "report.share_revoke",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "report",
    targetId: id,
    request,
  });
  return jsonOk({
    ok: true,
    revoked: true,
    shareToken: row.report.shareToken,
    shareExpiresAt: row.report.shareExpiresAt,
    shareRevokedAt: new Date().toISOString(),
    state: "revoked" as const,
  });
}
