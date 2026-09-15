import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { auditLogs, brands, opportunityPlans, prompts, reports, runRows, runs, workspaces } from "@/db/schema";
import {
  buildClientReportingSummary,
  buildExecutiveOverview,
  buildOpportunityQueueItem,
  buildRiskAlert,
  buildScorecard,
  dashboardModulesForPlan,
  aggregateCompetitorLeaderboard,
  commandRowMatchesSavedView,
  relatedSignalsForOpportunity,
  riskAffectedFromSignals,
  type ActionHistoryItem,
  type AgencySavedView,
  type ClientReportingSummary,
  type EngineBreakdownRow,
  type OpportunitySignalRow,
  type OpportunityStatus,
  type PromptPerformanceRow,
  type ScorecardMetrics,
} from "@/lib/dashboard-metrics";
import { opportunityFromRow, type CommandRow } from "@/lib/command-center";
import type { WorkspaceEntitlements } from "@/lib/entitlements";
import { CORE_ENGINES, parseEngineStatus, TRIAL_ENGINE_IDS, AGENCY_ENGINE_IDS } from "@/lib/engines";
import { nextScheduledRunAt } from "@/lib/friday-tz";
import type { AppContext } from "@/lib/session";
import { countMonthlyRechecksUsed, getWorkspaceSubscription } from "@/lib/usage";
import { loadCommandRows, serializeCommandRow } from "@/server/command-center-data";

