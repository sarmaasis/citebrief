import { parseBillingInterval, parsePlanId, type PlanId } from "@/lib/billing";

export function signupHref(plan: PlanId | null | undefined, interval: "monthly" | "annual" = "monthly") {
  const params = new URLSearchParams();
  if (plan) params.set("plan", plan);
  if (interval === "annual") params.set("interval", "annual");
  const query = params.toString();
  return query ? `/signup?${query}` : "/signup";
}

export function loginHref(opts?: {
  invite?: string | null;
  plan?: PlanId | null;
  interval?: "monthly" | "annual";
}) {
  const params = new URLSearchParams();
  if (opts?.invite) params.set("invite", opts.invite);
  if (opts?.plan) params.set("plan", opts.plan);
  if (opts?.interval === "annual") params.set("interval", "annual");
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

export function checkoutHref(plan: PlanId, interval: "monthly" | "annual" = "monthly") {
  const params = new URLSearchParams({ plan });
  if (interval === "annual") params.set("interval", "annual");
  return `/api/checkout?${params.toString()}`;
}

export function planCtaHref(opts: {
  plan: PlanId;
  interval: "monthly" | "annual";
  signedIn: boolean;
}) {
  return opts.signedIn ? checkoutHref(opts.plan, opts.interval) : signupHref(opts.plan, opts.interval);
}

export function marketingHeaderAuthLink(signedIn: boolean) {
  return signedIn ? { href: "/app" as const, label: "Open app" } : { href: "/login" as const, label: "Sign in" };
}

export function marketingPrimaryCta(opts: {
  signedIn: boolean;
  appHref?: "/app" | "/app/onboarding";
  signedOutLabel: string;
  signedOutHref?: string;
}) {
  if (!opts.signedIn) {
    return { href: opts.signedOutHref ?? "/signup?plan=agency", label: opts.signedOutLabel };
  }
  const appHref = opts.appHref ?? "/app";
  return {
    href: appHref,
    label: appHref === "/app/onboarding" ? "Add a brand" : "Open workspace",
  };
}

/** After signup/login, annual plan picks continue into checkout so interval is not dropped. */
export function postAuthPath(opts: {
  inviteToken?: string | null;
  plan?: PlanId | null;
  interval?: "monthly" | "annual";
}) {
  if (opts.inviteToken) return `/invite/${opts.inviteToken}`;
  if (opts.plan && opts.interval === "annual") {
    return checkoutHref(opts.plan, "annual");
  }
  return "/app";
}

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

export function readPlanAndInterval(params: { plan?: string; interval?: string }) {
  return {
    planId: parsePlanId(params.plan),
    interval: parseBillingInterval(params.interval),
  };
}
