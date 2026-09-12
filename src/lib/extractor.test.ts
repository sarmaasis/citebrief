import { extractFromAnswer } from "./extractor";

const row = extractFromAnswer({
  brand: "Northstar",
  competitors: ["ClickUp", "Asana"],
  prompt: "best project management software for agencies 2026",
  engine: "chatgpt",
  rawAnswer:
    "Shortlist: ClickUp, Asana, Northstar. Northstar appears in the shortlist. ClickUp leads this shortlist. Sources: https://example.com/clickup",
  incumbent: "Asana",
  category: "project management",
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

console.log("extractor.test.ts ok", row.whoWon, row.nextAction);
