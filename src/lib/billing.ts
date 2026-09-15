export const PLANS = {
  starter: {
    id: "starter" as const,
    name: "Starter",
    amountUsd: 79,
    brands: 2,
    prompts: 25,
    seats: 1,
    cadence: "monthly" as const,
    includedRunsPerBrandPerWeek: 1,
    manualRerunsPerBrandPerWeek: 1,
    hardStopMultiplier: 3,
  },
  agency: {
    id: "agency" as const,
    name: "Growth",
    amountUsd: 249,
    brands: 5,
    prompts: 30,
    seats: 3,
    cadence: "weekly" as const,
    includedRunsPerBrandPerWeek: 1,
    /** Friday slot per brand. Monthly re-check credits cover manual checks before $9 extras. */
    manualRerunsPerBrandPerWeek: 0,
    hardStopMultiplier: 3,
  },
  studio: {
    id: "studio" as const,
    name: "Agency",
    amountUsd: 599,
    brands: 20,
    prompts: 25,
    seats: 10,
    cadence: "weekly" as const,
    includedRunsPerBrandPerWeek: 1,
    manualRerunsPerBrandPerWeek: 2,
    hardStopMultiplier: 3,
  },
  /** Contract floor until extras/custom limits are stored. PRODUCT §11. */
  enterprise: {
    id: "enterprise" as const,
    name: "Enterprise",
    amountUsd: 1499,
    brands: 75,
    prompts: 30,
    seats: 10,
    cadence: "weekly" as const,
    includedRunsPerBrandPerWeek: 1,
    manualRerunsPerBrandPerWeek: 2,
    hardStopMultiplier: 3,
  },
} as const;

export type PlanId = keyof typeof PLANS;

/** Public pricing page stays three plans (PRODUCT §18.1). */
export const PUBLIC_PLAN_IDS = ["starter", "agency", "studio"] as const;
export type PublicPlanId = (typeof PUBLIC_PLAN_IDS)[number];

/** Extra brand addon list prices (PRODUCT §10–11: $29 Growth / $29 Agency). */
/** User-facing names for Growth+ / Agency+ gates. Plan IDs stay agency / studio. */
export const GROWTH_PLUS_LABEL = `${PLANS.agency.name}, ${PLANS.studio.name}, or ${PLANS.enterprise.name}`;
export const AGENCY_PLUS_LABEL = `${PLANS.studio.name} or ${PLANS.enterprise.name}`;
export const EXTRA_BRAND_USD: Record<PlanId, number> = {
  starter: 29,
  agency: 29,
  studio: 29,
  enterprise: 29,
};

/** Extra run meter list prices (PRODUCT §10). */
export const EXTRA_RUN_USD: Record<PlanId, number> = {
  starter: 9,
  agency: 9,
  studio: 9,
  enterprise: 9,
};

export const SEAT_OVERAGE_USD = 15;

/** PRODUCT §10 range $99–$199. Listed at the low end until a Dodo product exists. */
export const PREMIUM_ENGINE_PACK_USD = 99;

/** Included manual re-check credits per workspace per month. */
export const MONTHLY_RECHECK_CREDITS: Record<PlanId, number> = {
  starter: 2,
  agency: 10,
  studio: 100,
  enterprise: 100,
};

export const TRIAL_DAYS = 14;
export const TRIAL_BRAND_CAP = 1;
export const TRIAL_RUN_CAP = 1;
/** Trial pack matches paid letter size. Cap reruns, not questions or engines. */
export const TRIAL_PROMPT_CAP = 20;

export function parsePlanId(value: string | null | undefined): PlanId | null {
  if (!value) return null;
  const key = value.toLowerCase() as PlanId;
  return key in PLANS ? key : null;
}

/** Stored continuation / paid plan. Agency only when nothing valid is stored. */
export function resolveSelectedPlan(value: string | null | undefined): PlanId {
  return parsePlanId(value) ?? "agency";
}

export type PlanCardBadge = "After trial" | "Selected" | "Current plan" | null;

