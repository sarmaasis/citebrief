import assert from "node:assert/strict";
import { generatePromptPack, isVanityPrompt, mixIsLocked, validatePromptSet } from "./prompts";

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
assert.match(isVanityPrompt("does ChatGPT mention Northstar") ?? "", /SEO/);
assert.match(isVanityPrompt("Northstar login", "Northstar") ?? "", /SEO/);
assert.equal(isVanityPrompt("best project management for agencies 2026"), null);

console.log("prompts.test.ts ok");
