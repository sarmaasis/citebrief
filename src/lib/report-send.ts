import { eq } from "drizzle-orm";
import { fridayReportEmail } from "@/emails";
import type { Database } from "@/db";
import { brandKits, reports, subscriptions, workspaces } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { sendTransactionalEmail } from "@/lib/email";
import { reportSendDenial, type WorkspaceEntitlements } from "@/lib/entitlements";
import { checksFromWorkspace, isCustomSenderDomainVerified } from "@/lib/sender-domain";
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
    allowsTrialClientCc: args.ent.allowsTrialClientCc,
    requiresApproval: args.ent.allowsApproval,
    approved: args.row.report.approvalState === "approved",
  });
  if (denial) {
    return { ok: false, error: denial.error, status: denial.status };
  }

  const trialOneShot = Boolean(args.ent.allowsTrialClientCc && args.ccClient?.trim());
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
  // Trial CC keeps CiteBrief chrome (not agency white-label) so the product is the CTA.
  const kitArgs = trialOneShot
    ? {
        preparedBy: "CiteBrief",
        logoUrl: undefined as string | undefined,
        accentColor: undefined as string | undefined,
        footerText: "Prepared with CiteBrief",
      }
    : {
        preparedBy: kit?.preparedBy || args.workspaceName,
        logoUrl: kit?.logoUrl ?? undefined,
        accentColor: kit?.accentColor ?? undefined,
        footerText: kit?.footerText ?? undefined,
      };
  const clientFacing = !trialOneShot;
  const domainVerified =
    !trialOneShot &&
    isCustomSenderDomainVerified({
      allowsCustomSender: args.ent.allowsCustomSender,
      senderDomain: workspace?.senderDomain,
      checks: checksFromWorkspace(workspace || {}),
    });
  // Trial / Agency always stay on getcitebrief.com. Studio custom From only when DNS checklist is complete.
  const useCustomSender = !trialOneShot && args.ent.allowsCustomSender;

  const agencyMail = fridayReportEmail({
    brandName: args.row.brandName,
    agencyName: kitArgs.preparedBy,
    subject: args.row.report.suggestedEmailSubject,
    body: args.row.report.suggestedEmailBody,
    summary: args.row.report.summary,
    shareUrl: share || undefined,
    clientFacing,
    kit: kitArgs,
  });

  // Paid: email agency `to`. Trial one-shot: only the client CC (CiteBrief-branded).
  if (!trialOneShot) {
    await sendTransactionalEmail({
      to: args.to,
      subject: agencyMail.subject,
      html: agencyMail.html,
      text: agencyMail.text,
      env: args.env,
      senderName: workspace?.senderName,
      senderDomain: workspace?.senderDomain,
      customSender: useCustomSender,
      domainVerified,
    });
  }

  if (args.ccClient?.trim()) {
    const clientMail = fridayReportEmail({
      brandName: args.row.brandName,
      agencyName: kitArgs.preparedBy,
      subject: trialOneShot
        ? `${args.row.brandName}: AI search visibility report`
        : `${args.row.brandName}: this week's visibility report`,
      body: args.row.report.suggestedEmailBody,
      summary: args.row.report.summary,
      shareUrl: share || undefined,
      clientFacing,
      kit: kitArgs,
    });
    await sendTransactionalEmail({
      to: args.ccClient.trim(),
      subject: clientMail.subject,
      html: clientMail.html,
      text: clientMail.text,
      env: args.env,
      senderName: trialOneShot ? undefined : workspace?.senderName,
      senderDomain: trialOneShot ? undefined : workspace?.senderDomain,
      customSender: trialOneShot ? false : useCustomSender,
      domainVerified: trialOneShot ? false : domainVerified,
    });
  }

  await args.db.update(reports).set({ sentAt: new Date() }).where(eq(reports.id, args.row.report.id));

  if (trialOneShot) {
    await args.db
      .update(subscriptions)
      .set({ trialClientCcUsed: true, updatedAt: new Date() })
      .where(eq(subscriptions.workspaceId, args.workspaceId));
  }

  await writeAuditLog(args.db, {
    action: "report.send",
    workspaceId: args.workspaceId,
    actorUserId: args.actorUserId,
    actorEmail: args.actorEmail,
    targetType: "report",
    targetId: args.row.report.id,
    request: args.request,
    metadata: {
      to: trialOneShot ? null : args.to,
      ccClient: args.ccClient?.trim() || null,
      brandId: args.row.report.brandId,
      trialClientCc: trialOneShot,
    },
  });

  if (args.ent.allowsSlack && workspace?.slackWebhookUrl) {
    await postSlackIncomingWebhook({
      webhookUrl: workspace.slackWebhookUrl,
      text: `CiteBrief Friday send: ${args.row.brandName} emailed to ${args.to}${args.ccClient ? ` (CC ${args.ccClient})` : ""}.`,
    });
  }

  return { ok: true, to: args.to, ccClient: args.ccClient?.trim() || null };
}
