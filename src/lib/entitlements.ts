import {
  EXTRA_BRAND_USD,
  isAgencyPlus,
  parsePlanId,
  planAllowsApproval,
  planAllowsBulkSend,
  planAllowsClientCc,
  planAllowsCommandCenter,
  planAllowsCustomSender,
  planAllowsEmailSend,
  planAllowsHistory,
  planAllowsMembers,
  planAllowsPortfolioExport,
  planAllowsSlack,
  planAllowsStudioEngines,
  planAllowsWeeklyCadence,
  planBrandLimit,
  planPromptCap,
  planSeatCap,
  PLANS,
  TRIAL_BRAND_CAP,
  TRIAL_DAYS,
  TRIAL_RUN_CAP,
  type PlanId,
} from "@/lib/billing";

export type SubscriptionLike = {
  plan: string;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd?: boolean | null;
  extraBrands?: number | null;
  extraSeats?: number | null;
  extraRuns?: number | null;
  extraRunCredits?: number | null;
  billingInterval?: string | null;
  premiumEnginePack?: number | boolean | null;
} | null;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function isTrialing(sub: SubscriptionLike, now = Date.now()): boolean {
  if (!sub) return false;
  if (sub.status !== "trialing") return false;
  if (sub.trialEndsAt && sub.trialEndsAt.getTime() < now) return false;
  return true;
}

/** Paid access still in the current period (including cancel-at-period-end). */
export function isPaidActive(sub: SubscriptionLike, now = Date.now()): boolean {
  if (!sub) return false;
  if (sub.status !== "active") return false;
  if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < now) {
    return false;
  }
  return true;
}

export function subscriptionEndedAt(sub: SubscriptionLike): Date | null {
  if (!sub) return null;
  if (isPaidActive(sub) || isTrialing(sub)) return null;
  if (sub.currentPeriodEnd) return sub.currentPeriodEnd;
  if (sub.status === "cancelled" || sub.status === "canceled" || sub.status === "past_due") {
    return sub.trialEndsAt;
  }
  return null;
}

/** PDFs and client links stay 90 days after the paid period ends. */
/** Block report-send side effects (email, Slack, sentAt) when any plan gate fails. */
export function reportSendBlockedReason(args: {
  ccClient?: string | null;
  allowsEmailSend: boolean;
  allowsClientCc: boolean;
  requiresApproval?: boolean;
  approved?: boolean;
}): string | null {
  if (!args.allowsEmailSend) {
    return "Email sending requires Agency, Studio, or Enterprise.";
  }
  if (args.requiresApproval && !args.approved) {
    return "Approve this report before sending.";
  }
  if (args.ccClient?.trim() && !args.allowsClientCc) {
    return "Client CC requires Agency, Studio, or Enterprise.";
  }
  return null;
}

/** Permission-only send result: 403 upgrade, or null so the route can proceed (200 after send). */
export function reportSendDenial(args: {
  ccClient?: string | null;
  allowsEmailSend: boolean;
  allowsClientCc: boolean;
  requiresApproval?: boolean;
  approved?: boolean;
}): { status: 403; error: string } | null {
  const error = reportSendBlockedReason(args);
  return error ? { status: 403, error } : null;
}

export function pdfRetentionExpired(sub: SubscriptionLike, now = Date.now()): boolean {
  const ended = subscriptionEndedAt(sub);
  if (!ended) return false;
  return now - ended.getTime() > NINETY_DAYS_MS;
}

export type WorkspaceEntitlements = {
  plan: PlanId;
  paid: boolean;
  trialing: boolean;
  ended: boolean;
  brandLimit: number;
  seatCap: number;
  promptCap: number;
  extraBrands: number;
  extraSeats: number;
  extraRunCredits: number;
  billingInterval: "monthly" | "annual";
  allowsMembers: boolean;
  allowsSlack: boolean;
  allowsWeeklyCadence: boolean;
  allowsMonthlyCadence: boolean;
  allowsClientCc: boolean;
  allowsEmailSend: boolean;
  allowsCustomSender: boolean;
  allowsHistory: boolean;
  allowsStudioEngines: boolean;
  allowsBulkSend: boolean;
  allowsApproval: boolean;
  allowsCommandCenter: boolean;
  allowsPortfolioRollups: boolean;
  allowsWeeklySendQueue: boolean;
  allowsOpportunityRollups: boolean;
  allowsPortfolioExport: boolean;
  allowsPremiumEnginePack: boolean;
  allowsExtraBrands: boolean;
  allowsExtraSeats: boolean;
  extraBrandUsd: number;
  trialBrandCap: number;
  trialRunCap: number;
  trialDays: number;
};

