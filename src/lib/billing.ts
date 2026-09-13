export const PLANS = {
  starter: {
    id: "starter" as const,
    name: "Starter",
    amountUsd: 99,
    brands: 2,
    prompts: 20,
    seats: 1,
    cadence: "monthly" as const,
    includedRunsPerBrandPerWeek: 1,
    manualRerunsPerBrandPerWeek: 1,
    hardStopMultiplier: 3,
  },
  agency: {
    id: "agency" as const,
    name: "Agency",
    amountUsd: 249,
    brands: 10,
    prompts: 20,
    seats: 3,
    cadence: "weekly" as const,
    includedRunsPerBrandPerWeek: 1,
    manualRerunsPerBrandPerWeek: 2,
    hardStopMultiplier: 3,
  },
  studio: {
    id: "studio" as const,
    name: "Studio",
    amountUsd: 799,
    brands: 25,
    prompts: 30,
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
    brands: 25,
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

/** Extra brand addon list prices (PRODUCT §10–11: $29 Agency / $29 Studio). */
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

export const TRIAL_DAYS = 14;
export const TRIAL_BRAND_CAP = 1;
export const TRIAL_RUN_CAP = 1;

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
    return `You are on a ${TRIAL_DAYS}-day trial — 1 brand, 1 seat, 1 report. After trial you continue as ${name} if you subscribe.`;
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

export function planHardStop(plan: PlanId | string | null | undefined): number {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  const base = 1 + PLANS[id].manualRerunsPerBrandPerWeek;
  return base * PLANS[id].hardStopMultiplier;
}

export function isStubSecret(value: string | undefined) {
  return !value || value === "stub" || value.startsWith("stub-");
}

/** Local/dev stub checkout only. Production must never persist a fake paid row. */
export function shouldWriteStubPaidSubscription(args: { mode: string; isProduction: boolean }) {
  return args.mode === "stub" && !args.isProduction;
}

export function stubPaidSubscriptionPatch(args: {
  plan: PlanId;
  interval: "monthly" | "annual";
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const days = args.interval === "annual" ? 365 : 30;
  return {
    plan: args.plan,
    status: "active" as const,
    billingInterval: args.interval,
    currentPeriodEnd: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
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
