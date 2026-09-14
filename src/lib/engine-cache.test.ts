import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ENGINE_CACHE_READ_POLICY,
  buildCacheKey,
  mayReadEngineCache,
} from "./engine-cache";

assert.equal(buildCacheKey("chatgpt", " Best CRM "), "chatgpt:best crm");

assert.equal(ENGINE_CACHE_READ_POLICY.processRun, false);
assert.equal(ENGINE_CACHE_READ_POLICY.retryFailedEngine, true);
assert.equal(mayReadEngineCache("processRun"), false);
assert.equal(mayReadEngineCache("retryFailedEngine"), true);

const processorSrc = readFileSync(join(process.cwd(), "src/lib/run-processor.ts"), "utf8");

const processRunMatch = processorSrc.match(
  /export async function processRun\([\s\S]*?(?=\nexport async function retryFailedEngine)/,
);
assert.ok(processRunMatch, "expected processRun source block");
assert.equal(
  /readEngineCache\s*\(/.test(processRunMatch[0]!),
  false,
  "processRun must not call readEngineCache (metered runs bypass D1 soft-fail cache)",
);
assert.ok(
  /writeEngineCache\s*\(/.test(processRunMatch[0]!),
  "processRun should still writeEngineCache on success",
);

const retryMatch = processorSrc.match(/export async function retryFailedEngine\([\s\S]*$/);
assert.ok(retryMatch, "expected retryFailedEngine source block");
assert.ok(
  /readEngineCache\s*\(/.test(retryMatch[0]!),
  "retryFailedEngine must still be allowed to readEngineCache",
);
assert.ok(
  /mayReadEngineCache\s*\(\s*["']retryFailedEngine["']\s*\)/.test(retryMatch[0]!),
  "retryFailedEngine should gate cache reads via mayReadEngineCache",
);

console.log("engine-cache.test.ts ok");