export function workspaceEntitlements(sub: SubscriptionLike, now = Date.now()): WorkspaceEntitlements {
  const trialing = isTrialing(sub, now);
  const paid = isPaidActive(sub, now);
  const plan = parsePlanId(sub?.plan) || (paid ? "agency" : "starter");
  const extraBrands = Math.max(0, sub?.extraBrands || 0);
  const extraSeats = Math.max(0, sub?.extraSeats || 0);
  const extraRunCredits = Math.max(0, sub?.extraRunCredits || 0);
  const premiumEnginePack = Boolean(sub?.premiumEnginePack);
  const billingInterval = sub?.billingInterval === "annual" ? "annual" : "monthly";
  const ended = Boolean(!paid && !trialing && sub && sub.status !== "none");

  if (!paid) {
    return {
      plan,
      paid: false,
      trialing,
      ended,
      brandLimit: TRIAL_BRAND_CAP,
      seatCap: 1,
      promptCap: 20,
      extraBrands: 0,
      extraSeats: 0,
      extraRunCredits,
      billingInterval,
      allowsMembers: false,
      allowsSlack: false,
      allowsWeeklyCadence: false,
      allowsMonthlyCadence: false,
      allowsClientCc: false,
      allowsEmailSend: false,
      allowsCustomSender: false,
      allowsHistory: false,
      allowsStudioEngines: false,
      allowsBulkSend: false,
      allowsApproval: false,
      allowsCommandCenter: false,
      allowsPortfolioRollups: false,
      allowsWeeklySendQueue: false,
      allowsOpportunityRollups: false,
      allowsPortfolioExport: false,
      allowsPremiumEnginePack: false,
      allowsExtraBrands: false,
      allowsExtraSeats: false,
      extraBrandUsd: EXTRA_BRAND_USD[plan],
      trialBrandCap: TRIAL_BRAND_CAP,
      trialRunCap: TRIAL_RUN_CAP,
      trialDays: TRIAL_DAYS,
    };
  }

  return {
    plan,
    paid: true,
    trialing: false,
    ended: false,
    brandLimit: planBrandLimit(plan, extraBrands),
    seatCap: planSeatCap(plan, extraSeats),
    promptCap: planPromptCap(plan),
    extraBrands,
    extraSeats,
    extraRunCredits,
    billingInterval,
    allowsMembers: planAllowsMembers(plan),
    allowsSlack: planAllowsSlack(plan),
    allowsWeeklyCadence: planAllowsWeeklyCadence(plan),
    allowsMonthlyCadence: PLANS[plan].cadence === "monthly",
    allowsClientCc: planAllowsClientCc(plan),
    allowsEmailSend: planAllowsEmailSend(plan),
    allowsCustomSender: planAllowsCustomSender(plan),
    allowsHistory: planAllowsHistory(plan),
    allowsStudioEngines: planAllowsStudioEngines(plan) || premiumEnginePack,
    allowsBulkSend: planAllowsBulkSend(plan),
    allowsApproval: planAllowsApproval(plan),
    allowsCommandCenter: planAllowsCommandCenter(plan),
    allowsPortfolioRollups: planAllowsCommandCenter(plan),
    allowsWeeklySendQueue: planAllowsWeeklyCadence(plan),
    allowsOpportunityRollups: planAllowsCommandCenter(plan),
    allowsPortfolioExport: planAllowsPortfolioExport(plan),
    allowsPremiumEnginePack: isAgencyPlus(plan),
    allowsExtraBrands: isAgencyPlus(plan),
    allowsExtraSeats: planAllowsMembers(plan),
    extraBrandUsd: EXTRA_BRAND_USD[plan],
    trialBrandCap: TRIAL_BRAND_CAP,
    trialRunCap: TRIAL_RUN_CAP,
    trialDays: TRIAL_DAYS,
  };
}

export function upgradeHintForBrandCap(ent: WorkspaceEntitlements): string {
  if (!ent.paid) {
    return `Trial allows ${ent.trialBrandCap} brand. Upgrade to add more.`;
  }
  if (ent.plan === "starter") {
    return `Starter includes ${PLANS.starter.brands} brands. Upgrade to Agency for ${PLANS.agency.brands} brands and weekly Friday reports.`;
  }
  if (ent.plan === "agency") {
    return `Agency includes ${PLANS.agency.brands} brands. Buy an extra brand ($${EXTRA_BRAND_USD.agency}/mo) or upgrade to Studio.`;
  }
  if (ent.plan === "studio") {
    return `Studio includes ${PLANS.studio.brands} brands. Buy an extra brand ($${EXTRA_BRAND_USD.studio}/mo) or talk to us about Enterprise.`;
  }
  return `Enterprise brand limits are contractual. Buy an extra brand ($${EXTRA_BRAND_USD.enterprise}/mo) or ask support to raise the floor.`;
}

export function commandCenterDenial(ent: WorkspaceEntitlements): { status: 403; error: string } | null {
  if (!ent.allowsCommandCenter) {
    return { status: 403, error: "Command Center requires Agency, Studio, or Enterprise." };
  }
  return null;
}

export function upgradeHintForSeatCap(ent: WorkspaceEntitlements): string {
  if (!ent.paid || !ent.allowsMembers) {
    return "Member invites require Agency, Studio, or Enterprise.";
  }
  if (ent.plan === "agency") {
    return `Seat cap reached (${ent.seatCap}). Add a seat ($15/mo) or upgrade to Studio (${PLANS.studio.seats} seats).`;
  }
  return `Seat cap reached (${ent.seatCap}). Add a seat ($15/mo).`;
}
