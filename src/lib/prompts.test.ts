import assert from "node:assert/strict";
import {
  generatePromptPack,
  generatePromptsCta,
  inferMixFromText,
  isVanityPrompt,
  mixIsLocked,
  normalizePromptDraft,
  REPLACE_PROMPTS_CONFIRM,
  stripMixLabelPrefix,
  topUpPromptDrafts,
  validatePromptSet,
} from "./prompts";

const pack = generatePromptPack({
  brand: "Northstar",
  category: "project management",
  buyer: "agencies",
  job: "client work",
  incumbent: "Asana",
  competitors: ["ClickUp", "Monday.com"],
  constraint: "no 3-month setup",
});

assert.equal(pack.length, 20);
assert.equal(mixIsLocked(pack), true);
assert.equal(validatePromptSet(pack, "Northstar").ok, true);
assert.equal(pack.every((prompt) => prompt.text.endsWith("?")), true);

const trialPack = generatePromptPack(
  {
    brand: "Northstar",
    category: "project management",
    buyer: "agencies",
    job: "client work",
    incumbent: "Asana",
    competitors: ["ClickUp", "Monday.com"],
    constraint: "no 3-month setup",
  },
  { count: 5 },
);
assert.equal(trialPack.length, 5);
assert.equal(validatePromptSet(trialPack, "Northstar", { maxCount: 5 }).ok, true);
assert.equal(validatePromptSet(trialPack, "Northstar").ok, false);

const studioPack = generatePromptPack(
  {
    brand: "Northstar",
    category: "project management",
    buyer: "agencies",
    job: "client work",
    incumbent: "Asana",
    competitors: ["ClickUp", "Monday.com"],
    constraint: "no 3-month setup",
  },
  { count: 30 },
);
assert.equal(studioPack.length, 30);
assert.equal(validatePromptSet(studioPack, "Northstar", { maxCount: 30 }).ok, true);
assert.equal(validatePromptSet(studioPack, "Northstar", { maxCount: 20 }).ok, false);

const polishedPack = generatePromptPack({
  brand: "CanWeChat",
  category: "Customer Support",
  buyer: "Agency, Idie Hackers, Multipe Domain Owners",
  job: "manage custome conversations across multipe domains",
  incumbent: "Intercom",
  competitors: ["Tidio", "Crisp"],
  constraint: "no 3-month implementation",
});
assert.equal(polishedPack.length, 20);
assert.equal(validatePromptSet(polishedPack, "CanWeChat").ok, true);
assert.equal(polishedPack.some((prompt) => /indie hackers/.test(prompt.text)), true);
assert.equal(polishedPack.some((prompt) => /multiple domain owners/.test(prompt.text)), true);
assert.equal(polishedPack.some((prompt) => /customer conversations across multiple domains/.test(prompt.text)), true);
assert.equal(polishedPack.some((prompt) => /\bIdie\b|\bMultipe\b|\bcustome\b/.test(prompt.text)), false);
assert.equal(polishedPack.some((prompt) => /what are the key features/i.test(prompt.text)), false);

assert.match(isVanityPrompt("does ChatGPT mention Northstar") ?? "", /SEO/);
assert.match(isVanityPrompt("Northstar login", "Northstar") ?? "", /SEO/);
assert.equal(isVanityPrompt("best project management for agencies 2026"), null);
assert.equal(
  isVanityPrompt("What is the best customer support chat tool for agencies 2026", "Northstar", "discovery"),
  null,
);
assert.equal(
  isVanityPrompt("What is the best helpdesk for a 12-person support team", undefined, "job"),
  null,
);
assert.match(isVanityPrompt("What is HubSpot?") ?? "", /SEO/);
assert.match(isVanityPrompt("What is Northstar", "Northstar") ?? "", /SEO/);
assert.equal(
  validatePromptSet(
    [
      { text: "What is the best customer support chat tool 2026", mix: "discovery", sortOrder: 1 },
      { text: "Zendesk vs Freshdesk for agencies", mix: "comparison", sortOrder: 2 },
      { text: "helpdesk with Slack for agencies", mix: "job", sortOrder: 3 },
      { text: "when to switch from Zendesk", mix: "switch", sortOrder: 4 },
      { text: "Zendesk alternatives for support teams", mix: "incumbent", sortOrder: 5 },
    ],
    "Northstar",
    { maxCount: 5 },
  ).ok,
  true,
);

