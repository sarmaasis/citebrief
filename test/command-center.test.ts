import assert from "node:assert/strict";
import {
  agencyRoi,
  averageNamedScore,
  clampMinutesSaved,
  clientRisk,
  competitorSignalsFromRows,
  MINUTES_SAVED_DEFAULT,
  opportunityFromRow,
  pageFilters,
  PIPELINE_LABEL,
  pipelineCounts,
  pipelineStage,
  riskWhy,
  suggestedClientEmail,
  weeklyAction,
} from "@/lib/command-center";
import { indexLatestByBrandId, indexTopNByBrandId, parseListPage } from "@/server/workspace-data";

const brand = { id: "b1", name: "Northstar" };

const ready = {
  brand,
  promptCount: 20,
  mentionedDelta: null,
  latestRun: { status: "complete" },
  latestReport: null,
};
assert.equal(pipelineStage(ready), "ready_to_run");
assert.equal(clientRisk(ready), "watch");
assert.equal(weeklyAction(ready, true)?.verb, "Run report");

const review = {
  brand,
  promptCount: 20,
  mentionedDelta: -1,
  latestRun: { status: "complete" },
  latestReport: {
    id: "r1",
    sentAt: null,
    scoreMentioned: 8,
    scoreRecommended: 3,
    scoreTotal: 20,
    approvalState: "needs_review",
  },
};
assert.equal(pipelineStage(review), "needs_review");
assert.equal(clientRisk(review), "watch");
assert.equal(weeklyAction(review, true)?.verb, "Approve report");
assert.equal(weeklyAction(review, false)?.verb, "Review report");

const approvedUnsent = {
  ...review,
  mentionedDelta: 0,
  latestReport: { ...review.latestReport, approvalState: "approved" },
};
assert.equal(pipelineStage(approvedUnsent), "ready_to_send");
assert.equal(PIPELINE_LABEL.ready_to_send, "Approved");
assert.equal(weeklyAction(approvedUnsent, true)?.verb, "Send report");
assert.match(riskWhy(review), /Dropped from 9\/20 to 8\/20|not sent|recommended/i);
assert.equal(opportunityFromRow(review)?.type, "Win the recommendation, not just the mention");
assert.equal(opportunityFromRow(review)?.key, "comparison_page");
assert.match(opportunityFromRow(review)?.reason || "", /Named in 8\/20/);

const drop25 = {
  brand,
  promptCount: 20,
  mentionedDelta: -3,
  latestRun: { status: "complete" },
  latestReport: {
    id: "r2",
    sentAt: new Date(),
    scoreMentioned: 9,
    scoreRecommended: 6,
    scoreTotal: 20,
    approvalState: "approved",
  },
};
assert.equal(clientRisk(drop25), "at_risk");
assert.equal(riskWhy(drop25), "Dropped from 12/20 to 9/20 named.");

const competitorLead = {
  brand,
  promptCount: 20,
  mentionedDelta: 0,
  competitorLeadShare: 0.6,
  competitorLeadCount: 12,
  competitorLeader: "ClickUp",
  latestRun: { status: "complete" },
  latestReport: {
    id: "r3",
    sentAt: new Date(),
    scoreMentioned: 10,
    scoreRecommended: 8,
    scoreTotal: 20,
    approvalState: "approved",
  },
};
assert.equal(clientRisk(competitorLead), "at_risk");
assert.equal(riskWhy(competitorLead), "Competitor leads 12 buyer questions.");
assert.equal(opportunityFromRow(competitorLead)?.key, "pr_placement");
assert.match(opportunityFromRow(competitorLead)?.type || "", /Displace ClickUp/);

const overdue = {
  brand,
  promptCount: 20,
  mentionedDelta: 0,
  sendOverdue: true,
  latestRun: { status: "complete" },
  latestReport: {
    id: "r4",
    sentAt: null,
    scoreMentioned: 12,
    scoreRecommended: 8,
    scoreTotal: 20,
    approvalState: "approved",
  },
};
assert.equal(clientRisk(overdue), "at_risk");
assert.equal(riskWhy(overdue), "Report ready but not sent.");

const failed = {
  brand,
  promptCount: 20,
  mentionedDelta: null,
  latestRun: { status: "failed" },
  latestReport: null,
};
assert.equal(clientRisk(failed), "at_risk");
assert.equal(weeklyAction(failed, true)?.verb, "Rerun failed engine");

