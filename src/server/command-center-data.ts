import { cache } from "react";
import { eq } from "drizzle-orm";
import { opportunityPlans, workspaces } from "@/db/schema";
import {
  agencyRoi,
  averageNamedScore,
  clampMinutesSaved,
  clientRisk,
  filterCommandRows,
  MINUTES_SAVED_DEFAULT,
  opportunityFromRow,
  pipelineCounts,
  pipelineStage,
  riskWhy,
  weeklyAction,
  type CommandCenterFilters,
} from "@/lib/command-center";
import {
  commandRowMatchesSavedView,
  type AgencySavedView,
} from "@/lib/dashboard-metrics";
import type { WorkspaceEntitlements } from "@/lib/entitlements";
import type { AppContext } from "@/lib/session";
import { listHomeRows, withSendOverdue } from "@/server/workspace-data";

/** Request-scoped: home + dashboard builders both call this. */
export const loadCommandRows = cache(async (ctx: AppContext, weekly: boolean, brandIds?: string[]) => {
  const [workspace] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, ctx.workspace.id)).limit(1);
  const rows = withSendOverdue(await listHomeRows(ctx, brandIds), {
    timezone: workspace?.timezone || "America/New_York",
    weekly,
  });
  const minutesSavedPerReport = clampMinutesSaved(workspace?.minutesSavedPerReport ?? MINUTES_SAVED_DEFAULT);
  const plans = await ctx.db
    .select()
    .from(opportunityPlans)
    .where(eq(opportunityPlans.workspaceId, ctx.workspace.id));
  const planned = new Set(plans.map((plan) => `${plan.brandId}:${plan.opportunityKey}`));
  return { rows, minutesSavedPerReport, planned, timezone: workspace?.timezone || "America/New_York" };
});

export function serializeCommandRow(
  row: Awaited<ReturnType<typeof loadCommandRows>>["rows"][number],
  ent: WorkspaceEntitlements,
  planned: Set<string>,
) {
  const opportunity = opportunityFromRow(row);
  return {
    brand: {
      id: row.brand.id,
      name: row.brand.name,
      clientOwner: row.brand.clientOwner,
    },
    promptCount: row.promptCount,
    mentionedDelta: row.mentionedDelta,
    competitorLeadShare: row.competitorLeadShare,
    competitorLeadCount: row.competitorLeadCount,
    competitorLeader: row.competitorLeader,
    sendOverdue: row.sendOverdue,
    missingSources: row.missingSources,
    latestRun: row.latestRun ? { id: row.latestRun.id, status: row.latestRun.status } : null,
    latestReport: row.latestReport
      ? {
          id: row.latestReport.id,
          sentAt: row.latestReport.sentAt,
          createdAt: row.latestReport.createdAt,
          scoreMentioned: row.latestReport.scoreMentioned,
          scoreRecommended: row.latestReport.scoreRecommended,
          scoreTotal: row.latestReport.scoreTotal,
          approvalState: row.latestReport.approvalState,
        }
      : null,
    risk: clientRisk(row),
    why: riskWhy(row),
    pipeline: pipelineStage(row),
    action: weeklyAction(row, ent.allowsEmailSend),
    opportunity: opportunity
      ? { ...opportunity, planned: planned.has(`${opportunity.brandId}:${opportunity.key}`) }
      : null,
  };
}

export async function buildCommandCenterSnapshot(
  ctx: AppContext,
  ent: WorkspaceEntitlements,
  filters: CommandCenterFilters = {},
  opts?: { view?: AgencySavedView },
) {
  const { rows, minutesSavedPerReport, planned } = await loadCommandRows(ctx, ent.allowsWeeklyCadence);
  const view = opts?.view ?? "all";
  const filtered = filterCommandRows(rows, filters).filter((row) => commandRowMatchesSavedView(row, view));
  const opportunities = filtered
    .map((row) => opportunityFromRow(row))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ ...item, planned: planned.has(`${item.brandId}:${item.key}`) }));
  const pipeline = pipelineCounts(filtered);
  const reportsGenerated = filtered.filter((row) => Boolean(row.latestReport)).length;
  const reportsSent = filtered.filter((row) => Boolean(row.latestReport?.sentAt)).length;
  const roi = agencyRoi({
    brands: filtered.length,
    reportsGenerated,
    reportsSent,
    opportunities: opportunities.length,
    minutesPerReport: minutesSavedPerReport,
  });

  return {
    modules: {
      portfolio: ent.allowsPortfolioRollups,
      risk: ent.allowsPortfolioRollups,
      opportunities: ent.allowsOpportunityRollups,
      weeklySendQueue: ent.allowsWeeklySendQueue,
      bulk: ent.allowsBulkSend,
      export: ent.allowsPortfolioExport,
    },
    minutesSavedPerReport,
    view,
    unfilteredCount: rows.length,
    kpis: {
      clientsMonitored: filtered.length,
      portfolioVisibility: averageNamedScore(filtered),
      reportsReady: pipeline.needs_review + pipeline.ready_to_send,
      reportsSent,
      clientsAtRisk: filtered.filter((row) => clientRisk(row) === "at_risk").length,
      opportunitiesFound: opportunities.length,
      hoursSaved: roi.hoursSaved,
      failedOrPartial: filtered.filter(
        (row) => row.latestRun?.status === "failed" || row.latestRun?.status === "partial",
      ).length,
    },
    pipeline,
    roi,
    rows: filtered.map((row) => serializeCommandRow(row, ent, planned)),
    opportunities,
    risks: filtered
      .filter((row) => clientRisk(row) !== "stable")
      .map((row) => ({
        brandId: row.brand.id,
        brandName: row.brand.name,
        risk: clientRisk(row),
        why: riskWhy(row),
        href: row.latestReport
          ? `/app/brands/${row.brand.id}/reports/${row.latestReport.id}`
          : `/app/brands/${row.brand.id}`,
      })),
    actions: filtered
      .map((row) => weeklyAction(row, ent.allowsEmailSend))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  };
}

export function filtersFromSearch(search: URLSearchParams): CommandCenterFilters {
  return {
    owner: search.get("owner"),
    risk: search.get("risk"),
    pipeline: search.get("stage") || search.get("pipeline"),
    brandId: search.get("brandId") || search.get("brand"),
    sent: search.get("sent"),
    opportunityType: search.get("opportunityType"),
  };
}
