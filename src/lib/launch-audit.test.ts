import assert from "node:assert/strict";
import { createDodoCheckout, dodoAnnualProductId } from "./dodo";
import { consumeRateLimit, RATE_LIMITS, rateLimitDecision, rateLimitKey } from "./rate-limit";
import {
  isForbiddenProductionSecret,
  isProductionRuntime,
  productionSecretProblems,
  canonicalRedirectLocation,
} from "./runtime-env";
import { SECURITY_HEADERS } from "./security-headers";
import { shareAccessState } from "./share";

assert.ok(SECURITY_HEADERS["Content-Security-Policy"].includes("frame-ancestors 'none'"));
assert.equal(SECURITY_HEADERS["X-Frame-Options"], "DENY");
assert.equal(SECURITY_HEADERS["Referrer-Policy"], "strict-origin-when-cross-origin");
assert.ok(SECURITY_HEADERS["Permissions-Policy"].includes("camera=()"));
assert.equal(SECURITY_HEADERS["X-Content-Type-Options"], "nosniff");
assert.ok(SECURITY_HEADERS["Strict-Transport-Security"].includes("max-age=31536000"));

assert.equal(isForbiddenProductionSecret("stub"), true);
assert.equal(isForbiddenProductionSecret("dev-admin"), true);
assert.equal(isForbiddenProductionSecret("stub-secret"), true);
assert.equal(isForbiddenProductionSecret("real-secret-value"), false);

assert.equal(isProductionRuntime({ NEXTJS_ENV: "production" }), true);
assert.equal(isProductionRuntime({ NEXTJS_ENV: "development" }), false);
assert.equal(isProductionRuntime({ BETTER_AUTH_URL: "https://getcitebrief.com" }), true);

assert.deepEqual(
  productionSecretProblems({
    NEXTJS_ENV: "production",
    BETTER_AUTH_SECRET: "stub",
    INTERNAL_ADMIN_SECRET: "dev-admin",
    INTERNAL_PROCESS_SECRET: "ok",
    CRON_SECRET: "ok",
  }),
  ["BETTER_AUTH_SECRET", "INTERNAL_ADMIN_SECRET"],
);
assert.deepEqual(
  productionSecretProblems({
    NEXTJS_ENV: "development",
    BETTER_AUTH_SECRET: "stub",
    INTERNAL_ADMIN_SECRET: "dev-admin",
  }),
  [],
);

const redirect = canonicalRedirectLocation(new Request("https://citebrief.xyz/pricing?x=1"));
assert.equal(redirect, "https://getcitebrief.com/pricing?x=1");
assert.equal(canonicalRedirectLocation(new Request("https://getcitebrief.com/pricing")), null);

assert.equal(shareAccessState({ shareToken: "abc" }), "live");
assert.equal(shareAccessState({ shareToken: null }), "missing");
assert.equal(shareAccessState({ shareToken: "abc", shareRevokedAt: new Date() }), "revoked");
assert.equal(
  shareAccessState({ shareToken: "abc", shareExpiresAt: new Date(Date.now() - 1000) }),
  "expired",
);

assert.equal(rateLimitDecision(0, 3).ok, true);
assert.equal(rateLimitDecision(3, 3).ok, false);
assert.match(rateLimitKey(RATE_LIMITS.auth, "1.1.1.1", 0), /^rl:auth:1.1.1.1:/);

const memory = new Map<string, string>();
const store = {
  async get(key: string) {
    return memory.get(key) ?? null;
  },
  async put(key: string, value: string) {
    memory.set(key, value);
  },
};

async function runAsyncChecks() {
  const first = await consumeRateLimit(store, { bucket: "t", limit: 2, windowMs: 60_000 }, "s", 1);
  const second = await consumeRateLimit(store, { bucket: "t", limit: 2, windowMs: 60_000 }, "s", 1);
  const third = await consumeRateLimit(store, { bucket: "t", limit: 2, windowMs: 60_000 }, "s", 1);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);

  const env = {
    DODO_PAYMENTS_API_KEY: "sk_live_test",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
  } as CloudflareEnv;
  assert.equal(dodoAnnualProductId(env, "agency"), null);
  const checkout = await createDodoCheckout({
    env,
    plan: "agency",
    workspaceId: "ws_1",
    customerEmail: "owner@example.com",
    customerName: "Owner",
    returnUrl: "https://getcitebrief.com",
    interval: "annual",
  });
  assert.equal(checkout.mode, "unavailable");
}

runAsyncChecks()
  .then(() => {
    console.log("launch-audit.test.ts ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
