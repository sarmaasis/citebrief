import type { Database } from "@/db";
import {
  AGENCY_ENGINE_IDS,
  CORE_ENGINES,
  ENGINES,
  STUDIO_ENGINE_IDS,
  TRIAL_ENGINE_IDS,
  isClaudeDisabled,
  type EngineId,
} from "@/lib/engines";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getWorkspaceSubscription } from "@/lib/usage";

/** Trial default: same four public engines as paid Growth. */
export const TRIAL_DEFAULT_ENGINE_STRING = "chatgpt,gemini,grok,aio";
/** Growth default: ChatGPT, Gemini, Grok, AIO — no Claude. */
export const DEFAULT_ENGINE_STRING = "chatgpt,gemini,grok,aio";
/** Agency default: Growth set + Perplexity. Claude not selectable. */
export const STUDIO_DEFAULT_ENGINE_STRING = "chatgpt,gemini,grok,aio,perplexity";

const KNOWN_IDS = new Set(ENGINES.map((engine) => engine.id));

export type PlanEngineGate = {
  paid: boolean;
  allowsStudioEngines?: boolean;
};

/** Engines the workspace may select in Settings / persist as defaults (Claude never included). */
export function selectableEngineIds(gate: PlanEngineGate): EngineId[] {
  if (!gate.paid) return [...TRIAL_ENGINE_IDS];
  const planIds = gate.allowsStudioEngines ? STUDIO_ENGINE_IDS : AGENCY_ENGINE_IDS;
  return planIds.filter((id) => !isClaudeDisabled(id));
}

export function defaultEngineStringForPlan(gate: PlanEngineGate): string {
  if (!gate.paid) return TRIAL_DEFAULT_ENGINE_STRING;
  return gate.allowsStudioEngines ? STUDIO_DEFAULT_ENGINE_STRING : DEFAULT_ENGINE_STRING;
}

export function parseRequestedEngines(value: string | null | undefined): string[] {
  const tokens = (value || DEFAULT_ENGINE_STRING)
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const migrated = tokens.flatMap((token) => {
    // Legacy alias: old "studio" pack mapped to Claude+Grok; Claude is off.
    if (token === "studio") return ["grok"];
    if (token === "-studio") return ["-grok"];
    return [token];
  });
  return Array.from(new Set(migrated));
}

export function validateDefaultEngines(
  value: string | null | undefined,
  gate: PlanEngineGate | boolean,
): { ok: true; normalized: string } | { ok: false; error: string } {
  // Legacy callers passed studioOk boolean only (assumed paid).
  const opts: PlanEngineGate =
    typeof gate === "boolean" ? { paid: true, allowsStudioEngines: gate } : gate;
  const allowed = new Set(selectableEngineIds(opts));
  const fallback = defaultEngineStringForPlan(opts);
  const requested = parseRequestedEngines(value);
  if (requested.length === 0) {
    return { ok: true, normalized: fallback };
  }
  const kept: string[] = [];
  for (const token of requested) {
    const id = token.startsWith("-") ? token.slice(1) : token;
    if (!KNOWN_IDS.has(id as EngineId)) {
      return { ok: false, error: `Unknown engine "${id}". Use chatgpt, gemini, grok, aio, perplexity.` };
    }
    // Claude stays in the catalog for adapters/history but is not plan-selectable.
    if (isClaudeDisabled(id)) continue;
    if (!allowed.has(id as EngineId)) continue;
    kept.push(token);
  }
  if (kept.length === 0) {
    return { ok: true, normalized: fallback };
  }
  return { ok: true, normalized: kept.join(",") };
}

export function enginesForRun(args: {
  requested: string[];
  paid: boolean;
  allowsStudioEngines?: boolean;
}): Array<{ id: EngineId; label: string }> {
  if (!args.paid) {
    const trial = CORE_ENGINES.filter((engine) => TRIAL_ENGINE_IDS.includes(engine.id));
    const fromRequest = CORE_ENGINES.filter(
      (engine) => args.requested.includes(engine.id) && TRIAL_ENGINE_IDS.includes(engine.id),
    );
    return fromRequest.length > 0 ? fromRequest : trial;
  }

  const studioOk = Boolean(args.allowsStudioEngines);
  const planIds = studioOk ? STUDIO_ENGINE_IDS : AGENCY_ENGINE_IDS;
  const allowed = CORE_ENGINES.filter(
    (engine) => planIds.includes(engine.id) && !isClaudeDisabled(engine.id),
  );
  const fromRequest = allowed.filter((engine) => args.requested.includes(engine.id));
  if (fromRequest.length > 0) return fromRequest;
  return allowed;
}

export async function resolveRunEngines(args: {
  db: Database;
  workspaceId: string;
  defaultEngines: string | null | undefined;
  env?: CloudflareEnv;
}): Promise<{ engines: Array<{ id: EngineId; label: string }>; includeStudio: boolean }> {
  const sub = await getWorkspaceSubscription(args.db, args.workspaceId);
  const ent = workspaceEntitlements(sub);
  const requested = parseRequestedEngines(args.defaultEngines);
  return {
    engines: enginesForRun({
      requested,
      paid: ent.paid,
      allowsStudioEngines: ent.allowsStudioEngines,
    }),
    includeStudio: ent.allowsStudioEngines,
  };
}
