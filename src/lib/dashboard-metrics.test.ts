import assert from "node:assert/strict";
import {
  aggregateCompetitorLeaderboard,
  brandHealthFromRow,
  buildClientReportingSummary,
  buildExecutiveOverview,
  buildOpportunityQueueItem,
  buildRiskAlert,
  dashboardModulesForPlan,
  effortForOpportunity,
  matchesAgencySavedView,
  movementLabel,
  opportunityPriorityScore,
  parseAgencySavedView,
  relatedSignalsForOpportunity,
  riskAffectedFromSignals,
  runSuccessRateFromRows,
  commandRowMatchesSavedView,
  visibilityScoreFromMention,
  whyCompetitorWinning,
} from "./dashboard-metrics";
import { upgradeCopyForCapCode, UPGRADE_COPY } from "./upgrade-copy";
import type { WorkspaceEntitlements } from "./entitlements";
import type { CommandRow } from "./command-center";

const baseRow: CommandRow & { brand: { id: string; name: string; clientOwner?: string | null } } = {
  brand: { id: "b1", name: "Acme", clientOwner: "Sam" },
  promptCount: 5,
  mentionedDelta: -2,
  competitorLeadShare: 0.6,
  competitorLeadCount: 3,
  competitorLeader: "RivalCo",
  sendOverdue: false,
  missingSources: false,
  latestRun: { status: "complete" },
  latestReport: {
    id: "r1",
    sentAt: null,
    createdAt: new Date("2026-09-01"),
    scoreMentioned: 2,
    scoreRecommended: 0,
    scoreTotal: 5,
    approvalState: "needs_review",
  },
};

assert.equal(visibilityScoreFromMention(2, 5), 40);
assert.equal(visibilityScoreFromMention(null, 5), null);
assert.equal(movementLabel(2), "improving");
assert.equal(movementLabel(-1), "declining");
assert.equal(movementLabel(0), "flat");
assert.equal(brandHealthFromRow(baseRow), "at_risk");
assert.equal(effortForOpportunity("comparison_page"), "Medium");
assert.ok(
  opportunityPriorityScore({ impact: "High", effort: "Low", studioScoring: true }) >
    opportunityPriorityScore({ impact: "High", effort: "Low", studioScoring: false }),
);

const related = relatedSignalsForOpportunity("pr_placement", "Acme", [
  {
    promptText: "best tool for teams",
    engine: "chatgpt",
    mentioned: false,
    recommended: false,
    whoWon: "RivalCo",
    citedUrls: '["https://rival.example"]',
  },
]);
assert.equal(related.relatedPrompt, "best tool for teams");
assert.equal(related.relatedEngine, "chatgpt");

const opportunity = buildOpportunityQueueItem(baseRow, "open", true, related);
assert.ok(opportunity);
assert.equal(opportunity.status, "open");
assert.equal(opportunity.owner, "Sam");
assert.equal(opportunity.relatedPrompt, "best tool for teams");
assert.equal(opportunity.relatedEngine, "chatgpt");
assert.ok(opportunity.priorityScore > 0);

const risk = buildRiskAlert(baseRow, {
  firstSeenAt: "2026-08-01T00:00:00.000Z",
  affectedPrompts: ["best tool for teams"],
  affectedEngines: ["chatgpt"],
});
assert.ok(risk);
assert.equal(risk.severity, "at_risk");
assert.equal(risk.firstSeenAt, "2026-08-01T00:00:00.000Z");
assert.deepEqual(risk.affectedEngines, ["chatgpt"]);
assert.ok(risk.unread === true || risk.unread === false);

const affected = riskAffectedFromSignals(baseRow, [
  {
    promptText: "best tool for teams",
    engine: "gemini",
    mentioned: false,
    recommended: false,
    whoWon: "RivalCo",
    citedUrls: "[]",
  },
]);
assert.ok(affected.affectedPrompts.includes("best tool for teams"));
assert.ok(affected.affectedEngines.includes("gemini"));

const overview = buildExecutiveOverview({
  rows: [baseRow],
  allowsEmailSend: true,
  enginesMonitored: 2,
  competitorMentions: 3,
  recheckCreditsUsed: 1,
  recheckCreditsRemaining: 9,
  recheckCreditsIncluded: 10,
});
assert.equal(overview.brandsMonitored, 1);
assert.equal(overview.enginesMonitored, 2);
assert.equal(overview.movementLabel, "declining");
assert.equal(overview.recheckCreditsRemaining, 9);
assert.equal(overview.runSuccessRate, 100);
assert.ok(overview.suggestedNextAction);

