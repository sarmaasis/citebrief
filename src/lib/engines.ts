export const CORE_ENGINES = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
  { id: "aio", label: "AI Overviews" },
] as const;

/** Studio plan add-on engines (optional; soft-fail still keyed off core 4). */
export const STUDIO_ENGINES = [
  { id: "claude", label: "Claude" },
  { id: "grok", label: "Grok" },
] as const;

export const ENGINES = [...CORE_ENGINES, ...STUDIO_ENGINES] as const;

export type CoreEngineId = (typeof CORE_ENGINES)[number]["id"];
export type StudioEngineId = (typeof STUDIO_ENGINES)[number]["id"];
export type EngineId = (typeof ENGINES)[number]["id"];
export type EngineState = "queued" | "running" | "complete" | "failed" | "skipped";

export type EngineStatusMap = Partial<Record<EngineId, EngineState>> & Record<CoreEngineId, EngineState>;

export function emptyEngineStatus(includeStudio = false): EngineStatusMap {
  const base: EngineStatusMap = {
    chatgpt: "queued",
    perplexity: "queued",
    gemini: "queued",
    aio: "queued",
  };
  if (includeStudio) {
    base.claude = "queued";
    base.grok = "queued";
  }
  return base;
}

export function parseEngineStatus(value: string | null | undefined): EngineStatusMap {
  if (!value) {
    return emptyEngineStatus();
  }
  try {
    const parsed = JSON.parse(value) as Partial<Record<EngineId, EngineState>>;
    return { ...emptyEngineStatus(Boolean(parsed.claude || parsed.grok)), ...parsed };
  } catch {
    return emptyEngineStatus();
  }
}

export function isStudioEngine(id: string): id is StudioEngineId {
  return id === "claude" || id === "grok";
}

export function isCoreEngine(id: string): id is CoreEngineId {
  return CORE_ENGINES.some((engine) => engine.id === id);
}

/** Soft-fail threshold: ship PDF when at least this many *core* engines succeed. */
export const SOFT_FAIL_MIN_CORE = 3;

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
