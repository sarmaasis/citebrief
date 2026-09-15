import type { BrandFieldValues } from "@/components/brands/brand-fields";
import { parseEngineStatus, type EngineState } from "@/lib/engines";
import { MIXES, normalizePromptDrafts, type PromptDraft, type PromptMix } from "@/lib/prompts";

function asPromptMix(value: string): PromptMix {
  return (MIXES as readonly string[]).includes(value) ? (value as PromptMix) : "discovery";
}

export type OnboardingResume = {
  brandId: string;
  fields: BrandFieldValues;
  prompts: PromptDraft[];
  runId: string | null;
  reportId: string | null;
  reportReady: boolean;
  runStatus: string | null;
  scoreMentioned: number | null;
  approvalState: string | null;
  engines: Record<string, EngineState> | null;
};

/** Resume only an explicit `?brandId=` that still exists. Never guess among brands. */
export function shouldResumeOnboardingBrand(args: {
  startFresh: boolean;
  requestedBrandId: string | null | undefined;
  brandIds: string[];
}): string | null {
  if (args.startFresh) return null;
  const requested = args.requestedBrandId?.trim() || null;
  if (requested && args.brandIds.includes(requested)) return requested;
  return null;
}

/** Next onboarding URL with brandId, or null when the query is already correct. */
export function onboardingUrlWithBrand(
  pathname: string,
  search: string,
  brandId: string,
): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.get("brandId") === brandId) return null;
  params.delete("new");
  params.set("brandId", brandId);
  return `${pathname}?${params.toString()}`;
}

export function syncOnboardingBrandQuery(brandId: string) {
  if (typeof window === "undefined") return;
  const next = onboardingUrlWithBrand(window.location.pathname, window.location.search, brandId);
  if (!next) return;
  window.history.replaceState(window.history.state, "", next);
}

export function onboardingStepFromResume(resume: Pick<OnboardingResume, "reportId" | "runId" | "prompts">): 1 | 2 | 3 {
  if (resume.reportId || resume.runId) return 3;
  if (resume.prompts.length) return 2;
  return 1;
}

export function serializeOnboardingResume(bundle: {
  brand: {
    id: string;
    name: string;
    siteUrl: string | null;
    logoUrl: string | null;
    category: string | null;
    vertical: string | null;
    market?: string | null;
    buyer: string | null;
    job: string | null;
    incumbent: string | null;
    constraintNote: string | null;
    clientOwner: string | null;
    clientNotes?: string | null;
  };
  competitors: Array<{ name: string }>;
  prompts: Array<{ id?: string; text: string; mix: string; sortOrder: number }>;
  latestRun: { id: string; status: string; engineStates: string | null } | null;
  latestReport: {
    id: string;
    scoreMentioned: number | null;
    approvalState: string | null;
    sentAt: string | Date | null;
  } | null;
}): OnboardingResume {
  const brand = bundle.brand;
  return {
    brandId: brand.id,
    fields: {
      name: brand.name,
      siteUrl: brand.siteUrl ?? "",
      logoUrl: brand.logoUrl ?? "",
      category: brand.category ?? "",
      vertical: brand.vertical ?? "",
      market: brand.market ?? "US",
      buyer: brand.buyer ?? "",
      job: brand.job ?? "",
      incumbent: brand.incumbent ?? "",
      competitors: bundle.competitors.map((row) => row.name).join(", "),
      constraintNote: brand.constraintNote ?? "",
      clientOwner: brand.clientOwner ?? "",
      clientNotes: brand.clientNotes ?? "",
    },
    prompts: normalizePromptDrafts(
      bundle.prompts.map((row) => ({
        id: row.id,
        text: row.text,
        mix: asPromptMix(row.mix),
        sortOrder: row.sortOrder,
      })),
    ),
    runId: bundle.latestRun?.id ?? null,
    reportId: bundle.latestReport?.id ?? null,
    reportReady: Boolean(bundle.latestReport),
    runStatus: bundle.latestRun?.status ?? null,
    scoreMentioned: bundle.latestReport?.scoreMentioned ?? null,
    approvalState: bundle.latestReport?.approvalState ?? null,
    engines: bundle.latestRun ? parseEngineStatus(bundle.latestRun.engineStates) : null,
  };
}
