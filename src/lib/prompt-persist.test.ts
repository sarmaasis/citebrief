import assert from "node:assert/strict";
import { planPromptSave, normalizePromptKey } from "./prompt-persist";
import type { PromptDraft } from "./prompts";

assert.equal(normalizePromptKey("  Hello   World  "), "hello world");

const existing = [
  {
    id: "p1",
    text: "Best project tools for agencies?",
    mix: "discovery",
    sortOrder: 0,
    archivedAt: null,
  },
  {
    id: "p2",
    text: "Asana vs ClickUp for client work?",
    mix: "comparison",
    sortOrder: 1,
    archivedAt: null,
  },
  {
    id: "p3",
    text: "Old archived question?",
    mix: "job",
    sortOrder: 2,
    archivedAt: new Date("2026-01-01"),
  },
];

// Full replace with new texts → archive old active, insert new (IDs preserved nowhere).
const replaceDrafts: PromptDraft[] = [
  { text: "What software do agencies use for delivery?", mix: "discovery", sortOrder: 0 },
  { text: "Monday.com vs ClickUp for agencies?", mix: "comparison", sortOrder: 1 },
];
const replacePlan = planPromptSave(existing, replaceDrafts);
assert.equal(replacePlan.updates.length, 0);
assert.equal(replacePlan.inserts.length, 2);
assert.deepEqual(replacePlan.archiveIds.sort(), ["p1", "p2"]);
// Archived p3 stays archived (not in archiveIds — already archived).

// Edit in place by id → update, no archive of that row.
const editDrafts: PromptDraft[] = [
  { id: "p1", text: "Best project tools for agencies in 2026?", mix: "discovery", sortOrder: 0 },
  { id: "p2", text: "Asana vs ClickUp for client work?", mix: "comparison", sortOrder: 1 },
];
const editPlan = planPromptSave(existing, editDrafts);
assert.equal(editPlan.inserts.length, 0);
assert.equal(editPlan.archiveIds.length, 0);
assert.equal(editPlan.updates.length, 2);
assert.equal(editPlan.updates[0]?.id, "p1");
assert.equal(editPlan.updates[0]?.text, "Best project tools for agencies in 2026?");
assert.equal(editPlan.updates[0]?.unarchive, false);

// Match by normalized text (regenerate returns same wording without ids).
const textMatchDrafts: PromptDraft[] = [
  { text: "  Best project tools for agencies? ", mix: "discovery", sortOrder: 0 },
  { text: "Brand-new question for switchers?", mix: "switch", sortOrder: 1 },
];
const textPlan = planPromptSave(existing, textMatchDrafts);
assert.equal(textPlan.updates.length, 1);
assert.equal(textPlan.updates[0]?.id, "p1");
assert.equal(textPlan.inserts.length, 1);
assert.deepEqual(textPlan.archiveIds, ["p2"]);

// Unarchive when regenerated text matches an archived prompt — preserves historical run_row FKs.
const reviveDrafts: PromptDraft[] = [
  { text: "Old archived question?", mix: "job", sortOrder: 0 },
];
const revivePlan = planPromptSave(existing, reviveDrafts);
assert.equal(revivePlan.updates.length, 1);
assert.equal(revivePlan.updates[0]?.id, "p3");
assert.equal(revivePlan.updates[0]?.unarchive, true);
assert.deepEqual(revivePlan.archiveIds.sort(), ["p1", "p2"]);
assert.equal(revivePlan.inserts.length, 0);

// Simulated historical metric join: archived prompt id still exists after replace plan.
const afterReplaceActiveIds = new Set([
  ...replacePlan.updates.map((u) => u.id),
  // inserts get new ids at persist time — historical ids remain as archived rows
]);
assert.equal(afterReplaceActiveIds.has("p1"), false);
assert.ok(replacePlan.archiveIds.includes("p1"));
assert.ok(replacePlan.archiveIds.includes("p2"));
// Soft-archive means run_rows pointing at p1/p2 remain resolvable.

console.log("prompt-persist.test.ts ok");
