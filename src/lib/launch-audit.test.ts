import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ENTERPRISE_CONTACT_SALES_MESSAGE, shouldWriteStubPaidSubscription } from "./billing";
import {
  createDodoAddonCheckout,
  createDodoCheckout,
  createDodoCustomerPortal,
  dodoAllowsStub,
  dodoAnnualProductId,
  verifyDodoWebhookSignature,
} from "./dodo";
import {
  consumeRateLimit,
  consumeRouteRateLimit,
  RATE_LIMITS,
  rateLimitDecision,
  rateLimitKey,
} from "./rate-limit";
import {
  isForbiddenProductionSecret,
  isHealthPath,
  isProductionRuntime,
  productionBillingSecretProblems,
  productionSecretProblems,
  productionTrafficBlocked,
  canonicalRedirectLocation,
} from "./runtime-env";
import { securityHeaders } from "./security-headers";
import { shareAccessState } from "./share";

const prodHeaders = securityHeaders({ NEXTJS_ENV: "production" });
const devHeaders = securityHeaders({ NEXTJS_ENV: "development" });
assert.ok(prodHeaders["Content-Security-Policy"].includes("frame-ancestors 'none'"));
assert.ok(!prodHeaders["Content-Security-Policy"].includes("unsafe-eval"));
assert.ok(prodHeaders["Content-Security-Policy"].includes("script-src 'self' 'unsafe-inline'"));
assert.ok(devHeaders["Content-Security-Policy"].includes("unsafe-eval"));
assert.ok(devHeaders["Content-Security-Policy"].includes("script-src 'self' 'unsafe-inline' 'unsafe-eval'"));
assert.equal(prodHeaders["X-Frame-Options"], "DENY");
assert.equal(prodHeaders["Referrer-Policy"], "strict-origin-when-cross-origin");
assert.ok(prodHeaders["Permissions-Policy"].includes("camera=()"));
assert.equal(prodHeaders["X-Content-Type-Options"], "nosniff");
assert.ok(prodHeaders["Strict-Transport-Security"].includes("max-age=31536000"));

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

assert.equal(isHealthPath("/api/health"), true);
assert.equal(isHealthPath("/health"), true);
assert.equal(isHealthPath("/app"), false);
assert.equal(
  productionTrafficBlocked({
    NEXTJS_ENV: "production",
    BETTER_AUTH_SECRET: "stub",
    INTERNAL_ADMIN_SECRET: "ok-admin",
    INTERNAL_PROCESS_SECRET: "ok-process",
    CRON_SECRET: "ok-cron",
  }),
  true,
);
assert.equal(
  productionTrafficBlocked({
    NEXTJS_ENV: "production",
    BETTER_AUTH_SECRET: "ok-auth",
    INTERNAL_ADMIN_SECRET: "ok-admin",
    INTERNAL_PROCESS_SECRET: "ok-process",
    CRON_SECRET: "ok-cron",
  }),
  false,
);
assert.deepEqual(
  productionBillingSecretProblems({
    NEXTJS_ENV: "production",
    DODO_PAYMENTS_API_KEY: "stub",
    DODO_PAYMENTS_WEBHOOK_KEY: "ok",
  }),
  ["DODO_PAYMENTS_API_KEY"],
);

assert.equal(dodoAllowsStub({ NEXTJS_ENV: "development" }), true);
assert.equal(dodoAllowsStub({ NEXTJS_ENV: "production" }), false);
assert.equal(
  verifyDodoWebhookSignature({
    env: { DODO_PAYMENTS_WEBHOOK_KEY: "stub", NEXTJS_ENV: "production" } as CloudflareEnv,
    rawBody: "{}",
    signature: "anything",
  }),
  false,
);
assert.equal(
  verifyDodoWebhookSignature({
    env: { DODO_PAYMENTS_WEBHOOK_KEY: "stub", NEXTJS_ENV: "development" } as CloudflareEnv,
    rawBody: "{}",
    signature: null,
  }),
  true,
);

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

const wranglerSrc = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
const wranglerDefaultVars = wranglerSrc.match(/"vars"\s*:\s*\{[\s\S]*?\}/);
assert.ok(wranglerDefaultVars, "wrangler.jsonc must declare default vars");
assert.match(wranglerDefaultVars[0], /"BETTER_AUTH_URL"\s*:\s*"https:\/\/getcitebrief\.com"/);
assert.doesNotMatch(wranglerDefaultVars[0], /citebrief\.sarmaasis\.workers\.dev/);

