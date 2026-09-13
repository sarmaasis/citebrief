import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReportViewer } from "@/components/reports/report-viewer";
import type { AuditEngineRow } from "@/components/reports/sources-drawer";
import { prompts, runRows } from "@/db/schema";
import { opportunityFromRow } from "@/lib/command-center";
import { workspaceEntitlements } from "@/lib/entitlements";
import { suggestedClientEmail } from "@/lib/report-writer";
import { getReportObject } from "@/lib/r2";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { brands, reports, runs } from "@/db/schema";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }
  const { id, reportId } = await params;

  const [row] = await ctx.db
    .select({
      report: reports,
      brand: brands,
      run: runs,
    })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .innerJoin(runs, eq(runs.id, reports.runId))
    .where(
      and(
        eq(reports.id, reportId),
        eq(brands.id, id),
        eq(brands.workspaceId, ctx.workspace.id),
      ),
    )
    .limit(1);

  if (!row) {
    notFound();
  }

  let html: string | null = null;
  if (row.report.htmlKey) {
    try {
      const { env } = await getCloudflareContext({ async: true });
      const bytes = await getReportObject(env, row.report.htmlKey);
      if (bytes) {
        html = new TextDecoder().decode(bytes);
      }
    } catch {
      html = null;
    }
  }

  const engineRows = await ctx.db
    .select({
      promptId: runRows.promptId,
      promptText: prompts.text,
      engine: runRows.engine,
      mentioned: runRows.mentioned,
      nextAction: runRows.nextAction,
      createdAt: runRows.createdAt,
      citedUrls: runRows.citedUrls,
      rawAnswer: runRows.rawAnswer,
      confidence: runRows.confidence,
      gatewayRequestId: runRows.gatewayRequestId,
      status: runRows.status,
    })
    .from(runRows)
    .innerJoin(prompts, eq(prompts.id, runRows.promptId))
    .where(eq(runRows.runId, row.run.id));

  const auditRows: AuditEngineRow[] = engineRows.map((item) => {
    let cited: string[] = [];
    if (item.citedUrls) {
      try {
        cited = JSON.parse(item.citedUrls) as string[];
      } catch {
        cited = [];
      }
    }
    return {
      promptId: item.promptId,
      promptText: item.promptText,
      engine: item.engine,
      mentioned: item.mentioned,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
      citedUrls: cited,
      rawAnswer: item.rawAnswer,
      confidence: item.confidence,
      gatewayRequestId: item.gatewayRequestId,
      status: item.status,
    };
  });

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const fallbackEmail = suggestedClientEmail({
    brand: row.brand.name,
    summary: row.report.summary || "",
    period: row.run.periodStart,
  });
  const reviewActions = [
    ...new Set(engineRows.map((item) => item.nextAction?.trim()).filter((item): item is string => Boolean(item))),
  ].slice(0, 3);
  const opportunity = opportunityFromRow({
    brand: { id, name: row.brand.name },
    promptCount: 20,
    mentionedDelta: null,
    latestRun: { status: row.run.status },
    latestReport: {
      id: row.report.id,
      sentAt: row.report.sentAt,
      scoreMentioned: row.report.scoreMentioned,
      scoreRecommended: row.report.scoreRecommended,
      scoreTotal: row.report.scoreTotal,
    },
  });

  return (
    <ReportViewer
      brandId={id}
      brandName={row.brand.name}
      reportId={row.report.id}
      period={row.run.periodStart}
      scoreMentioned={row.report.scoreMentioned}
      scoreRecommended={row.report.scoreRecommended}
      scoreTotal={row.report.scoreTotal}
      summary={row.report.summary}
      html={html}
      shareToken={row.report.shareToken}
      shareExpiresAt={row.report.shareExpiresAt ? new Date(row.report.shareExpiresAt).toISOString() : null}
      shareRevokedAt={row.report.shareRevokedAt ? new Date(row.report.shareRevokedAt).toISOString() : null}
      partial={row.run.status === "partial"}
      sentAt={row.report.sentAt ? new Date(row.report.sentAt).toISOString() : null}
      shareOpenCount={row.report.shareOpenCount}
      auditRows={auditRows}
      allowClientCc={ent.allowsClientCc}
      allowSend={ent.allowsEmailSend}
      allowApproval={ent.allowsApproval}
      approvalState={row.report.approvalState}
      showSources
      suggestedEmailSubject={row.report.suggestedEmailSubject || fallbackEmail.subject}
      suggestedEmailBody={row.report.suggestedEmailBody || fallbackEmail.body}
      reviewActions={reviewActions}
      upsellNote={opportunity ? `${opportunity.service}: ${opportunity.reason}` : null}
    />
  );
}