/** One highlighted plan: paid current, or unpaid/trial continuation. Never Agency-by-default. */
export function planCardState(args: {
  id: PlanId;
  selectedPlan: PlanId;
  isPaid: boolean;
  isTrialing: boolean;
  currentInterval: "monthly" | "annual";
  viewingAnnual: boolean;
}): {
  highlighted: boolean;
  badge: PlanCardBadge;
  cta: string;
  isCurrentInterval: boolean;
} {
  const viewingInterval = args.viewingAnnual ? "annual" : "monthly";
  const isThisPlan = args.selectedPlan === args.id;
  const sameInterval = args.currentInterval === viewingInterval;
  const paidCurrent = args.isPaid && isThisPlan;
  const isCurrentInterval = paidCurrent && sameInterval;
  const highlighted = isThisPlan;
  const name = PLANS[args.id].name;

  let badge: PlanCardBadge = null;
  if (paidCurrent) badge = "Current plan";
  else if (args.isTrialing && isThisPlan) badge = "After trial";
  else if (!args.isPaid && isThisPlan) badge = "Selected";

  let cta = `Choose ${name}`;
  if (isCurrentInterval) cta = "Current plan";
  else if (paidCurrent && !sameInterval) cta = args.viewingAnnual ? "Switch to annual" : "Switch to monthly";
  else if (!args.isPaid && args.isTrialing && isThisPlan) cta = `Continue with ${name}`;

  return { highlighted, badge, cta, isCurrentInterval };
}

export function billingPageIntro(args: { trialing: boolean; paid: boolean; plan: PlanId }): string {
  const name = PLANS[args.plan].name;
  if (args.paid) {
    return `${name} plan, included usage, and expansion. Invoices and cards live in the billing portal.`;
  }
  if (args.trialing) {
    return `You are on a ${TRIAL_DAYS}-day trial — 1 brand, ${TRIAL_PROMPT_CAP} questions, ChatGPT + Gemini + Grok + AI Overviews, 1 seat, 1 report. After trial you continue as ${name} if you subscribe.`;
  }
  return `${name} is selected. Subscribe to unlock it. Invoices and cards live in the billing portal.`;
}

export function planBrandLimit(plan: PlanId | string | null | undefined, extraBrands = 0): number {
  const id = parsePlanId(plan ?? "starter") ?? "starter";
  return PLANS[id].brands + Math.max(0, extraBrands);
}

export function planSeatCap(plan: PlanId | string | null | undefined, extraSeats = 0): number {
  const id = parsePlanId(plan ?? "starter") ?? "starter";
  return PLANS[id].seats + Math.max(0, extraSeats);
}

export function planPromptCap(plan: PlanId | string | null | undefined): number {
  const id = parsePlanId(plan ?? "starter") ?? "starter";
  return PLANS[id].prompts;
}

/** Annual = 10 months (2 months free). */
export const ANNUAL_MONTHS_CHARGED = 10;

export function planAnnualAmountUsd(plan: PlanId | string | null | undefined): number {
  const id = parsePlanId(plan ?? "starter") ?? "starter";
  return PLANS[id].amountUsd * ANNUAL_MONTHS_CHARGED;
}

export function parseBillingInterval(value: string | null | undefined): "monthly" | "annual" {
  return value === "annual" || value === "year" || value === "yearly" ? "annual" : "monthly";
}

export function isAgencyPlus(plan: PlanId | string | null | undefined) {
  const id = parsePlanId(plan ?? "");
  return id === "agency" || id === "studio" || id === "enterprise";
}

export function planAllowsExtraBrands(plan: PlanId | string | null | undefined) {
  return isAgencyPlus(plan);
}

export function planManualRerunCap(plan: PlanId | string | null | undefined): number {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return PLANS[id].manualRerunsPerBrandPerWeek;
}

export function planMonthlyRecheckCredits(plan: PlanId | string | null | undefined): number {
  const id = parsePlanId(plan ?? "starter") ?? "starter";
  return MONTHLY_RECHECK_CREDITS[id];
}

/** Included weekly budget: scheduled slot + free manuals (Agency manuals are 0). */
export function planIncludedRunCap(plan: PlanId | string | null | undefined): number {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return PLANS[id].includedRunsPerBrandPerWeek + PLANS[id].manualRerunsPerBrandPerWeek;
}

export function planHardStop(plan: PlanId | string | null | undefined): number {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return planIncludedRunCap(id) * PLANS[id].hardStopMultiplier;
}

