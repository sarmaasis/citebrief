import type { Database } from "@/db";
import { isEngineApiConfigured } from "@/lib/engine-adapters";
import { parsePlanId } from "@/lib/billing";
import { CORE_ENGINES, STUDIO_ENGINES, type EngineId } from "@/lib/engines";
import { getWorkspaceSubscription } from "@/lib/usage";

export async function resolveRunEngines(args: {
  db: Database;
  workspaceId: string;
  defaultEngines: string | null | undefined;
  env?: CloudflareEnv;
}): Promise<{ engines: Array<{ id: EngineId; label: string }>; includeStudio: boolean }> {
  const sub = await getWorkspaceSubscription(args.db, args.workspaceId);
  const plan = parsePlanId(sub?.plan) || "agency";
  const studioOk = plan === "studio";

  const requested = (args.defaultEngines || "chatgpt,perplexity,gemini,aio")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

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
