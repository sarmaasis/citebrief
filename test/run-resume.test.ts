import assert from "node:assert/strict";
import { completeRunCellKeys, nextPendingEngineId, runCellKey } from "@/lib/run-processor";
import { emptyEngineStatus } from "@/lib/engines";

assert.equal(runCellKey("p1", "chatgpt"), "p1|chatgpt");

const keys = completeRunCellKeys([
  { promptId: "p1", engine: "chatgpt", status: "complete" },
  { promptId: "p1", engine: "gemini", status: "failed" },
  { promptId: "p2", engine: "chatgpt", status: "complete" },
  { promptId: "p2", engine: "gemini", status: null },
]);
assert.equal(keys.has(runCellKey("p1", "chatgpt")), true);
assert.equal(keys.has(runCellKey("p1", "gemini")), false);
assert.equal(keys.has(runCellKey("p2", "chatgpt")), true);
assert.equal(keys.size, 2);

const states = emptyEngineStatus();
assert.equal(nextPendingEngineId(["chatgpt", "gemini", "grok", "aio"], states), "chatgpt");
states.chatgpt = "complete";
states.gemini = "running";
assert.equal(nextPendingEngineId(["chatgpt", "gemini", "grok", "aio"], states), "gemini");
states.gemini = "failed";
states.grok = "complete";
states.aio = "complete";
assert.equal(nextPendingEngineId(["chatgpt", "gemini", "grok", "aio"], states), null);

console.log("run-resume.test.ts ok");
