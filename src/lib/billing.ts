export const PLANS = {
  starter: {
    id: "starter" as const,
    name: "Starter",
    amountUsd: 149,
    brands: 3,
    prompts: 20,
    cadence: "monthly",
    includedRunsPerBrandPerWeek: 1,
    manualRerunsPerBrandPerWeek: 1,
    hardStopMultiplier: 3,
  },
  agency: {
    id: "agency" as const,
    name: "Agency",
    amountUsd: 199,
    brands: 8,
    prompts: 20,
    cadence: "weekly",
    includedRunsPerBrandPerWeek: 1,
    manualRerunsPerBrandPerWeek: 2,
    hardStopMultiplier: 3,
  },
  studio: {
    id: "studio" as const,
    name: "Studio",
    amountUsd: 399,
    brands: 20,
    prompts: 30,
    cadence: "weekly",
    includedRunsPerBrandPerWeek: 1,
    manualRerunsPerBrandPerWeek: 2,
    hardStopMultiplier: 3,
  },
} as const;

export type PlanId = keyof typeof PLANS;

/** Extra brand addon list prices (Dodo product IDs come from env). */
export const EXTRA_BRAND_USD: Record<PlanId, number> = {
  starter: 25,
  agency: 25,
  studio: 39,
};

/** Extra run meter list prices. */
export const EXTRA_RUN_USD: Record<PlanId, number> = {
  starter: 6,
  agency: 6,
  studio: 9,
};

export function parsePlanId(value: string | null | undefined): PlanId | null {
  if (!value) return null;
  const key = value.toLowerCase() as PlanId;
  return key in PLANS ? key : null;
}

export function planBrandLimit(plan: PlanId | string | null | undefined, extraBrands = 0): number {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return PLANS[id].brands + Math.max(0, extraBrands);
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

export function planAllowsMembers(plan: PlanId | string | null | undefined) {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return id === "agency" || id === "studio";
}

export function planAllowsSlack(plan: PlanId | string | null | undefined) {
  return planAllowsMembers(plan);
}

export function planAllowsStudioEngines(plan: PlanId | string | null | undefined) {
  return parsePlanId(plan ?? "") === "studio";
}