const sent = {
  brand,
  promptCount: 20,
  mentionedDelta: 1,
  latestRun: { status: "complete" },
  latestReport: {
    id: "r1",
    sentAt: new Date(),
    scoreMentioned: 12,
    scoreRecommended: 8,
    scoreTotal: 20,
  },
};
assert.equal(pipelineStage(sent), "sent");
assert.equal(clientRisk(sent), "stable");
assert.equal(weeklyAction(sent, true)?.verb, "Create recommendation");

const missing = {
  brand,
  promptCount: 20,
  mentionedDelta: 0,
  latestRun: { status: "complete" },
  latestReport: {
    id: "r1",
    sentAt: new Date(),
    scoreMentioned: 0,
    scoreRecommended: 0,
    scoreTotal: 20,
  },
};
assert.equal(clientRisk(missing), "at_risk");
assert.equal(opportunityFromRow(missing)?.type, "Own the category answers AI still skips");
assert.equal(opportunityFromRow(missing)?.key, "geo_package");

const counts = pipelineCounts([ready, review, sent]);
assert.equal(counts.ready_to_run, 1);
assert.equal(counts.needs_review, 1);
assert.equal(counts.sent, 1);
assert.equal(averageNamedScore([review, sent]), 10);
assert.equal(agencyRoi({ brands: 4, reportsGenerated: 3, reportsSent: 1, opportunities: 2 }).hoursSaved, 3);
assert.equal(
  agencyRoi({ brands: 4, reportsGenerated: 3, reportsSent: 1, opportunities: 2, minutesPerReport: 90 }).hoursSaved,
  4.5,
);
assert.equal(clampMinutesSaved(30), 45);
assert.equal(clampMinutesSaved(120), 90);
assert.equal(clampMinutesSaved(undefined), MINUTES_SAVED_DEFAULT);

const signals = competitorSignalsFromRows("Northstar", [
  { promptId: "p1", whoWon: "ClickUp", citedUrls: "[]" },
  { promptId: "p2", whoWon: "ClickUp", citedUrls: null },
  { promptId: "p3", whoWon: "Northstar", citedUrls: "https://northstar.example" },
  { promptId: "p4", whoWon: "ClickUp", citedUrls: null },
]);
assert.equal(signals.competitorLeadCount, 3);
assert.equal(signals.competitorLeadShare, 0.75);
assert.equal(signals.competitorLeader, "ClickUp");
assert.equal(signals.missingSources, true);

const email = suggestedClientEmail({
  brandName: "Northstar",
  summary: "ClickUp still wins the shortlist.",
  scoreMentioned: 12,
  scoreRecommended: 7,
  scoreTotal: 20,
});
assert.ok(email.includes("Northstar"));
assert.ok(email.includes("Named in 12 of 20"));
assert.ok(email.includes("Recommended in 7 of 20"));

assert.equal(pageFilters({ stage: "needs_review" }).pipeline, "needs_review");
assert.equal(pageFilters({ brand: "b1" }).brandId, "b1");
assert.equal(pageFilters({ sent: "0", opportunityType: "geo_package" }).opportunityType, "geo_package");

{
  // listHomeRows batch fold: newest-first → one latest run + two reports per brand.
  const latest = indexLatestByBrandId([
    { brandId: "a", id: "r-new" },
    { brandId: "a", id: "r-old" },
    { brandId: "b", id: "r-b" },
  ]);
  assert.equal(latest.get("a")?.id, "r-new");
  assert.equal(latest.get("b")?.id, "r-b");
  const top2 = indexTopNByBrandId(
    [
      { brandId: "a", id: "rep1" },
      { brandId: "a", id: "rep2" },
      { brandId: "a", id: "rep3" },
      { brandId: "b", id: "rep-b" },
    ],
    2,
  );
  assert.deepEqual(
    top2.get("a")?.map((row) => row.id),
    ["rep1", "rep2"],
  );
  assert.equal(top2.get("b")?.length, 1);
}

{
  const first = parseListPage(undefined);
  assert.equal(first.page, 1);
  assert.equal(first.offset, 0);
  assert.equal(parseListPage("0").page, 1);
  assert.equal(parseListPage("abc").page, 1);
  assert.equal(parseListPage("3", 24).offset, 48);
}

console.log("command-center.test.ts ok");
