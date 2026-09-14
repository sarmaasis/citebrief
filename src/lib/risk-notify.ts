import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { brands, reports, workspaces } from "@/db/schema";
import { clientRisk, type CommandRow } from "@/lib/command-center";
import { highRiskDigestEmail } from "@/emails";
import { sendTransactionalEmail } from "@/lib/email";
import type { WorkspaceEntitlements } from "@/lib/entitlements";

/**
 * Friday hook: if the workspace opted in, email At-risk brands from latest reports.
 * Uses stored report signals only — no extra model calls.
 * Remaining: per-user prefs, Slack mirror, and notify-on-create (not only Friday).
 */
export async function maybeSendHighRiskDigest(args: {
  db: Database;
  env: CloudflareEnv;
  workspace: typeof workspaces.$inferSelect;
  ent: WorkspaceEntitlements;
  notifyTo: string;
}): Promise<{ sent: boolean; count: number }> {
  const { db, env, workspace, ent, notifyTo } = args;
  if (!workspace.notifyHighRisks) return { sent: false, count: 0 };
  if (!ent.allowsPortfolioRollups || !ent.allowsEmailSend) return { sent: false, count: 0 };

  const activeBrands = await db
    .select()
    .from(brands)
    .where(and(eq(brands.workspaceId, workspace.id), isNull(brands.archivedAt)));

  const risks: Array<{ brandName: string; whatHappened: string; href: string }> = [];
  const origin = (env.BETTER_AUTH_URL || "").replace(/\/$/, "");

  for (const brand of activeBrands) {
    const reportList = await db
      .select()
      .from(reports)
      .where(eq(reports.brandId, brand.id))
      .orderBy(desc(reports.createdAt))
      .limit(2);
    const latest = reportList[0];
    const previous = reportList[1];
    if (!latest) continue;

    const mentionedDelta =
      previous?.scoreMentioned != null && latest.scoreMentioned != null
        ? latest.scoreMentioned - previous.scoreMentioned
        : null;

    const row: CommandRow & { brand: { id: string; name: string } } = {
      brand: { id: brand.id, name: brand.name },
      promptCount: latest.scoreTotal ?? 20,
      mentionedDelta,
      competitorLeadShare: null,
      competitorLeadCount: null,
      competitorLeader: null,
      sendOverdue: false,
      missingSources: false,
      latestRun: { status: "complete" },
      latestReport: {
        id: latest.id,
        sentAt: latest.sentAt,
        createdAt: latest.createdAt,
        scoreMentioned: latest.scoreMentioned,
        scoreRecommended: latest.scoreRecommended,
        scoreTotal: latest.scoreTotal ?? 20,
        approvalState: latest.approvalState,
      },
    };

    if (clientRisk(row) !== "at_risk") continue;
    const drop =
      mentionedDelta != null && mentionedDelta < 0
        ? `Named score dropped ${Math.abs(mentionedDelta)}.`
        : latest.scoreMentioned === 0
          ? "Named in 0 buyer questions."
          : "At-risk on the latest report.";
    risks.push({
      brandName: brand.name,
      whatHappened: drop,
      href: origin ? `${origin}/app/brands/${brand.id}/reports/${latest.id}` : `/app/brands/${brand.id}`,
    });
  }

  if (risks.length === 0) return { sent: false, count: 0 };

  const mail = highRiskDigestEmail({
    workspaceName: workspace.name,
    risks,
    risksUrl: origin ? `${origin}/app/risks` : undefined,
  });
  await sendTransactionalEmail({
    to: notifyTo,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    env,
  });

  await db
    .update(workspaces)
    .set({ highRiskLastNotifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(workspaces.id, workspace.id));

  return { sent: true, count: risks.length };
}
