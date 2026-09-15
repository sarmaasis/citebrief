import assert from "node:assert/strict";
import { brandSiteLabel, clipRawAnswer, extractFromAnswer, RAW_ANSWER_MAX_CHARS } from "@/lib/extractor";

assert.equal(brandSiteLabel("https://canwechat.dev", "CanWeChat"), "canwechat.dev");
assert.equal(brandSiteLabel("canwechat.dev/pricing", "CanWeChat"), "canwechat.dev");
assert.equal(brandSiteLabel("https://www.canwechat.dev", "CanWeChat"), "canwechat.dev");
assert.equal(brandSiteLabel(null, "CanWeChat"), "the CanWeChat site");
assert.equal(brandSiteLabel("", "CanWeChat"), "the CanWeChat site");
assert.equal(clipRawAnswer("x".repeat(RAW_ANSWER_MAX_CHARS + 10)).length, RAW_ANSWER_MAX_CHARS);

const row = extractFromAnswer({
  brand: "Northstar",
  competitors: ["ClickUp", "Asana"],
  prompt: "best project management software for agencies 2026",
  engine: "chatgpt",
  rawAnswer:
    "Shortlist: ClickUp, Asana, Northstar. Northstar appears in the shortlist. ClickUp leads this shortlist. Sources: https://example.com/clickup",
  incumbent: "Asana",
  category: "project management",
  siteUrl: "https://northstar.app",
});

if (!row.mentioned) {
  throw new Error("expected mentioned");
}
if (!row.whoWon) {
  throw new Error("expected whoWon");
}
if (!row.sentence.split(" ").length || row.sentence.split(" ").length > 22) {
  throw new Error("sentence length odd: " + row.sentence);
}
assert.match(row.nextAction, /northstar\.app/);
assert.doesNotMatch(row.nextAction, /\.example\b/);
assert.deepEqual(row.competitorsNamed, row.othersNamed);
assert.ok(row.competitorsNamed.includes("ClickUp") || row.competitorsNamed.includes("Asana"));
assert.ok(["positive", "mixed", "negative", "n/a"].includes(row.sentiment));

const canWe = extractFromAnswer({
  brand: "CanWeChat",
  competitors: ["Slack", "Teams"],
  prompt: "best team chat for agencies",
  engine: "chatgpt",
  rawAnswer: "Shortlist: Slack, CanWeChat. CanWeChat appears and leads this shortlist.",
  siteUrl: "https://canwechat.dev",
});
assert.match(canWe.nextAction, /canwechat\.dev/);
assert.doesNotMatch(canWe.nextAction, /canwechat\.example/);

const noSite = extractFromAnswer({
  brand: "CanWeChat",
  competitors: ["Slack"],
  prompt: "best chat tool",
  engine: "gemini",
  rawAnswer: "Shortlist: CanWeChat. CanWeChat leads this shortlist.",
});
assert.match(noSite.nextAction, /the CanWeChat site/);
assert.doesNotMatch(noSite.nextAction, /\.example\b/);

console.log("extractor.test.ts ok", row.whoWon, row.nextAction, canWe.nextAction);
