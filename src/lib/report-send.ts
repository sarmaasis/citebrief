import { eq } from "drizzle-orm";
import { fridayReportEmail } from "@/emails";
import type { Database } from "@/db";
import { brandKits, reports, workspaces } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { sendTransactionalEmail } from "@/lib/email";
import { reportSendDenial, type WorkspaceEntitlements } from "@/lib/entitlements";
import { postSlackIncomingWebhook } from "@/lib/slack";

export type ReportSendRow = {
  report: typeof reports.$inferSelect;
  brandName: string;
};

export async function deliverApprovedReport(args: {
  db: Database;
  env: CloudflareEnv;
  workspaceId: string;
  workspaceName: string;
  actorUserId: string;
  actorEmail: string;
  request?: Request;
  row: ReportSendRow;
  ent: WorkspaceEntitlements;
  to: string;
  ccClient?: string | null;
}): Promise<{ ok: true; to: string; ccClient: string | null } | { ok: false; error: string; status: number }> {
  const denial = reportSendDenial({
    ccClient: args.ccClient,
    allowsEmailSend: args.ent.allowsEmailSend,
    allowsClientCc: args.ent.allowsClientCc,
    requiresApproval: args.ent.allowsApproval,
    approved: args.row.report.approvalState === "approved",
  });
  if (denial) {
    return { ok: false, error: denial.error, status: denial.status };
  }

  const [workspace] = await args.db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, args.workspaceId))
    .limit(1);
  const [kit] = await args.db
    .select()
    .from(brandKits)
    .where(eq(brandKits.workspaceId, args.workspaceId))
    .limit(1);
  const origin = (args.env.BETTER_AUTH_URL || "").replace(/\/$/, "");
  const share = args.row.report.shareToken && origin ? `${origin}/r/${args.row.report.shareToken}` : "";
  const kitArgs = {
    preparedBy: kit?.preparedBy || args.workspaceName,
    logoUrl: kit?.logoUrl,
    accentColor: kit?.accentColor,
    footerText: kit?.footerText,
  };

  const agencyMail = fridayReportEmail({
    brandName: args.row.brandName,
    agencyName: kitArgs.preparedBy,
    subject: args.row.report.suggestedEmailSubject,
    body: args.row.report.suggestedEmailBody,
    summary: args.row.report.summary,
    shareUrl: share || undefined,
    clientFacing: true,
    kit: kitArgs,
  });

  await sendTransactionalEmail({
    to: args.to,
    subject: agencyMail.subject,
    html: agencyMail.html,
    text: agencyMail.text,
    env: args.env,
    senderName: workspace?.senderName,
    senderDomain: workspace?.senderDomain,
    customSender: args.ent.allowsCustomSender,
  });

  if (args.ccClient?.trim()) {
    const clientMail = fridayReportEmail({
      brandName: args.row.brandName,
      agencyName: kitArgs.preparedBy,
      subject: `${args.row.brandName}: this week's visibility report`,
      body: args.row.report.suggestedEmailBody,
      summary: args.row.report.summary,
      shareUrl: share || undefined,
      clientFacing: true,
      kit: kitArgs,
    });
    await sendTransactionalEmail({
      to: args.ccClient.trim(),
      subject: clientMail.subject,
      html: clientMail.html,
      text: clientMail.text,
      env: args.env,
      senderName: workspace?.senderName,
      senderDomain: workspace?.senderDomain,
      customSender: args.ent.allowsCustomSender,
    });
  }

  await args.db.update(reports).set({ sentAt: new Date() }).where(eq(reports.id, args.row.report.id));

  await writeAuditLog(args.db, {
    action: "report.send",
    workspaceId: args.workspaceId,
    actorUserId: args.actorUserId,
    actorEmail: args.actorEmail,
    targetType: "report",
    targetId: args.row.report.id,
    request: args.request,
    metadata: { to: args.to, ccClient: args.ccClient?.trim() || null, brandId: args.row.report.brandId },
  });

  if (args.ent.allowsSlack && workspace?.slackWebhookUrl) {
    await postSlackIncomingWebhook({
      webhookUrl: workspace.slackWebhookUrl,
      text: `CiteBrief Friday send: ${args.row.brandName} emailed to ${args.to}${args.ccClient ? ` (CC ${args.ccClient})` : ""}.`,
    });
  }

  return { ok: true, to: args.to, ccClient: args.ccClient?.trim() || null };
}