function parseCitedUrls(raw: string | null | undefined): string[] {
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function enginesForEnt(ent: WorkspaceEntitlements) {
  if (!ent.paid) return TRIAL_ENGINE_IDS.length;
  return AGENCY_ENGINE_IDS.length;
}

export async function loadOpportunityStatuses(ctx: AppContext) {
  const plans = await ctx.db
    .select()
    .from(opportunityPlans)
    .where(eq(opportunityPlans.workspaceId, ctx.workspace.id));
  const map = new Map<string, { status: OpportunityStatus; owner: string | null }>();
  for (const plan of plans) {
    const status = (plan.status as OpportunityStatus | undefined) || "planned";
    map.set(`${plan.brandId}:${plan.opportunityKey}`, {
      status,
      owner: plan.owner ?? null,
    });
  }
  return map;
}

export async function buildDashboardSnapshot(
  ctx: AppContext,
  ent: WorkspaceEntitlements,
  opts?: { view?: AgencySavedView; brandIds?: string[] },
) {
  const { rows, minutesSavedPerReport, planned } = await loadCommandRows(
    ctx,
    ent.allowsWeeklyCadence,
    opts?.brandIds,
  );
  const [workspace] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, ctx.workspace.id)).limit(1);
  const timezone = workspace?.timezone || "America/New_York";
  const statusMap = await loadOpportunityStatuses(ctx);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const rechecksUsed = ent.paid ? await countMonthlyRechecksUsed(ctx.db, ctx.workspace.id, sub?.plan) : 0;
  const enginesMonitored = enginesForEnt(ent);
  const view = opts?.view ?? "all";

  const runIds = rows.map((row) => row.latestRun?.id).filter((id): id is string => Boolean(id));
  const previousRunIds = rows
    .map((row) => {
      const prev = "previousReport" in row ? row.previousReport : null;
      return prev && typeof prev === "object" && prev && "runId" in prev
        ? (prev as { runId: string }).runId
        : null;
    })
    .filter((id): id is string => Boolean(id));
  const citationByBrand = new Map<string, { cited: number; total: number }>();
  const winLoseByBrand = new Map<string, { win: number; lose: number }>();
  const signalsByBrand = new Map<string, OpportunitySignalRow[]>();
  const competitorRows: Array<{
    brandId: string;
    brandName: string;
    whoWon: string | null;
    citedUrls: string | null;
    engine: string;
    promptText: string | null;
  }> = [];
  const previousCompetitorRows: Array<{
    brandId: string;
    brandName: string;
    whoWon: string | null;
  }> = [];

  if (runIds.length > 0) {
    const signalRows = await ctx.db
      .select({
        runId: runRows.runId,
        promptId: runRows.promptId,
        promptText: prompts.text,
        mentioned: runRows.mentioned,
        recommended: runRows.recommended,
        whoWon: runRows.whoWon,
        citedUrls: runRows.citedUrls,
        citedBrandUrl: runRows.citedBrandUrl,
        engine: runRows.engine,
        brandId: runs.brandId,
        status: runRows.status,
      })
      .from(runRows)
      .innerJoin(runs, eq(runs.id, runRows.runId))
      .innerJoin(prompts, eq(prompts.id, runRows.promptId))
      .where(inArray(runRows.runId, runIds));

    const brandName = new Map(rows.map((row) => [row.brand.id, row.brand.name]));
    for (const row of signalRows) {
      const cite = citationByBrand.get(row.brandId) ?? { cited: 0, total: 0 };
      cite.total += 1;
      if (row.citedBrandUrl || parseCitedUrls(row.citedUrls).length > 0) cite.cited += 1;
      citationByBrand.set(row.brandId, cite);

      const wl = winLoseByBrand.get(row.brandId) ?? { win: 0, lose: 0 };
      if (row.recommended) wl.win += 1;
      else if (row.mentioned === false || (row.whoWon && row.whoWon !== brandName.get(row.brandId))) wl.lose += 1;
      winLoseByBrand.set(row.brandId, wl);

      const brandSignals = signalsByBrand.get(row.brandId) ?? [];
      brandSignals.push({
        promptText: row.promptText,
        engine: row.engine,
        mentioned: row.mentioned,
        recommended: row.recommended,
        whoWon: row.whoWon,
        citedUrls: row.citedUrls,
        citedBrandUrl: row.citedBrandUrl,
        status: row.status,
      });
      signalsByBrand.set(row.brandId, brandSignals);

      competitorRows.push({
        brandId: row.brandId,
        brandName: brandName.get(row.brandId) || "",
        whoWon: row.whoWon,
        citedUrls: row.citedUrls,
        engine: row.engine,
        promptText: row.promptText,
      });
    }
  }

  if (previousRunIds.length > 0) {
    const prevSignalRows = await ctx.db
      .select({
        whoWon: runRows.whoWon,
        brandId: runs.brandId,
        brandName: brands.name,
      })
      .from(runRows)
      .innerJoin(runs, eq(runs.id, runRows.runId))
      .innerJoin(brands, eq(brands.id, runs.brandId))
      .where(inArray(runRows.runId, previousRunIds));
    for (const row of prevSignalRows) {
      previousCompetitorRows.push({
        brandId: row.brandId,
        brandName: row.brandName,
        whoWon: row.whoWon,
      });
    }
  }

  const studioScoring =
    ent.plan === "studio" || ent.plan === "enterprise" || Boolean(ent.allowsPortfolioExport);
  const nextRun = nextScheduledRunAt({
    timezone,
    weekly: ent.allowsWeeklyCadence,
  });

  const filteredRows = rows.filter((row) => commandRowMatchesSavedView(row, view));

  const scorecards: ScorecardMetrics[] = filteredRows.map((row) => {
    const cite = citationByBrand.get(row.brand.id);
    const wl = winLoseByBrand.get(row.brand.id);
    const opportunity = opportunityFromRow(row);
    const persisted = opportunity
      ? statusMap.get(`${row.brand.id}:${opportunity.key}`)
      : undefined;
    const status: OpportunityStatus =
      persisted?.status ??
      (opportunity && planned.has(`${row.brand.id}:${opportunity.key}`) ? "planned" : "open");
    const openCount = opportunity && status !== "done" && status !== "dismissed" ? 1 : 0;
    const card = buildScorecard(
      {
        ...row,
        brand: {
          id: row.brand.id,
          name: row.brand.name,
          siteUrl: "siteUrl" in row.brand ? (row.brand.siteUrl as string | null) : null,
          clientOwner: row.brand.clientOwner,
        },
      },
      {
        citationShare: cite && cite.total ? Math.round((cite.cited / cite.total) * 1000) / 10 : null,
        winningPrompts: wl?.win ?? 0,
        losingPrompts: wl?.lose ?? 0,
        openOpportunities: openCount,
        enginesMonitored,
        nextScheduledRunAt: nextRun?.toISOString() ?? null,
      },
    );
    card.lastRunAt =
      row.latestRun && "createdAt" in row.latestRun && row.latestRun.createdAt
        ? new Date(row.latestRun.createdAt as Date | string).toISOString()
        : null;
    return card;
  });

  const opportunities = filteredRows
    .map((row) => {
      const opportunity = opportunityFromRow(row);
      if (!opportunity) return null;
      const persisted = statusMap.get(`${row.brand.id}:${opportunity.key}`);
      const status: OpportunityStatus =
        persisted?.status ?? (planned.has(`${row.brand.id}:${opportunity.key}`) ? "planned" : "open");
      const related = relatedSignalsForOpportunity(
        opportunity.key,
        row.brand.name,
        signalsByBrand.get(row.brand.id) ?? [],
      );
      const item = buildOpportunityQueueItem(row, status, studioScoring, related);
      if (item && persisted?.owner) item.owner = persisted.owner;
      return item;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const risks = filteredRows
    .map((row) => {
      const affected = riskAffectedFromSignals(row, signalsByBrand.get(row.brand.id) ?? []);
      const previousReport =
        "previousReport" in row && row.previousReport
          ? (row.previousReport as { createdAt?: Date | string | null })
          : null;
      const firstSeenAt =
        row.mentionedDelta != null && row.mentionedDelta < 0 && previousReport?.createdAt
          ? new Date(previousReport.createdAt).toISOString()
          : row.latestReport?.createdAt
            ? new Date(row.latestReport.createdAt).toISOString()
            : null;
      return buildRiskAlert(row, {
        firstSeenAt,
        lastSeenAt: row.latestReport?.createdAt ? new Date(row.latestReport.createdAt).toISOString() : null,
        affectedPrompts: affected.affectedPrompts,
        affectedEngines: affected.affectedEngines,
        lastNotifiedAt: workspace?.highRiskLastNotifiedAt ?? null,
      });
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const competitorLeaderboard = aggregateCompetitorLeaderboard(
    competitorRows.filter((row) => filteredRows.some((item) => item.brand.id === row.brandId)),
    previousCompetitorRows,
  );

  const overview = buildExecutiveOverview({
    rows: filteredRows,
    allowsEmailSend: ent.allowsEmailSend,
    enginesMonitored,
    competitorMentions: competitorLeaderboard.reduce((sum, row) => sum + row.mentionCount, 0),
    recheckCreditsUsed: rechecksUsed,
    recheckCreditsRemaining: Math.max(0, ent.monthlyRecheckCredits - rechecksUsed),
    recheckCreditsIncluded: ent.monthlyRecheckCredits,
  });

  return {
    modules: dashboardModulesForPlan(ent),
    minutesSavedPerReport,
    view,
    overview,
    scorecards,
    opportunities,
    risks,
    competitorLeaderboard,
    notifyHighRisks: Boolean(workspace?.notifyHighRisks),
    highRiskLastNotifiedAt: workspace?.highRiskLastNotifiedAt
      ? new Date(workspace.highRiskLastNotifiedAt).toISOString()
      : null,
    rows: filteredRows.map((row) => serializeCommandRow(row, ent, planned)),
  };
}

export async function buildPromptPerformance(
  ctx: AppContext,
  brandId: string,
): Promise<PromptPerformanceRow[]> {
  const brand = await ctx.db
    .select()
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!brand) return [];

  const reportList = await ctx.db
    .select()
    .from(reports)
    .where(eq(reports.brandId, brandId))
    .orderBy(desc(reports.createdAt))
    .limit(6);
  const latest = reportList[0];
  const previous = reportList[1];
  if (!latest) return [];

  const historyRuns = reportList.slice().reverse();
  const historyRowSets = await Promise.all(
    historyRuns.map((report) => ctx.db.select().from(runRows).where(eq(runRows.runId, report.runId))),
  );

  const [latestRows, previousRows, promptRows] = await Promise.all([
    Promise.resolve(historyRowSets[historyRowSets.length - 1] ?? []),
    previous
      ? Promise.resolve(historyRowSets[historyRowSets.length - 2] ?? [])
      : Promise.resolve([] as (typeof runRows.$inferSelect)[]),
    ctx.db.select().from(prompts).where(eq(prompts.brandId, brandId)),
  ]);

  const promptById = new Map(promptRows.map((row) => [row.id, row]));
  const prevMention = new Map<string, boolean>();
  for (const row of previousRows) {
    if (row.mentioned) prevMention.set(row.promptId, true);
  }

  const historyScoreByPrompt = new Map<string, number[]>();
  for (const rows of historyRowSets) {
    const byPrompt = new Map<string, { mentioned: boolean; recommended: boolean }>();
    for (const row of rows) {
      const current = byPrompt.get(row.promptId) ?? { mentioned: false, recommended: false };
      if (row.mentioned) current.mentioned = true;
      if (row.recommended) current.recommended = true;
      byPrompt.set(row.promptId, current);
    }
    for (const [promptId, data] of byPrompt) {
      const score = data.recommended ? 100 : data.mentioned ? 50 : 0;
      const series = historyScoreByPrompt.get(promptId) ?? [];
      series.push(score);
      historyScoreByPrompt.set(promptId, series);
    }
  }

  const byPrompt = new Map<
    string,
    {
      mentioned: boolean;
      recommended: boolean;
      position: number | null;
      competitors: Set<string>;
      citedUrls: Set<string>;
      engines: Set<string>;
      summary: string | null;
      failed: boolean;
    }
  >();

  for (const row of latestRows) {
    const current = byPrompt.get(row.promptId) ?? {
      mentioned: false,
      recommended: false,
      position: null,
      competitors: new Set<string>(),
      citedUrls: new Set<string>(),
      engines: new Set<string>(),
      summary: null,
      failed: false,
    };
    if (row.mentioned) current.mentioned = true;
    if (row.recommended) current.recommended = true;
    if (row.rankInShortlist != null) {
      current.position =
        current.position == null ? row.rankInShortlist : Math.min(current.position, row.rankInShortlist);
    }
    if (row.whoWon && row.whoWon.trim() && row.whoWon.trim().toLowerCase() !== brand.name.toLowerCase()) {
      current.competitors.add(row.whoWon.trim());
    }
    for (const url of parseCitedUrls(row.citedUrls)) current.citedUrls.add(url);
    current.engines.add(row.engine);
    if (row.sentence && !current.summary) current.summary = row.sentence;
    if (row.status === "failed") current.failed = true;
    byPrompt.set(row.promptId, current);
  }

  const out: PromptPerformanceRow[] = [];
  for (const [promptId, data] of byPrompt) {
    const prompt = promptById.get(promptId);
    if (!prompt) continue;
    const prev = prevMention.has(promptId);
    const movement = data.mentioned === prev ? 0 : data.mentioned ? 1 : -1;
    const filterTags: PromptPerformanceRow["filterTags"] = [];
    if (data.recommended) filterTags.push("winning");
    if (!data.mentioned) filterTags.push("no_mention", "losing");
    if (data.mentioned && !data.recommended) filterTags.push("losing");
    if (data.competitors.size > 0 && !data.recommended) filterTags.push("competitor_wins");
    if (prompt.mix === "category" || prompt.mix === "alternatives" || prompt.mix === "vs") {
      filterTags.push("high_intent");
    }
    if (previous && movement !== 0) filterTags.push("recently_changed");
    if (data.failed) filterTags.push("failed");

    out.push({
      promptId,
      brandId,
      brandName: brand.name,
      text: prompt.text,
      mix: prompt.mix,
      visibilityScore: data.recommended ? 100 : data.mentioned ? 50 : 0,
      mentioned: data.mentioned,
      recommended: data.recommended,
      brandPosition: data.position,
      competitors: [...data.competitors],
      citedUrls: [...data.citedUrls].slice(0, 8),
      enginesChecked: [...data.engines],
      lastAnswerSummary: data.summary,
      movement: previous ? movement : null,
      scoreHistory: historyScoreByPrompt.get(promptId) ?? [
        data.recommended ? 100 : data.mentioned ? 50 : 0,
      ],
      filterTags,
    });
  }
  return out;
}

export async function buildEngineBreakdown(ctx: AppContext, brandId: string): Promise<EngineBreakdownRow[]> {
  const brand = await ctx.db
    .select()
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!brand) return [];

  const reportList = await ctx.db
    .select()
    .from(reports)
    .where(eq(reports.brandId, brandId))
    .orderBy(desc(reports.createdAt))
    .limit(2);
  const latest = reportList[0];
  if (!latest) return [];

  const [latestRows, previousRows, latestRun] = await Promise.all([
    ctx.db.select().from(runRows).where(eq(runRows.runId, latest.runId)),
    reportList[1]
      ? ctx.db.select().from(runRows).where(eq(runRows.runId, reportList[1].runId))
      : Promise.resolve([] as (typeof runRows.$inferSelect)[]),
    ctx.db.select().from(runs).where(eq(runs.id, latest.runId)).limit(1).then((rows) => rows[0] ?? null),
  ]);

  const engineState = parseEngineStatus(latestRun?.engineStates);
  const byEngine = new Map<
    string,
    {
      mentioned: number;
      cited: number;
      total: number;
      competitors: Map<string, number>;
      urls: Map<string, number>;
      appearing: Set<string>;
      missing: Set<string>;
    }
  >();

  for (const engine of CORE_ENGINES) {
    if (engine.id === "claude") continue;
    byEngine.set(engine.id, {
      mentioned: 0,
      cited: 0,
      total: 0,
      competitors: new Map(),
      urls: new Map(),
      appearing: new Set(),
      missing: new Set(),
    });
  }

  for (const row of latestRows) {
    const bucket = byEngine.get(row.engine);
    if (!bucket) continue;
    bucket.total += 1;
    if (row.mentioned) {
      bucket.mentioned += 1;
      bucket.appearing.add(row.promptId);
    } else {
      bucket.missing.add(row.promptId);
    }
    if (row.citedBrandUrl || parseCitedUrls(row.citedUrls).length) bucket.cited += 1;
    if (row.whoWon && row.whoWon.trim().toLowerCase() !== brand.name.toLowerCase()) {
      bucket.competitors.set(row.whoWon, (bucket.competitors.get(row.whoWon) || 0) + 1);
    }
    for (const url of parseCitedUrls(row.citedUrls)) {
      bucket.urls.set(url, (bucket.urls.get(url) || 0) + 1);
    }
  }

  const prevMentionRate = new Map<string, number>();
  const prevTotals = new Map<string, { m: number; t: number }>();
  for (const row of previousRows) {
    const cur = prevTotals.get(row.engine) ?? { m: 0, t: 0 };
    cur.t += 1;
    if (row.mentioned) cur.m += 1;
    prevTotals.set(row.engine, cur);
  }
  for (const [engine, stats] of prevTotals) {
    prevMentionRate.set(engine, stats.t ? stats.m / stats.t : 0);
  }

  const out: EngineBreakdownRow[] = [];
  for (const [engine, bucket] of byEngine) {
    if (bucket.total === 0 && engineState[engine as keyof typeof engineState] === "skipped") continue;
    const mentionRate = bucket.total ? Math.round((bucket.mentioned / bucket.total) * 1000) / 10 : null;
    const citationRate = bucket.total ? Math.round((bucket.cited / bucket.total) * 1000) / 10 : null;
    const prev = prevMentionRate.get(engine);
    const recentChange =
      mentionRate == null || prev == null ? null : Math.round((mentionRate - prev * 100) * 10) / 10;
    const state = engineState[engine as keyof typeof engineState];
    const reliability =
      state === "complete" ? 100 : state === "failed" ? 0 : state === "skipped" ? null : 0;

    out.push({
      engine,
      mentionRate,
      citationRate,
      averageVisibility: mentionRate,
      topCitedUrls: [...bucket.urls.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([url]) => url),
      topCompetitors: [...bucket.competitors.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name),
      promptsAppearing: bucket.appearing.size,
      promptsMissing: bucket.missing.size,
      recentChange,
      reliability,
    });
  }
  return out;
}

export async function buildActionHistory(ctx: AppContext, limit = 50): Promise<ActionHistoryItem[]> {
  const items: ActionHistoryItem[] = [];
  const workspaceBrands = await ctx.db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .where(and(eq(brands.workspaceId, ctx.workspace.id), isNull(brands.archivedAt)));
  const brandName = new Map(workspaceBrands.map((row) => [row.id, row.name]));
  const brandIds = workspaceBrands.map((row) => row.id);

  if (brandIds.length) {
    const recentRuns = await ctx.db
      .select()
      .from(runs)
      .where(inArray(runs.brandId, brandIds))
      .orderBy(desc(runs.createdAt))
      .limit(limit);
    for (const run of recentRuns) {
      if (run.status !== "complete" && run.status !== "partial" && run.status !== "failed") continue;
      items.push({
        id: `run:${run.id}`,
        at: run.completedAt?.toISOString?.() ?? run.createdAt.toISOString(),
        kind: run.extraRun || run.consumeCredit ? "manual_recheck" : "run_completed",
        label:
          run.status === "failed"
            ? "Run failed"
            : run.extraRun || run.consumeCredit
              ? "Manual recheck completed"
              : "Run completed",
        brandId: run.brandId,
        brandName: brandName.get(run.brandId) ?? null,
        meta: { status: run.status, extraRun: run.extraRun },
      });
    }

    const recentReports = await ctx.db
      .select()
      .from(reports)
      .where(inArray(reports.brandId, brandIds))
      .orderBy(desc(reports.createdAt))
      .limit(limit);
    for (const report of recentReports) {
      items.push({
        id: `report:${report.id}`,
        at: report.createdAt.toISOString(),
        kind: "report_generated",
        label: "Report generated",
        brandId: report.brandId,
        brandName: brandName.get(report.brandId) ?? null,
        meta: {
          mentioned: report.scoreMentioned,
          recommended: report.scoreRecommended,
        },
      });
    }
  }

  const plans = await ctx.db
    .select()
    .from(opportunityPlans)
    .where(eq(opportunityPlans.workspaceId, ctx.workspace.id))
    .orderBy(desc(opportunityPlans.plannedAt))
    .limit(limit);
  for (const plan of plans) {
    const status = (plan.status as OpportunityStatus | undefined) || "planned";
    items.push({
      id: `opportunity:${plan.id}`,
      at: new Date((plan.completedAt ?? plan.plannedAt) as Date | number | string).toISOString(),
      kind: status === "done" ? "opportunity_completed" : "opportunity_created",
      label: status === "done" ? "Opportunity completed" : `Opportunity ${status}`,
      brandId: plan.brandId,
      brandName: brandName.get(plan.brandId) ?? null,
      meta: { key: plan.opportunityKey, status },
    });
  }

  const audits = await ctx.db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.workspaceId, ctx.workspace.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  for (const audit of audits) {
    items.push({
      id: `audit:${audit.id}`,
      at: audit.createdAt.toISOString(),
      kind: "audit",
      label: audit.action,
      brandId: audit.targetType === "brand" ? audit.targetId : null,
      brandName: audit.targetType === "brand" && audit.targetId ? brandName.get(audit.targetId) ?? null : null,
    });
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

/** Client reporting center rows (monthly summary, before/after, notes) from stored reports. */
export async function buildClientReportingCenter(
  ctx: AppContext,
  ent: WorkspaceEntitlements,
): Promise<ClientReportingSummary[]> {
  if (!dashboardModulesForPlan(ent).clientReportingCenter) return [];

  const { rows } = await loadCommandRows(ctx, ent.allowsWeeklyCadence);
  const statusMap = await loadOpportunityStatuses(ctx);
  const out: ClientReportingSummary[] = [];

  for (const row of rows) {
    const reportList = await ctx.db
      .select({
        report: reports,
        periodStart: runs.periodStart,
      })
      .from(reports)
      .innerJoin(runs, eq(runs.id, reports.runId))
      .where(eq(reports.brandId, row.brand.id))
      .orderBy(desc(reports.createdAt))
      .limit(2);

    const latest = reportList[0];
    const previous = reportList[1];
    if (!latest) continue;

    const opportunity = opportunityFromRow(row);
    const completedSinceLastReport: string[] = [];
    for (const [key, value] of statusMap) {
      if (!key.startsWith(`${row.brand.id}:`)) continue;
      if (value.status === "done") {
        completedSinceLastReport.push(`Completed ${key.split(":")[1]?.replaceAll("_", " ") || "opportunity"}`);
      }
    }

    const summary = buildClientReportingSummary({
      brandId: row.brand.id,
      brandName: row.brand.name,
      latest: {
        id: latest.report.id,
        summary: latest.report.summary,
        scoreMentioned: latest.report.scoreMentioned,
        scoreRecommended: latest.report.scoreRecommended,
        scoreTotal: latest.report.scoreTotal,
        createdAt: latest.report.createdAt,
        periodLabel: latest.periodStart,
      },
      previous: previous
        ? {
            id: previous.report.id,
            scoreMentioned: previous.report.scoreMentioned,
            scoreRecommended: previous.report.scoreRecommended,
          }
        : null,
      competitorLeader: row.competitorLeader ?? null,
      recommendedActions: opportunity
        ? [`${opportunity.service}: ${opportunity.reason}`]
        : [],
      completedSinceLastReport,
      clientNotes: (row.brand as { clientNotes?: string | null }).clientNotes?.trim() || null,
    });
    if (summary) out.push(summary);
  }

  return out;
}

/** Narrow helper for TypeScript when CommandRow lacks siteUrl on brand. */
export type HomeRow = CommandRow & {
  brand: {
    id: string;
    name: string;
    siteUrl?: string | null;
    clientOwner?: string | null;
  };
  latestRun: (CommandRow["latestRun"] & { createdAt?: Date | string | null }) | null;
};
