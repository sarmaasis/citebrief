import type { Database } from "@/db";
import { isEngineApiConfigured } from "@/lib/engine-adapters";
import { CORE_ENGINES, ENGINES, STUDIO_ENGINES, type EngineId } from "@/lib/engines";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getWorkspaceSubscription } from "@/lib/usage";

const KNOWN_IDS = new Set(ENGINES.map((engine) => engine.id));

export function parseRequestedEngines(value: string | null | undefined): string[] {
  return (value || "chatgpt,perplexity,gemini,aio")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function validateDefaultEngines(
  value: string | null | undefined,
  studioOk: boolean,
): { ok: true; normalized: string } | { ok: false; error: string } {
  const requested = parseRequestedEngines(value);
  if (requested.length === 0) {
    return { ok: true, normalized: "chatgpt,perplexity,gemini,aio" };
  }
  for (const token of requested) {
    const id = token.startsWith("-") ? token.slice(1) : token;
    if (id === "studio") continue;
    if (!KNOWN_IDS.has(id as EngineId)) {
      return { ok: false, error: `Unknown engine "${id}". Use chatgpt, perplexity, gemini, aio, claude, grok.` };
    }
    if (!studioOk && (id === "claude" || id === "grok")) {
      return { ok: false, error: "Claude and Grok require Studio." };
    }
  }
  return { ok: true, normalized: requested.join(",") };
}

export async function resolveRunEngines(args: {
  db: Database;
  workspaceId: string;
  defaultEngines: string | null | undefined;
  env?: CloudflareEnv;
}): Promise<{ engines: Array<{ id: EngineId; label: string }>; includeStudio: boolean }> {
  const sub = await getWorkspaceSubscription(args.db, args.workspaceId);
  const ent = workspaceEntitlements(sub);
  const studioOk = ent.allowsStudioEngines;

  const requested = parseRequestedEngines(args.defaultEngines);

  const core = CORE_ENGINES.filter((engine) => requested.includes(engine.id));
  const coreList = core.length > 0 ? [...core] : [...CORE_ENGINES];

  const studio: Array<{ id: EngineId; label: string }> = [];
  if (studioOk) {
    for (const engine of STUDIO_ENGINES) {
      const excluded = requested.includes(`-${engine.id}`);
      if (excluded) continue;
      const wanted = requested.includes(engine.id) || requested.includes("studio");
      if (wanted || isEngineApiConfigured(engine.id, args.env)) {
        studio.push(engine);
      }
    }
  }

  return {
    engines: [...coreList, ...studio],
    includeStudio: studio.length > 0,
  };
}
