export const PLANS = {
  starter: {
    id: "starter" as const,
    name: "Starter",
    amountUsd: 149,
    brands: 3,
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
    brands: 8,
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
    amountUsd: 499,
    brands: 20,
    prompts: 30,
    seats: 10,
    cadence: "weekly" as const,
    includedRunsPerBrandPerWeek: 1,
    manualRerunsPerBrandPerWeek: 2,
    hardStopMultiplier: 3,
  },
} as const;

export type PlanId = keyof typeof PLANS;

/** Extra brand addon list prices (PRODUCT §10). */
export const EXTRA_BRAND_USD: Record<PlanId, number> = {
  starter: 39,
  agency: 39,
  studio: 29,
};

/** Extra run meter list prices (PRODUCT §10). */
export const EXTRA_RUN_USD: Record<PlanId, number> = {
  starter: 9,
  agency: 9,
  studio: 9,
};

export const SEAT_OVERAGE_USD = 15;

export function parsePlanId(value: string | null | undefined): PlanId | null {
  if (!value) return null;
  const key = value.toLowerCase() as PlanId;
  return key in PLANS ? key : null;
}

export function planBrandLimit(plan: PlanId | string | null | undefined, extraBrands = 0): number {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return PLANS[id].brands + Math.max(0, extraBrands);
}

export function planSeatCap(plan: PlanId | string | null | undefined): number {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return PLANS[id].seats;
}

export function planPromptCap(plan: PlanId | string | null | undefined): number {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return PLANS[id].prompts;
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

export const TRIAL_DAYS = 14;
export const TRIAL_BRAND_CAP = 1;
export const TRIAL_RUN_CAP = 1;

/** Agency+ may invite members (subject to seat cap). */
export function planAllowsMembers(plan: PlanId | string | null | undefined) {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return id === "agency" || id === "studio";
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

export function planAllowsCustomSender(plan: PlanId | string | null | undefined) {
  return parsePlanId(plan ?? "") === "studio";
}

export function planAllowsStudioEngines(plan: PlanId | string | null | undefined) {
  return parsePlanId(plan ?? "") === "studio";
}

export function planAllowsHistory(plan: PlanId | string | null | undefined) {
  return planAllowsMembers(plan);
}