export function isStubSecret(value: string | undefined) {
  return !value || value === "stub" || value.startsWith("stub-");
}

export const ENTERPRISE_CONTACT_SALES_MESSAGE =
  "Enterprise is contract-only. Contact sales.";

/**
 * Hidden `/api/checkout?plan=enterprise` is not self-serve.
 * Impersonation or an already-paid Enterprise workspace may continue to a live Dodo product.
 */
export function selfServeEnterpriseCheckoutDenied(args: {
  plan: PlanId;
  alreadyEnterprise?: boolean;
  impersonating?: boolean;
}): string | null {
  if (args.plan !== "enterprise") return null;
  if (args.impersonating || args.alreadyEnterprise) return null;
  return ENTERPRISE_CONTACT_SALES_MESSAGE;
}

/** Local/dev stub checkout only. Never persist a fake paid Enterprise row. */
export function shouldWriteStubPaidSubscription(args: {
  mode: string;
  isProduction: boolean;
  plan?: PlanId;
}) {
  if (args.plan === "enterprise") return false;
  return args.mode === "stub" && !args.isProduction;
}

export function stubPaidSubscriptionPatch(args: {
  plan: PlanId;
  interval: "monthly" | "annual";
  now?: Date;
  /** Prior interval — used to preserve prepaid annual paid-through date. */
  previousInterval?: string | null;
  previousPeriodEnd?: Date | null;
}) {
  const now = args.now ?? new Date();
  const days = args.interval === "annual" ? 365 : 30;
  let currentPeriodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  // Stub has no Dodo proration: keep remaining annual paid-through when leaving annual mid-term.
  if (
    args.previousInterval === "annual" &&
    args.interval !== "annual" &&
    args.previousPeriodEnd &&
    args.previousPeriodEnd.getTime() > now.getTime()
  ) {
    currentPeriodEnd = args.previousPeriodEnd;
  }
  return {
    plan: args.plan,
    status: "active" as const,
    billingInterval: args.interval,
    currentPeriodEnd,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
  };
}

/** First workspace: 14-day clock. Caps stay 1/1/1 until status is active. */
export function trialSubscriptionPatch(now = new Date()) {
  return {
    plan: "agency" as const,
    status: "trialing" as const,
    billingInterval: "monthly" as const,
    trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
}

/** Agency+ may invite members (subject to seat cap). */
export function planAllowsMembers(plan: PlanId | string | null | undefined) {
  return isAgencyPlus(plan);
}

export function planAllowsSlack(plan: PlanId | string | null | undefined) {
  return planAllowsMembers(plan);
}

export function planAllowsWeeklyCadence(plan: PlanId | string | null | undefined) {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return PLANS[id].cadence === "weekly";
}

export function planAllowsClientCc(plan: PlanId | string | null | undefined) {
  return planAllowsMembers(plan);
}

/** Paid Agency+ may email the Friday report. Starter and unpaid/trial cannot. */
export function planAllowsEmailSend(plan: PlanId | string | null | undefined) {
  return isAgencyPlus(plan);
}

export function planAllowsCustomSender(plan: PlanId | string | null | undefined) {
  const id = parsePlanId(plan ?? "");
  return id === "studio" || id === "enterprise";
}

export function planAllowsStudioEngines(plan: PlanId | string | null | undefined) {
  const id = parsePlanId(plan ?? "");
  return id === "studio" || id === "enterprise";
}

export function planAllowsBulkSend(plan: PlanId | string | null | undefined) {
  const id = parsePlanId(plan ?? "");
  return id === "studio" || id === "enterprise";
}

export function planAllowsApproval(plan: PlanId | string | null | undefined) {
  return isAgencyPlus(plan);
}

export function planAllowsHistory(plan: PlanId | string | null | undefined) {
  return planAllowsMembers(plan);
}

/** Agency+ Command Center: portfolio health, risk, opportunities, ROI. */
export function planAllowsCommandCenter(plan: PlanId | string | null | undefined) {
  return isAgencyPlus(plan);
}

export function planAllowsPortfolioExport(plan: PlanId | string | null | undefined) {
  return planAllowsBulkSend(plan);
}
