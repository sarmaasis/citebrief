export const CORE_ENGINES = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "gemini", label: "Gemini" },
  { id: "claude", label: "Claude" },
  { id: "grok", label: "Grok" },
  { id: "aio", label: "AI Overviews" },
  { id: "perplexity", label: "Perplexity" },
] as const;

/** Reserved for future premium-only engines. Claude adapter exists but is not plan-selectable for now. */
export const STUDIO_ENGINES = [] as const;

export const ENGINES = [...CORE_ENGINES, ...STUDIO_ENGINES] as const;

export type CoreEngineId = (typeof CORE_ENGINES)[number]["id"];
export type StudioEngineId = (typeof STUDIO_ENGINES)[number]["id"];
export type EngineId = (typeof ENGINES)[number]["id"];
export type EngineState = "queued" | "running" | "complete" | "failed" | "skipped";

export type EngineStatusMap = Partial<Record<EngineId, EngineState>> & Record<CoreEngineId, EngineState>;

export function emptyEngineStatus(includeStudio = false): EngineStatusMap {
  void includeStudio;
  const base: EngineStatusMap = {
    chatgpt: "queued",
    gemini: "queued",
    claude: "queued",
    grok: "queued",
    aio: "queued",
    perplexity: "queued",
  };
  return base;
}

export function parseEngineStatus(value: string | null | undefined): EngineStatusMap {
  if (!value) {
    return emptyEngineStatus();
  }
  try {
    const parsed = JSON.parse(value) as Partial<Record<EngineId, EngineState>>;
    return { ...emptyEngineStatus(), ...parsed };
  } catch {
    return emptyEngineStatus();
  }
}

export function isStudioEngine(id: string): id is StudioEngineId {
  void id;
  return false;
}

export function isCoreEngine(id: string): id is CoreEngineId {
  return CORE_ENGINES.some((engine) => engine.id === id);
}

/** Cap used when 5+ engines are scheduled; for Agency’s 4 engines, softFailMinCore(4) returns 3 (3/4). */
export const SOFT_FAIL_MIN_CORE = 4;

/** Trial first report uses the same four public engines as paid Growth. Cap reruns, not engines. */
export const TRIAL_ENGINE_IDS: EngineId[] = ["chatgpt", "gemini", "grok", "aio"];

/** Paid Growth default: no Claude (web-search token blowups). */
export const AGENCY_ENGINE_IDS: EngineId[] = ["chatgpt", "gemini", "grok", "aio"];

/** Scale / Enterprise use the same Gateway-safe engine set for launch. */
export const STUDIO_ENGINE_IDS: EngineId[] = ["chatgpt", "gemini", "grok", "aio"];

/** Claude adapter remains; plans do not select Claude for now. */
export function isClaudeDisabled(id: string): boolean {
  return id === "claude";
}

/** @deprecated Use isClaudeDisabled — Claude is off all plans, not Studio-gated. */
export function claudeRequiresStudio(id: string): boolean {
  return isClaudeDisabled(id);
}

/** 20 prompts × 4 engines + headroom. Prompt-writer is not billed on this counter. */
export const TRIAL_MAX_GATEWAY_REQUESTS = 90;

export function isTrialEngine(id: string): boolean {
  return TRIAL_ENGINE_IDS.includes(id as EngineId);
}

/** Queued for engines in this run; skipped for the rest so UI/soft-fail ignore them. */
export function scheduledEngineStatus(scheduledIds: readonly string[]): EngineStatusMap {
  const engines = emptyEngineStatus();
  const scheduled = new Set(scheduledIds);
  for (const engine of CORE_ENGINES) {
    engines[engine.id] = scheduled.has(engine.id) ? "queued" : "skipped";
  }
  return engines;
}

/** How many scheduled engines must succeed before a PDF ships. */
export function softFailMinCore(scheduledCount: number): number {
  if (scheduledCount <= 0) return 1;
  if (scheduledCount <= 2) return scheduledCount;
  if (scheduledCount === 3) return 2;
  if (scheduledCount === 4) return 3;
  return Math.min(SOFT_FAIL_MIN_CORE, scheduledCount);
}

/** @deprecated Phase 2 time-poll stub. Prefer processRun. */
export function advanceEngineStub(createdAt: Date, now = new Date()): {
  status: "queued" | "running" | "complete" | "partial";
  engines: EngineStatusMap;
} {
  const elapsed = Math.max(0, now.getTime() - createdAt.getTime());
  const engines = emptyEngineStatus();
  const order = CORE_ENGINES.map((engine) => engine.id);
  const stepMs = 2500;

  order.forEach((id, index) => {
    const start = index * stepMs;
    const done = start + stepMs;
    if (elapsed < start) {
      engines[id] = "queued";
    } else if (elapsed < done) {
      engines[id] = "running";
    } else {
      engines[id] = "complete";
    }
  });

  const complete = order.filter((id) => engines[id] === "complete").length;
  if (complete === 0 && elapsed < 400) {
    return { status: "queued", engines };
  }
  if (complete === order.length) {
    return { status: "complete", engines };
  }
  return { status: "running", engines };
}
