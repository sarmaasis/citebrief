import assert from "node:assert/strict";
import { marketingHeaderAuthLink, marketingPrimaryCta, planCtaHref } from "./marketing-cta";

assert.deepEqual(marketingHeaderAuthLink(false), { href: "/login", label: "Sign in" });
assert.deepEqual(marketingHeaderAuthLink(true), { href: "/app", label: "Open app" });

assert.deepEqual(marketingPrimaryCta({ signedIn: false, signedOutLabel: "Start the first report" }), {
  href: "/signup?plan=agency",
  label: "Start the first report",
});
assert.deepEqual(
  marketingPrimaryCta({ signedIn: true, appHref: "/app", signedOutLabel: "Start the first report" }),
  { href: "/app", label: "Open workspace" },
);
assert.deepEqual(
  marketingPrimaryCta({ signedIn: true, appHref: "/app/onboarding", signedOutLabel: "Send a Friday report" }),
  { href: "/app/onboarding", label: "Add a brand" },
);

assert.equal(planCtaHref({ plan: "agency", interval: "monthly", signedIn: false }), "/signup?plan=agency");
assert.equal(planCtaHref({ plan: "agency", interval: "annual", signedIn: true }), "/api/checkout?plan=agency&interval=annual");

console.log("marketing-cta.test.ts ok");