const packInput = {
  brand: "Northstar",
  category: "project management",
  buyer: "agencies",
  job: "client work",
  incumbent: "Asana",
  competitors: ["ClickUp", "Monday.com"],
  constraint: "no 3-month setup",
};

const toppedFromTrial = topUpPromptDrafts(trialPack, 20, packInput);
assert.equal(toppedFromTrial.length, 20);
assert.equal(toppedFromTrial.slice(0, 5).map((row) => row.text).join("|"), trialPack.map((row) => row.text).join("|"));
assert.equal(mixIsLocked(toppedFromTrial), true);
assert.equal(validatePromptSet(toppedFromTrial, "Northstar", { maxCount: 20 }).ok, true);

const editedTrial = trialPack.map((row, index) =>
  index === 0 ? { ...row, text: "Custom discovery question for agencies in 2026?" } : row,
);
const toppedEdited = topUpPromptDrafts(editedTrial, 20, packInput);
assert.equal(toppedEdited.length, 20);
assert.equal(toppedEdited[0]?.text, "Custom discovery question for agencies in 2026?");
assert.equal(validatePromptSet(toppedEdited, "Northstar", { maxCount: 20 }).ok, true);

assert.equal(topUpPromptDrafts(toppedFromTrial, 20, packInput).length, 20);
assert.equal(topUpPromptDrafts([], 20, packInput).length, 0);

const toppedToStudio = topUpPromptDrafts(toppedFromTrial, 30, packInput);
assert.equal(toppedToStudio.length, 30);
assert.equal(validatePromptSet(toppedToStudio, "Northstar", { maxCount: 30 }).ok, true);

assert.equal(generatePromptsCta(20, true, 5), "Add 15 prompts");
assert.equal(generatePromptsCta(20, true, 20), "Replace all prompts");
assert.equal(generatePromptsCta(5, false), "Generate 5 prompts");
assert.equal(
  REPLACE_PROMPTS_CONFIRM.includes("archives current prompts"),
  true,
);

assert.equal(
  stripMixLabelPrefix("**Discovery:** What is the best customer support chat tool"),
  "What is the best customer support chat tool",
);
assert.equal(stripMixLabelPrefix("Comparison: Zendesk vs Freshdesk"), "Zendesk vs Freshdesk");
assert.equal(stripMixLabelPrefix("Job/constraint: helpdesk with Slack"), "helpdesk with Slack");
assert.equal(
  normalizePromptDraft({
    text: "**Incumbent:** Zendesk alternatives for support teams",
    mix: "discovery",
    sortOrder: 5,
  }).mix,
  "incumbent",
);

assert.equal(inferMixFromText("Northstar vs ClickUp for agencies"), "comparison");
assert.equal(inferMixFromText("when should agencies switch from Asana"), "switch");
assert.equal(inferMixFromText("who is better than Asana for agencies"), "incumbent");
assert.equal(inferMixFromText("which project management tool can help agencies client work"), "job");
assert.equal(inferMixFromText("best project management platforms for agencies in 2026"), "discovery");
assert.equal(inferMixFromText("Comparison: Zendesk vs Freshdesk for agencies"), "comparison");

{
  const vanityTrial = validatePromptSet(
    [
      { text: "does ChatGPT mention Northstar", mix: "discovery", sortOrder: 1 },
      { text: "Zendesk vs Freshdesk for agencies", mix: "comparison", sortOrder: 2 },
      { text: "helpdesk with Slack for agencies", mix: "job", sortOrder: 3 },
      { text: "when to switch from Zendesk", mix: "switch", sortOrder: 4 },
      { text: "Zendesk alternatives for support teams", mix: "incumbent", sortOrder: 5 },
    ],
    "Northstar",
    { maxCount: 5 },
  );
  assert.equal(vanityTrial.ok, false);
  if (!vanityTrial.ok) assert.match(vanityTrial.error, /SEO|buyer/i);
}

console.log("prompts.test.ts ok");
