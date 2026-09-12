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

export function parsePlanId(value: string | null | undefined): PlanId | null {
  if (!value) return null;
  const key = value.toLowerCase() as PlanId;
  return key in PLANS ? key : null;
}

export function planBrandLimit(plan: PlanId | string | null | undefined): number {
  const id = parsePlanId(plan ?? "agency") ?? "agency";
  return PLANS[id].brands;
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