const leaderboard = aggregateCompetitorLeaderboard(
  [
    {
      brandId: "b1",
      brandName: "Acme",
      whoWon: "RivalCo",
      citedUrls: '["https://rival.example"]',
      engine: "chatgpt",
      promptText: "best tool",
    },
    {
      brandId: "b1",
      brandName: "Acme",
      whoWon: "RivalCo",
      citedUrls: "[]",
      engine: "gemini",
      promptText: "alternatives",
    },
  ],
  [{ brandId: "b1", brandName: "Acme", whoWon: "RivalCo" }],
);
assert.equal(leaderboard[0]?.name, "RivalCo");
assert.equal(leaderboard[0]?.topChoiceCount, 2);
assert.equal(leaderboard[0]?.movementSinceLastRun, 1);
assert.ok(leaderboard[0]?.whyWinning);
assert.ok(whyCompetitorWinning(leaderboard[0]!).includes("Top choice"));

assert.equal(parseAgencySavedView("needs_attention"), "needs_attention");
assert.equal(parseAgencySavedView("nope"), "all");
assert.equal(
  matchesAgencySavedView(
    { risk: "at_risk", mentionedDelta: -1, competitorLeadShare: 0.6, competitorLeader: "RivalCo" },
    "competitor_threats",
  ),
  true,
);
assert.equal(
  matchesAgencySavedView({ risk: "stable", mentionedDelta: 2, health: "healthy" }, "recent_wins"),
  true,
);
assert.equal(runSuccessRateFromRows([baseRow]), 100);
assert.equal(
  runSuccessRateFromRows([
    baseRow,
    { ...baseRow, brand: { id: "b2", name: "Beta" }, latestRun: { status: "failed" } },
  ]),
  50,
);
assert.equal(runSuccessRateFromRows([{ latestRun: null }]), null);
assert.equal(commandRowMatchesSavedView(baseRow, "competitor_threats"), true);
assert.equal(commandRowMatchesSavedView(baseRow, "recent_wins"), false);

const reporting = buildClientReportingSummary({
  brandId: "b1",
  brandName: "Acme",
  latest: {
    id: "r1",
    summary: "Acme slipped on recommendations.",
    scoreMentioned: 2,
    scoreRecommended: 0,
    scoreTotal: 5,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  previous: { id: "r0", scoreMentioned: 4, scoreRecommended: 2 },
  competitorLeader: "RivalCo",
  recommendedActions: ["Comparison page: close the shortlist gap"],
  completedSinceLastReport: ["Completed comparison page"],
  clientNotes: "Follow up Thursday",
});
assert.ok(reporting);
assert.equal(reporting!.clientNotes, "Follow up Thursday");
assert.equal(reporting!.beforeAfter.namedDelta, -2);
assert.equal(reporting!.beforeAfter.movementLabel, "declining");
assert.ok(reporting!.monthlySummary.length >= 1);

const trialEnt = {
  plan: "agency",
  paid: false,
  trialing: true,
  allowsCommandCenter: false,
  allowsOpportunityRollups: false,
  allowsPortfolioRollups: false,
  allowsPortfolioExport: false,
  allowsEmailSend: false,
  allowsHistory: false,
  allowsCustomSender: false,
} as WorkspaceEntitlements;
const modules = dashboardModulesForPlan(trialEnt);
assert.equal(modules.executiveOverview, true);
assert.equal(modules.competitorLeaderboard, false);
assert.equal(modules.basicOpportunities, true);
assert.equal(modules.basicCompetitorMentions, true);

const endedEnt = { ...trialEnt, trialing: false } as WorkspaceEntitlements;
const endedModules = dashboardModulesForPlan(endedEnt);
assert.equal(endedModules.basicCompetitorMentions, false);
assert.equal(endedModules.basicOpportunities, false);

assert.equal(upgradeCopyForCapCode("trial_brand_cap").title, UPGRADE_COPY.trialBrand.title);
assert.equal(upgradeCopyForCapCode("trial_run_cap").title, UPGRADE_COPY.extraRunTrial.title);
assert.equal(upgradeCopyForCapCode("run_cap", "Past included").title, UPGRADE_COPY.extraRun.title);

console.log("dashboard-metrics.test.ts ok");
