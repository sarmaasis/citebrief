import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { brands, reports } from "@/db/schema";
import { workspaceEntitlements } from "@/lib/entitlements";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { deliverApprovedReport } from "@/lib/report-send";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { to?: string; ccClient?: string };

  const [row] = await ctx.db
    .select({ report: reports, brandName: brands.name })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .where(and(eq(reports.id, id), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);

  if (!row) {
    return jsonError("Report not found.", 404);
  }

  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.reportSend, ctx.workspace.id);
  if (limited) return limited;
  const to = body.to?.trim() || ctx.user.email;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);

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
  if (!result.ok) return jsonError(result.error, result.status);
  return jsonOk({ ok: true, to: result.to, ccClient: result.ccClient });
}
