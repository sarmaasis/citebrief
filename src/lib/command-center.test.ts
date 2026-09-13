import assert from "node:assert/strict";
import {
  agencyRoi,
  averageNamedScore,
  clientRisk,
  opportunityFromRow,
  pipelineCounts,
  pipelineStage,
  suggestedClientEmail,
  weeklyAction,
} from "./command-center";

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
assert.equal(weeklyAction(review, true)?.verb, "Review report");
assert.equal(weeklyAction(review, false)?.verb, "Review report");

const approvedUnsent = {
  ...review,
  mentionedDelta: 0,
  latestReport: { ...review.latestReport, approvalState: "approved" },
};
assert.equal(pipelineStage(approvedUnsent), "ready_to_send");
assert.equal(weeklyAction(approvedUnsent, true)?.verb, "Send report");
assert.equal(opportunityFromRow(review)?.service, "Comparison page");

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
assert.equal(weeklyAction(sent, true), null);

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
assert.equal(opportunityFromRow(missing)?.service, "GEO package");

const counts = pipelineCounts([ready, review, sent]);
assert.equal(counts.ready_to_run, 1);
assert.equal(counts.needs_review, 1);
assert.equal(counts.sent, 1);
assert.equal(averageNamedScore([review, sent]), 10);
assert.equal(agencyRoi({ brands: 4, reportsGenerated: 3, reportsSent: 1, opportunities: 2 }).hoursSaved, 6);

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

console.log("command-center.test.ts ok");
