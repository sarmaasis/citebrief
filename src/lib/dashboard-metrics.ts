/**
 * Dashboard metrics for DASHBOARD_FEATURES.md — computed from stored report/run data only.
 * No model calls on page load.
 */

import {
  clientRisk,
  dropShare,
  opportunityFromRow,
  pipelineStage,
  riskWhy,
  weeklyAction,
  type ClientRisk,
  type CommandRow,
  type OpportunityKey,
  type OpportunityValue,
} from "@/lib/command-center";
import type { WorkspaceEntitlements } from "@/lib/entitlements";

export type BrandHealthState =
  | "healthy"
  | "needs_attention"
  | "at_risk"
  | "new_data_pending"
  | "run_failed";

export type OpportunityStatus = "open" | "planned" | "in_progress" | "done" | "dismissed";
export type EffortLevel = "Low" | "Medium" | "High";
export type ImpactLevel = OpportunityValue;

export type ScorecardMetrics = {
  brandId: string;
  brandName: string;
  siteUrl: string | null;
  clientOwner: string | null;
  visibilityScore: number | null;
  mentionShare: number | null;
  citationShare: number | null;
  competitorGap: number | null;
  competitorLeader: string | null;
  winningPrompts: number;
  losingPrompts: number;
  openOpportunities: number;
  risk: ClientRisk;
  health: BrandHealthState;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  nextScheduledRunAt: string | null;
  mentionedDelta: number | null;
  enginesMonitored: number;
  promptCount: number;
};

export type CompetitorLeaderboardEntry = {
  name: string;
  mentionCount: number;
  topChoiceCount: number;
  citationCount: number;
  citedUrls: string[];
  promptsWon: string[];
  engines: string[];
  brandId: string;
  brandName: string;
  /** Short explanation from stored answers (citations, engines, prompts). */
  whyWinning: string | null;
  /** Change in top-choice wins vs previous run (null if no prior run). */
  movementSinceLastRun: number | null;
};

export type AgencySavedView =
  | "all"
  | "needs_attention"
  | "reports_due"
  | "recent_wins"
  | "competitor_threats";

export type ClientReportingSummary = {
  brandId: string;
  brandName: string;
  periodLabel: string;
  monthlySummary: string[];
  beforeAfter: {
    previousNamed: number | null;
    currentNamed: number | null;
    previousRecommended: number | null;
    currentRecommended: number | null;
    namedDelta: number | null;
    recommendedDelta: number | null;
    movementLabel: "improving" | "flat" | "declining" | "unknown";
    whatImproved: string[];
    whatDeclined: string[];
  };
  competitorLeader: string | null;
  recommendedActions: string[];
  completedSinceLastReport: string[];
  clientNotes: string | null;
  latestReportId: string | null;
  previousReportId: string | null;
};

export type PromptPerformanceRow = {
  promptId: string;
  brandId: string;
  brandName: string;
  text: string;
  mix: string;
  visibilityScore: number | null;
  mentioned: boolean;
  recommended: boolean;
  brandPosition: number | null;
  competitors: string[];
  citedUrls: string[];
  enginesChecked: string[];
  lastAnswerSummary: string | null;
  movement: number | null;
  /** Chronological visibility scores across recent reports (0 / 50 / 100). */
  scoreHistory: number[];
  filterTags: Array<
    "winning" | "losing" | "no_mention" | "competitor_wins" | "high_intent" | "recently_changed" | "failed"
  >;
};

export type EngineBreakdownRow = {
  engine: string;
  mentionRate: number | null;
  citationRate: number | null;
  averageVisibility: number | null;
  topCitedUrls: string[];
  topCompetitors: string[];
  promptsAppearing: number;
  promptsMissing: number;
  recentChange: number | null;
  reliability: number | null;
};

export type OpportunityQueueItem = {
  key: OpportunityKey;
  title: string;
  brandId: string;
  brandName: string;
  reportId: string | null;
  relatedPrompt: string | null;
  relatedEngine: string | null;
  impact: ImpactLevel;
  effort: EffortLevel;
  suggestedAction: string;
  reason: string;
  suggestedPage: string | null;
  owner: string | null;
  status: OpportunityStatus;
  href: string;
  priorityScore: number;
};

