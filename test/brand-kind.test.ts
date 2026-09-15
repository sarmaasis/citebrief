import assert from "node:assert/strict";
import {
  BRAND_KIND,
  PITCH_TTL_MS,
  countsTowardBrandCap,
  isPitchExpired,
  isPitchBrand,
  isSampleBrand,
  parseBrandKind,
} from "@/lib/brand-kind";
import { TRIAL_PROMPT_CAP } from "@/lib/billing";
import { TRIAL_ENGINE_IDS } from "@/lib/engines";

assert.equal(parseBrandKind(undefined), "client");
assert.equal(parseBrandKind("sample"), "sample");
assert.equal(isSampleBrand(BRAND_KIND.sample), true);
assert.equal(isPitchBrand(BRAND_KIND.pitch), true);
assert.equal(countsTowardBrandCap("sample"), false);
assert.equal(countsTowardBrandCap("pitch"), false);
assert.equal(countsTowardBrandCap("client"), true);
assert.equal(PITCH_TTL_MS, 48 * 60 * 60 * 1000);
assert.equal(isPitchExpired(new Date(Date.now() - 1000)), true);
assert.equal(isPitchExpired(new Date(Date.now() + 60_000)), false);
assert.equal(TRIAL_PROMPT_CAP, 20);
assert.deepEqual(TRIAL_ENGINE_IDS, ["chatgpt", "gemini", "grok", "aio"]);
console.log("brand-kind.test.ts ok");
