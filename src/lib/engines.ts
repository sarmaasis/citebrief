export const ENGINES = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
  { id: "aio", label: "AI Overviews" },
] as const;

export type EngineId = (typeof ENGINES)[number]["id"];
export type EngineState = "queued" | "running" | "complete" | "failed";

export type EngineStatusMap = Record<EngineId, EngineState>;

export function emptyEngineStatus(): EngineStatusMap {
  return {
    chatgpt: "queued",
    perplexity: "queued",
    gemini: "queued",
    aio: "queued",
  };
}

export function parseEngineStatus(value: string | null | undefined): EngineStatusMap {
  if (!value) {
    return emptyEngineStatus();
  }
  try {
    const parsed = JSON.parse(value) as Partial<EngineStatusMap>;
    return { ...emptyEngineStatus(), ...parsed };
  } catch {
    return emptyEngineStatus();
  }
}

export function advanceEngineStub(createdAt: Date, now = new Date()): {
  status: "queued" | "running" | "complete" | "partial";
  engines: EngineStatusMap;
} {
  const elapsed = Math.max(0, now.getTime() - createdAt.getTime());
  const engines = emptyEngineStatus();
  const order = ENGINES.map((engine) => engine.id);
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