export type RiskAlertItem = {
  brandId: string;
  brandName: string;
  severity: ClientRisk;
  whatHappened: string;
  whyItMatters: string;
  recommendedFix: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  affectedPrompts: string[];
  affectedEngines: string[];
  href: string;
  /** True when the risk is newer than the last high-risk email digest (in-app unread). */
  unread?: boolean;
};

export type ActionHistoryItem = {
  id: string;
  at: string;
  kind:
    | "run_completed"
    | "report_generated"
    | "opportunity_created"
    | "opportunity_completed"
    | "risk_opened"
    | "risk_resolved"
    | "prompt_changed"
    | "competitor_changed"
    | "manual_recheck"
    | "audit";
  label: string;
  brandId: string | null;
  brandName: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

export type ExecutiveOverview = {
  visibilityScore: number | null;
  movement: number | null;
  movementLabel: "improving" | "flat" | "declining" | "unknown";
  brandsMonitored: number;
  promptsTracked: number;
  enginesMonitored: number;
  competitorMentions: number;
  openOpportunities: number;
  activeRisks: number;
  latestReportStatus: string | null;
  /** Share of finished latest runs that completed or partially completed (0–100). */
  runSuccessRate: number | null;
  suggestedNextAction: { verb: string; reason: string; href: string; brandName: string } | null;
  recheckCreditsUsed: number;
  recheckCreditsRemaining: number;
  recheckCreditsIncluded: number;
};

function namesMatch(a: string, b: string) {
  const left = a.toLowerCase().trim();
  const right = b.toLowerCase().trim();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function visibilityScoreFromMention(named: number | null | undefined, total: number | null | undefined) {
  if (named == null || !total || total <= 0) return null;
  return Math.round((named / total) * 1000) / 10;
}

export function brandHealthFromRow(row: CommandRow): BrandHealthState {
  if (row.latestRun?.status === "failed") return "run_failed";
  if (row.latestRun?.status === "queued" || row.latestRun?.status === "running") return "new_data_pending";
  const risk = clientRisk(row);
  if (risk === "at_risk") return "at_risk";
  if (risk === "watch") return "needs_attention";
  if (!row.latestReport) return "new_data_pending";
  return "healthy";
}

export function effortForOpportunity(key: OpportunityKey): EffortLevel {
  if (key === "technical_seo" || key === "source_refresh") return "Medium";
  if (key === "pr_placement") return "High";
  if (key === "geo_package") return "High";
  return "Medium";
}

export function suggestedPageForOpportunity(key: OpportunityKey): string | null {
  if (key === "comparison_page") return "Comparison / alternatives page";
  if (key === "geo_package") return "Category + best-for landing pages";
  if (key === "source_refresh") return "Cited source pages that slipped";
  if (key === "technical_seo") return "Homepage / schema / crawlable content";
  if (key === "pr_placement") return "Third-party review and listing pages";
  return null;
}

export function opportunityPriorityScore(args: {
  impact: ImpactLevel;
  effort: EffortLevel;
  studioScoring: boolean;
}): number {
  const impactPts = args.impact === "High" ? 30 : args.impact === "Medium" ? 20 : 10;
  const effortPts = args.effort === "Low" ? 15 : args.effort === "Medium" ? 10 : 5;
  const base = impactPts + effortPts;
  return args.studioScoring ? base * 2 : base;
}

export function movementLabel(delta: number | null): ExecutiveOverview["movementLabel"] {
  if (delta == null) return "unknown";
  if (delta > 0) return "improving";
  if (delta < 0) return "declining";
  return "flat";
}

export function buildClientReportingSummary(args: {
  brandId: string;
  brandName: string;
  latest: {
    id: string;
    summary: string | null;
    scoreMentioned: number | null;
    scoreRecommended: number | null;
    scoreTotal: number | null;
    createdAt: Date | string;
    periodLabel?: string | null;
  } | null;
  previous: {
    id: string;
    scoreMentioned: number | null;
    scoreRecommended: number | null;
  } | null;
  competitorLeader: string | null;
  recommendedActions: string[];
  completedSinceLastReport: string[];
  clientNotes: string | null;
}): ClientReportingSummary | null {
  if (!args.latest) return null;
  const previousNamed = args.previous?.scoreMentioned ?? null;
  const currentNamed = args.latest.scoreMentioned;
  const previousRecommended = args.previous?.scoreRecommended ?? null;
  const currentRecommended = args.latest.scoreRecommended;
  const namedDelta =
    previousNamed != null && currentNamed != null ? currentNamed - previousNamed : null;
  const recommendedDelta =
    previousRecommended != null && currentRecommended != null
      ? currentRecommended - previousRecommended
      : null;
  const whatImproved: string[] = [];
  const whatDeclined: string[] = [];
  if (namedDelta != null && namedDelta > 0) whatImproved.push(`Named score up ${namedDelta}`);
  if (namedDelta != null && namedDelta < 0) whatDeclined.push(`Named score down ${Math.abs(namedDelta)}`);
  if (recommendedDelta != null && recommendedDelta > 0) {
    whatImproved.push(`Recommended score up ${recommendedDelta}`);
  }
  if (recommendedDelta != null && recommendedDelta < 0) {
    whatDeclined.push(`Recommended score down ${Math.abs(recommendedDelta)}`);
  }
  if (args.competitorLeader) whatDeclined.push(`${args.competitorLeader} still leads buyer questions`);

  const monthlySummary = [
    args.latest.summary?.trim() || null,
    currentNamed != null
      ? `Named in ${currentNamed} of ${args.latest.scoreTotal ?? 20} buyer questions.`
      : null,
    currentRecommended != null
      ? `Recommended in ${currentRecommended} of ${args.latest.scoreTotal ?? 20}.`
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    brandId: args.brandId,
    brandName: args.brandName,
    periodLabel:
      args.latest.periodLabel?.trim() ||
      (typeof args.latest.createdAt === "string"
        ? args.latest.createdAt.slice(0, 10)
        : args.latest.createdAt.toISOString().slice(0, 10)),
    monthlySummary,
    beforeAfter: {
      previousNamed,
      currentNamed,
      previousRecommended,
      currentRecommended,
      namedDelta,
      recommendedDelta,
      movementLabel: movementLabel(namedDelta),
      whatImproved,
      whatDeclined,
    },
    competitorLeader: args.competitorLeader,
    recommendedActions: args.recommendedActions,
    completedSinceLastReport: args.completedSinceLastReport,
    clientNotes: args.clientNotes,
    latestReportId: args.latest.id,
    previousReportId: args.previous?.id ?? null,
  };
}

export function buildScorecard(
  row: CommandRow & {
    brand: { id: string; name: string; siteUrl?: string | null; clientOwner?: string | null };
  },
  args: {
    citationShare: number | null;
    winningPrompts: number;
    losingPrompts: number;
    openOpportunities: number;
    enginesMonitored: number;
    nextScheduledRunAt: string | null;
  },
): ScorecardMetrics {
  const total = row.latestReport?.scoreTotal ?? 20;
  const named = row.latestReport?.scoreMentioned ?? null;
  const visibilityScore = visibilityScoreFromMention(named, total);
  const mentionShare = visibilityScore;
  const competitorGap =
    row.competitorLeadShare == null ? null : Math.round(row.competitorLeadShare * 1000) / 10;

  return {
    brandId: row.brand.id,
    brandName: row.brand.name,
    siteUrl: row.brand.siteUrl ?? null,
    clientOwner: row.brand.clientOwner ?? null,
    visibilityScore,
    mentionShare,
    citationShare: args.citationShare,
    competitorGap,
    competitorLeader: row.competitorLeader ?? null,
    winningPrompts: args.winningPrompts,
    losingPrompts: args.losingPrompts,
    openOpportunities: args.openOpportunities,
    risk: clientRisk(row),
    health: brandHealthFromRow(row),
    lastRunAt: null,
    lastRunStatus: row.latestRun?.status ?? null,
    nextScheduledRunAt: args.nextScheduledRunAt,
    mentionedDelta: row.mentionedDelta,
    enginesMonitored: args.enginesMonitored,
    promptCount: row.promptCount,
  };
}

export type OpportunitySignalRow = {
  promptText: string | null;
  engine: string;
  mentioned: boolean | null;
  recommended: boolean | null;
  whoWon: string | null;
  citedUrls: string | null;
  citedBrandUrl?: boolean | null;
  status?: string | null;
};

/** Pick a representative prompt + engine for an opportunity from latest-run signals. */
export function relatedSignalsForOpportunity(
  key: OpportunityKey,
  brandName: string,
  signals: OpportunitySignalRow[],
): { relatedPrompt: string | null; relatedEngine: string | null } {
  if (!signals.length) return { relatedPrompt: null, relatedEngine: null };

  const pick = (rows: OpportunitySignalRow[]) => {
    const hit = rows.find((row) => row.promptText?.trim()) ?? rows[0];
    return {
      relatedPrompt: hit?.promptText?.trim() || null,
      relatedEngine: hit?.engine || null,
    };
  };

  if (key === "geo_package") {
    return pick(signals.filter((row) => row.mentioned === false));
  }
  if (key === "comparison_page") {
    return pick(
      signals.filter(
        (row) =>
          row.mentioned === true &&
          row.recommended !== true &&
          Boolean(row.whoWon?.trim()) &&
          !namesMatch(row.whoWon || "", brandName),
      ),
    );
  }
  if (key === "pr_placement") {
    return pick(
      signals.filter(
        (row) => Boolean(row.whoWon?.trim()) && !namesMatch(row.whoWon || "", brandName),
      ),
    );
  }
  if (key === "source_refresh") {
    const lost = signals.filter((row) => row.mentioned === false);
    if (lost.length) return pick(lost);
    return pick(signals.filter((row) => row.mentioned === true && row.recommended !== true));
  }
  if (key === "technical_seo") {
    return pick(
      signals.filter((row) => {
        const cited =
          Boolean(row.citedBrandUrl) ||
          Boolean(row.citedUrls && row.citedUrls !== "[]" && row.citedUrls.trim() !== "");
        return row.mentioned === true && !cited;
      }),
    );
  }
  return { relatedPrompt: null, relatedEngine: null };
}

export function buildOpportunityQueueItem(
  row: CommandRow & { brand: { id: string; name: string; clientOwner?: string | null } },
  status: OpportunityStatus,
  studioScoring: boolean,
  related?: { relatedPrompt?: string | null; relatedEngine?: string | null },
): OpportunityQueueItem | null {
  const opportunity = opportunityFromRow(row);
  if (!opportunity) return null;
  const effort = effortForOpportunity(opportunity.key);
  const relatedBit =
    related?.relatedPrompt || related?.relatedEngine
      ? ` Signal: ${[related.relatedEngine, related.relatedPrompt].filter(Boolean).join(" · ")}.`
      : "";
  return {
    key: opportunity.key,
    title: opportunity.type,
    brandId: opportunity.brandId,
    brandName: opportunity.client,
    reportId: opportunity.reportId,
    relatedPrompt: related?.relatedPrompt ?? null,
    relatedEngine: related?.relatedEngine ?? null,
    impact: opportunity.value,
    effort,
    suggestedAction: opportunity.service,
    reason: `${opportunity.reason}${relatedBit}`,
    suggestedPage: suggestedPageForOpportunity(opportunity.key),
    owner: row.brand.clientOwner ?? null,
    status,
    href: opportunity.href,
    priorityScore: opportunityPriorityScore({
      impact: opportunity.value,
      effort,
      studioScoring,
    }),
  };
}

export function buildRiskAlert(
  row: CommandRow & { brand: { id: string; name: string } },
  extras?: {
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
    affectedPrompts?: string[];
    affectedEngines?: string[];
    lastNotifiedAt?: string | Date | null;
  },
): RiskAlertItem | null {
  const risk = clientRisk(row);
  if (risk === "stable") return null;
  const why = riskWhy(row);
  const opportunity = opportunityFromRow(row);
  const lastSeenAt = extras?.lastSeenAt ?? row.latestReport?.createdAt?.toString?.() ?? null;
  const firstSeenAt = extras?.firstSeenAt ?? null;
  const lastNotifiedMs = extras?.lastNotifiedAt
    ? new Date(extras.lastNotifiedAt).getTime()
    : null;
  const seenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : firstSeenAt ? new Date(firstSeenAt).getTime() : null;
  const unread =
    risk === "at_risk" &&
    (lastNotifiedMs == null || (seenMs != null && !Number.isNaN(seenMs) && seenMs > lastNotifiedMs));
  return {
    brandId: row.brand.id,
    brandName: row.brand.name,
    severity: risk,
    whatHappened: why,
    whyItMatters:
      risk === "at_risk"
        ? "Client retention risk — visibility or send workflow needs attention this week."
        : "Early warning — address before the next Friday send.",
    recommendedFix: opportunity?.service ?? weeklyAction(row, true)?.verb ?? "Review the latest report",
    firstSeenAt,
    lastSeenAt,
    affectedPrompts: extras?.affectedPrompts ?? [],
    affectedEngines: extras?.affectedEngines ?? [],
    href: row.latestReport
      ? `/app/brands/${row.brand.id}/reports/${row.latestReport.id}`
      : `/app/brands/${row.brand.id}`,
    unread,
  };
}

export function buildExecutiveOverview(args: {
  rows: Array<CommandRow & { brand: { id: string; name: string } }>;
  allowsEmailSend: boolean;
  enginesMonitored: number;
  competitorMentions: number;
  recheckCreditsUsed: number;
  recheckCreditsRemaining: number;
  recheckCreditsIncluded: number;
}): ExecutiveOverview {
  const scored = args.rows.filter((row) => row.latestReport?.scoreMentioned != null);
  const visibilityScore =
    scored.length === 0
      ? null
      : Math.round(
          (scored.reduce((sum, row) => {
            const total = row.latestReport?.scoreTotal ?? 20;
            return sum + ((row.latestReport?.scoreMentioned ?? 0) / total) * 100;
          }, 0) /
            scored.length) *
            10,
        ) / 10;

  const deltas = args.rows.map((row) => row.mentionedDelta).filter((d): d is number => d != null);
  const movement =
    deltas.length === 0 ? null : Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;

  const opportunities = args.rows
    .map((row) => opportunityFromRow(row))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const activeRisks = args.rows.filter((row) => clientRisk(row) !== "stable").length;
  const promptsTracked = args.rows.reduce((sum, row) => sum + row.promptCount, 0);

  const action = args.rows
    .map((row) => weeklyAction(row, args.allowsEmailSend))
    .find((item): item is NonNullable<typeof item> => Boolean(item));

  const latest = [...args.rows]
    .filter((row) => row.latestReport || row.latestRun)
    .sort((a, b) => {
      const aTime = a.latestReport?.createdAt ? new Date(a.latestReport.createdAt).getTime() : 0;
      const bTime = b.latestReport?.createdAt ? new Date(b.latestReport.createdAt).getTime() : 0;
      return bTime - aTime;
    })[0];

  let latestReportStatus: string | null = null;
  if (latest) {
    if (latest.latestRun?.status === "queued" || latest.latestRun?.status === "running") {
      latestReportStatus = latest.latestRun.status;
    } else if (latest.latestReport?.sentAt) {
      latestReportStatus = "sent";
    } else if (latest.latestReport) {
      latestReportStatus = pipelineStage(latest);
    } else {
      latestReportStatus = latest.latestRun?.status ?? null;
    }
  }

  return {
    visibilityScore,
    movement,
    movementLabel: movementLabel(movement),
    brandsMonitored: args.rows.length,
    promptsTracked,
    enginesMonitored: args.enginesMonitored,
    competitorMentions: args.competitorMentions,
    openOpportunities: opportunities.length,
    activeRisks,
    latestReportStatus,
    runSuccessRate: runSuccessRateFromRows(args.rows),
    suggestedNextAction: action
      ? { verb: action.verb, reason: action.reason, href: action.href, brandName: action.brandName }
      : null,
    recheckCreditsUsed: args.recheckCreditsUsed,
    recheckCreditsRemaining: args.recheckCreditsRemaining,
    recheckCreditsIncluded: args.recheckCreditsIncluded,
  };
}

export function aggregateCompetitorLeaderboard(
  rows: Array<{
    brandId: string;
    brandName: string;
    whoWon: string | null;
    citedUrls: string | null;
    engine: string;
    promptText?: string | null;
  }>,
  previousRows?: Array<{
    brandId: string;
    brandName: string;
    whoWon: string | null;
  }>,
): CompetitorLeaderboardEntry[] {
  const map = new Map<string, CompetitorLeaderboardEntry>();
  for (const row of rows) {
    const won = row.whoWon?.trim();
    if (!won || namesMatch(won, row.brandName)) continue;
    const key = `${row.brandId}:${won.toLowerCase()}`;
    const current = map.get(key) ?? {
      name: won,
      mentionCount: 0,
      topChoiceCount: 0,
      citationCount: 0,
      citedUrls: [],
      promptsWon: [],
      engines: [],
      brandId: row.brandId,
      brandName: row.brandName,
      whyWinning: null,
      movementSinceLastRun: null,
    };
    current.mentionCount += 1;
    current.topChoiceCount += 1;
    if (row.citedUrls && row.citedUrls !== "[]") {
      current.citationCount += 1;
      try {
        const urls = JSON.parse(row.citedUrls) as string[];
        for (const url of urls.slice(0, 3)) {
          if (url && !current.citedUrls.includes(url)) current.citedUrls.push(url);
        }
      } catch {
        /* ignore */
      }
    }
    if (row.promptText && !current.promptsWon.includes(row.promptText)) {
      current.promptsWon.push(row.promptText);
    }
    if (!current.engines.includes(row.engine)) current.engines.push(row.engine);
    map.set(key, current);
  }

  const prevCounts = new Map<string, number>();
  if (previousRows) {
    for (const row of previousRows) {
      const won = row.whoWon?.trim();
      if (!won || namesMatch(won, row.brandName)) continue;
      const key = `${row.brandId}:${won.toLowerCase()}`;
      prevCounts.set(key, (prevCounts.get(key) || 0) + 1);
    }
  }

  return [...map.values()]
    .map((entry) => {
      const key = `${entry.brandId}:${entry.name.toLowerCase()}`;
      const prev = previousRows ? (prevCounts.get(key) ?? 0) : null;
      return {
        ...entry,
        whyWinning: whyCompetitorWinning(entry),
        movementSinceLastRun: prev == null ? null : entry.topChoiceCount - prev,
      };
    })
    .sort((a, b) => b.topChoiceCount - a.topChoiceCount || b.mentionCount - a.mentionCount);
}

export function whyCompetitorWinning(entry: {
  topChoiceCount: number;
  citationCount: number;
  promptsWon: string[];
  engines: string[];
  citedUrls: string[];
}): string {
  const parts: string[] = [];
  if (entry.topChoiceCount > 0) {
    parts.push(`Top choice on ${entry.topChoiceCount} prompt${entry.topChoiceCount === 1 ? "" : "s"}`);
  }
  if (entry.engines.length) {
    parts.push(`favored on ${entry.engines.slice(0, 3).join(", ")}`);
  }
  if (entry.citationCount > 0) {
    parts.push(`${entry.citationCount} citation${entry.citationCount === 1 ? "" : "s"}`);
  } else if (entry.citedUrls.length) {
    parts.push("cited pages in answers");
  }
  if (entry.promptsWon[0]) {
    parts.push(`e.g. “${entry.promptsWon[0].slice(0, 64)}${entry.promptsWon[0].length > 64 ? "…" : ""}”`);
  }
  return parts.join(" · ") || "Winning buyer questions in the latest run";
}

export function matchesAgencySavedView(
  row: {
    health?: BrandHealthState;
    risk: ClientRisk;
    pipeline?: string;
    sendOverdue?: boolean;
    mentionedDelta: number | null;
    competitorLeadShare?: number | null;
    competitorLeader?: string | null;
  },
  view: AgencySavedView,
): boolean {
  if (view === "all") return true;
  if (view === "needs_attention") {
    return (
      row.risk === "watch" ||
      row.risk === "at_risk" ||
      row.health === "needs_attention" ||
      row.health === "at_risk" ||
      row.health === "run_failed"
    );
  }
  if (view === "reports_due") {
    return (
      Boolean(row.sendOverdue) ||
      row.pipeline === "needs_review" ||
      row.pipeline === "ready_to_send"
    );
  }
  if (view === "recent_wins") {
    return row.mentionedDelta != null && row.mentionedDelta > 0;
  }
  if (view === "competitor_threats") {
    return (
      (row.competitorLeadShare != null && row.competitorLeadShare >= 0.35) ||
      (Boolean(row.competitorLeader) && row.risk !== "stable")
    );
  }
  return true;
}

/** Apply Overview/Brands saved-view rules to a command-center row. */
export function commandRowMatchesSavedView(
  row: CommandRow & {
    competitorLeadShare?: number | null;
    competitorLeader?: string | null;
  },
  view: AgencySavedView,
): boolean {
  return matchesAgencySavedView(
    {
      health: brandHealthFromRow(row),
      risk: clientRisk(row),
      pipeline: pipelineStage(row),
      sendOverdue: row.sendOverdue,
      mentionedDelta: row.mentionedDelta,
      competitorLeadShare: row.competitorLeadShare,
      competitorLeader: row.competitorLeader,
    },
    view,
  );
}

/** Latest-run success rate across brands (complete+partial over finished runs). */
export function runSuccessRateFromRows(
  rows: Array<{ latestRun: { status: string } | null }>,
): number | null {
  const finished = rows.filter((row) => {
    const status = row.latestRun?.status;
    return status === "complete" || status === "partial" || status === "failed";
  });
  if (finished.length === 0) return null;
  const ok = finished.filter((row) => {
    const status = row.latestRun?.status;
    return status === "complete" || status === "partial";
  }).length;
  return Math.round((ok / finished.length) * 1000) / 10;
}

export function parseAgencySavedView(value: string | null | undefined): AgencySavedView {
  if (
    value === "needs_attention" ||
    value === "reports_due" ||
    value === "recent_wins" ||
    value === "competitor_threats"
  ) {
    return value;
  }
  return "all";
}

/** Affected prompts/engines for a risk, derived from latest-run signals. */
export function riskAffectedFromSignals(
  row: CommandRow & { brand: { id: string; name: string } },
  signals: OpportunitySignalRow[],
): { affectedPrompts: string[]; affectedEngines: string[] } {
  const prompts = new Set<string>();
  const engines = new Set<string>();
  const brandName = row.brand.name;

  for (const signal of signals) {
    const text = signal.promptText?.trim();
    if (!text) continue;
    const competitorWin =
      Boolean(signal.whoWon?.trim()) && !namesMatch(signal.whoWon || "", brandName);
    const noMention = signal.mentioned === false;
    const cited =
      Boolean(signal.citedBrandUrl) ||
      Boolean(signal.citedUrls && signal.citedUrls !== "[]" && signal.citedUrls.trim() !== "");
    const weak = signal.mentioned === true && signal.recommended !== true && competitorWin;
    const missingCite = signal.mentioned === true && !cited;
    const failed = signal.status === "failed";

    if (noMention || competitorWin || weak || missingCite || failed) {
      prompts.add(text);
      if (signal.engine) engines.add(signal.engine);
    }
  }

  return {
    affectedPrompts: [...prompts].slice(0, 8),
    affectedEngines: [...engines],
  };
}

export function dashboardModulesForPlan(ent: WorkspaceEntitlements) {
  return {
    executiveOverview: true,
    brandScorecards: ent.paid || ent.trialing,
    promptPerformance: ent.paid || ent.trialing,
    basicCompetitorMentions: ent.paid || ent.trialing,
    basicOpportunities: ent.paid || ent.trialing,
    competitorLeaderboard: ent.allowsCommandCenter,
    advancedCompetitorIntel: ent.allowsPortfolioExport || ent.plan === "studio" || ent.plan === "enterprise",
    opportunityQueue: ent.allowsOpportunityRollups,
    opportunityScoring: ent.allowsPortfolioExport || ent.plan === "studio" || ent.plan === "enterprise",
    riskAlerts: ent.allowsPortfolioRollups,
    engineBreakdown: ent.allowsCommandCenter || ent.paid,
    clientReportingCenter: ent.allowsEmailSend,
    whiteLabelReporting: ent.allowsCustomSender || ent.allowsEmailSend,
    actionHistory: ent.allowsHistory || ent.allowsCommandCenter,
    agencyWorkspace: ent.allowsCommandCenter,
    recheckCreditVisibility: ent.paid,
  };
}

export function dropSharePct(row: CommandRow) {
  const share = dropShare(row);
  return share == null ? null : Math.round(share * 1000) / 10;
}
