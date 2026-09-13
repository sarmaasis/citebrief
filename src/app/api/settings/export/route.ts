import { desc, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  brandKits,
  brands,
  competitors,
  prompts,
  reports,
  runs,
  subscriptions,
  workspaceInvites,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { requireOwner } from "@/lib/permissions";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getAppContext } from "@/lib/session";
import { jsonError } from "@/server/json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const denied = requireOwner(ctx, "Only the workspace owner can export workspace data.");
  if (denied) return denied;

  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.export, ctx.workspace.id);
  if (limited) return limited;

  const [workspace] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, ctx.workspace.id)).limit(1);
  const members = await ctx.db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      createdAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, ctx.workspace.id));
  const invites = await ctx.db
    .select({
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      acceptedAt: workspaceInvites.acceptedAt,
      expiresAt: workspaceInvites.expiresAt,
      createdAt: workspaceInvites.createdAt,
    })
    .from(workspaceInvites)
    .where(eq(workspaceInvites.workspaceId, ctx.workspace.id));
  const brandRows = await ctx.db.select().from(brands).where(eq(brands.workspaceId, ctx.workspace.id));
  const brandIds = brandRows.map((brand) => brand.id);
  const competitorRows = [];
  const promptRows = [];
  const runRows = [];
  const reportRows = [];
  for (const brandId of brandIds) {
    competitorRows.push(...(await ctx.db.select().from(competitors).where(eq(competitors.brandId, brandId))));
    promptRows.push(
      ...(await ctx.db
        .select({
          id: prompts.id,
          brandId: prompts.brandId,
          text: prompts.text,
          mix: prompts.mix,
          sortOrder: prompts.sortOrder,
        })
        .from(prompts)
        .where(eq(prompts.brandId, brandId))),
    );
    runRows.push(
      ...(await ctx.db
        .select({
          id: runs.id,
          brandId: runs.brandId,
          status: runs.status,
          periodStart: runs.periodStart,
          periodEnd: runs.periodEnd,
          extraRun: runs.extraRun,
          createdAt: runs.createdAt,
          completedAt: runs.completedAt,
        })
        .from(runs)
        .where(eq(runs.brandId, brandId))),
    );
    reportRows.push(
      ...(await ctx.db
        .select({
          id: reports.id,
          brandId: reports.brandId,
          runId: reports.runId,
          summary: reports.summary,
          scoreMentioned: reports.scoreMentioned,
          scoreRecommended: reports.scoreRecommended,
          scoreTotal: reports.scoreTotal,
          shareExpiresAt: reports.shareExpiresAt,
          shareRevokedAt: reports.shareRevokedAt,
          sentAt: reports.sentAt,
          createdAt: reports.createdAt,
        })
        .from(reports)
        .where(eq(reports.brandId, brandId))),
    );
  }
  const [kit] = await ctx.db.select().from(brandKits).where(eq(brandKits.workspaceId, ctx.workspace.id)).limit(1);
  const [sub] = await ctx.db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      billingInterval: subscriptions.billingInterval,
      trialEndsAt: subscriptions.trialEndsAt,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, ctx.workspace.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  await writeAuditLog(ctx.db, {
    action: "data.export",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "workspace",
    targetId: ctx.workspace.id,
    request,
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          timezone: workspace.timezone,
          senderName: workspace.senderName,
          senderDomain: workspace.senderDomain,
        }
      : null,
    members,
    invites,
    brands: brandRows,
    competitors: competitorRows,
    prompts: promptRows,
    runs: runRows,
    reports: reportRows,
    brandKit: kit
      ? {
          logoUrl: kit.logoUrl,
          accentColor: kit.accentColor,
          footerText: kit.footerText,
          preparedBy: kit.preparedBy,
        }
      : null,
    subscription: sub ?? null,
    notes: [
      "PDF binaries are not included. Download each report from the app while it remains in the 90-day window.",
      "Share tokens are omitted. Revoke client links in the report viewer if a link should stop working.",
    ],
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="citebrief-export-${ctx.workspace.id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
