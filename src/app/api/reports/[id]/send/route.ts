import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { brands, reports, workspaces } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email";
import { reportSendDenial, workspaceEntitlements } from "@/lib/entitlements";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { getAppContext } from "@/lib/session";
import { postSlackIncomingWebhook } from "@/lib/slack";
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
  const share = row.report.shareToken ? `${env.BETTER_AUTH_URL || ""}/r/${row.report.shareToken}` : "";
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const [workspace] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, ctx.workspace.id)).limit(1);

  const denial = reportSendDenial({
    ccClient: body.ccClient,
    allowsEmailSend: ent.allowsEmailSend,
    allowsClientCc: ent.allowsClientCc,
  });
  if (denial) {
    return jsonError(denial.error, denial.status);
  }

  await sendTransactionalEmail({
    to,
    subject: `${row.brandName}: Friday report`,
    html: `<p>Your report for <strong>${row.brandName}</strong> is ready.</p><p>${row.report.summary || ""}</p>${
      share ? `<p><a href="${share}">Open client link</a></p>` : ""
    }`,
    env,
    senderName: workspace?.senderName,
    senderDomain: workspace?.senderDomain,
    customSender: ent.allowsCustomSender,
  });

  if (body.ccClient?.trim()) {
    await sendTransactionalEmail({
      to: body.ccClient.trim(),
      subject: `${row.brandName}: this week's visibility report`,
      html: `<p>Prepared for you by ${ctx.workspace.name}.</p><p>${row.report.summary || ""}</p>${
        share ? `<p><a href="${share}">Read the report</a></p>` : ""
      }`,
      env,
      senderName: workspace?.senderName,
      senderDomain: workspace?.senderDomain,
      customSender: ent.allowsCustomSender,
    });
  }

  await ctx.db.update(reports).set({ sentAt: new Date() }).where(eq(reports.id, id));

  await writeAuditLog(ctx.db, {
    action: "report.send",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "report",
    targetId: id,
    request,
    metadata: { to, ccClient: body.ccClient?.trim() || null, brandId: row.report.brandId },
  });

  if (ent.allowsSlack && workspace?.slackWebhookUrl) {
    await postSlackIncomingWebhook({
      webhookUrl: workspace.slackWebhookUrl,
      text: `CiteBrief Friday send: ${row.brandName} emailed to ${to}${body.ccClient ? ` (CC ${body.ccClient})` : ""}.`,
    });
  }

  return jsonOk({ ok: true, to, ccClient: body.ccClient?.trim() || null });
}
