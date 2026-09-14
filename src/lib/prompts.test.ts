import assert from "node:assert/strict";
import {
  generatePromptPack,
  isVanityPrompt,
  mixIsLocked,
  normalizePromptDraft,
  stripMixLabelPrefix,
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

console.log("prompts.test.ts ok");