const workerSrc = readFileSync(join(process.cwd(), "worker.ts"), "utf8");
const workerFetch = workerSrc.slice(workerSrc.indexOf("async fetch"), workerSrc.indexOf("async queue"));
assert.match(workerFetch, /logProductionSecretProblems\s*\(\s*env\s*\)/);
assert.ok(
  workerFetch.indexOf("logProductionSecretProblems") < workerFetch.indexOf("handler.fetch"),
  "production secret checks must run before serving fetch traffic",
);
assert.match(workerFetch, /problems\.length/);
const workerQueue = workerSrc.slice(workerSrc.indexOf("async queue"), workerSrc.indexOf("async scheduled"));
assert.match(workerQueue, /productionTrafficBlocked/);
assert.match(workerSrc.slice(workerSrc.indexOf("async scheduled")), /productionTrafficBlocked/);

const addonSrc = readFileSync(join(process.cwd(), "src/app/api/billing/addon/route.ts"), "utf8");
assert.match(addonSrc, /if\s*\(\s*!ent\.paid\s*\)/);
assert.doesNotMatch(addonSrc, /addon !== "extra_run"/);

const workspaceSrc = readFileSync(join(process.cwd(), "src/lib/workspace.ts"), "utf8");
assert.match(workspaceSrc, /trialSubscriptionPatch/);
assert.match(workspaceSrc, /insert\(subscriptions\)/);

async function runAsyncChecks() {
  const first = await consumeRateLimit(store, { bucket: "t", limit: 2, windowMs: 60_000 }, "s", 1);
  const second = await consumeRateLimit(store, { bucket: "t", limit: 2, windowMs: 60_000 }, "s", 1);
  const third = await consumeRateLimit(store, { bucket: "t", limit: 2, windowMs: 60_000 }, "s", 1);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);

  const prodNoKv = await consumeRouteRateLimit(
    new Request("https://getcitebrief.com/api/auth/sign-in"),
    { NEXTJS_ENV: "production" } as CloudflareEnv,
    RATE_LIMITS.auth,
  );
  assert.ok(prodNoKv, "production without KV must deny");
  assert.equal(prodNoKv.status, 503);

  const devNoKv = await consumeRouteRateLimit(
    new Request("http://localhost:3000/api/auth/sign-in"),
    { NEXTJS_ENV: "development" } as CloudflareEnv,
    RATE_LIMITS.auth,
  );
  assert.equal(devNoKv, null);

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

  const stubProdEnv = {
    DODO_PAYMENTS_API_KEY: "stub",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
    NEXTJS_ENV: "production",
    BETTER_AUTH_URL: "https://getcitebrief.com",
  } as CloudflareEnv;
  const stubCheckout = await createDodoCheckout({
    env: stubProdEnv,
    plan: "agency",
    workspaceId: "ws_1",
    customerEmail: "owner@example.com",
    customerName: "Owner",
    returnUrl: "https://getcitebrief.com",
  });
  assert.notEqual(stubCheckout.mode, "stub");
  assert.equal(stubCheckout.mode, "unavailable");
  assert.equal(shouldWriteStubPaidSubscription({ mode: stubCheckout.mode, isProduction: true }), false);

  const stubEnterprise = await createDodoCheckout({
    env: {
      DODO_PAYMENTS_API_KEY: "stub",
      DODO_PAYMENTS_ENVIRONMENT: "test_mode",
      NEXTJS_ENV: "development",
    } as CloudflareEnv,
    plan: "enterprise",
    workspaceId: "ws_1",
    customerEmail: "owner@example.com",
    customerName: "Owner",
    returnUrl: "http://localhost:3000",
  });
  assert.equal(stubEnterprise.mode, "unavailable");
  assert.equal(stubEnterprise.message, ENTERPRISE_CONTACT_SALES_MESSAGE);
  assert.equal(
    shouldWriteStubPaidSubscription({ mode: stubEnterprise.mode, isProduction: false, plan: "enterprise" }),
    false,
  );

  const stubAddon = await createDodoAddonCheckout({
    env: stubProdEnv,
    workspaceId: "ws_1",
    customerEmail: "owner@example.com",
    customerName: "Owner",
    returnUrl: "https://getcitebrief.com",
    addon: "extra_run",
  });
  assert.notEqual(stubAddon.mode, "stub");
  assert.equal(stubAddon.mode, "unavailable");

  const stubPortal = await createDodoCustomerPortal({
    env: stubProdEnv,
    customerId: "cus_1",
    returnUrl: "https://getcitebrief.com",
  });
  assert.notEqual(stubPortal.mode, "stub");
  assert.equal(stubPortal.mode, "unavailable");
}

runAsyncChecks()
  .then(() => {
    console.log("launch-audit.test.ts ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
