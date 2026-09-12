import type { EngineId } from "@/lib/engines";

export type EngineQueryInput = {
  engine: EngineId;
  prompt: string;
  brand: string;
  competitors: string[];
  buyer?: string | null;
};

export type EngineQueryResult = {
  rawAnswer: string;
  stubbed: boolean;
  latencyMs: number;
};

const SYSTEM_HINTS: Record<EngineId, string> = {
  chatgpt: "OpenAI Responses + web (stub)",
  perplexity: "Perplexity Sonar (stub)",
  gemini: "Gemini + Search grounding (stub)",
  aio: "Google AI Overviews browser (stub)",
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(items: T[], seed: number, salt: number): T {
  return items[(seed + salt) % items.length]!;
}

/**
 * Deterministic stub answers so local/dev works without API keys.
 * When real keys exist later, swap the body of queryEngine.
 */
export async function queryEngine(input: EngineQueryInput): Promise<EngineQueryResult> {
  const started = Date.now();
  const seed = hashSeed(`${input.engine}|${input.prompt}|${input.brand}`);
  const rivals = input.competitors.length > 0 ? input.competitors : ["ClickUp", "Asana", "Monday.com"];
  const winnerPool = [input.brand, ...rivals];
  const whoWon = pick(winnerPool, seed, 3);
  const named = whoWon === input.brand || seed % 5 !== 0;
  const shortlist = named
    ? [whoWon, ...rivals.filter((name) => name !== whoWon)].slice(0, 3)
    : rivals.slice(0, 3);

  // Tiny delay so UI can show running states without blocking Workers long.
  await new Promise((resolve) => setTimeout(resolve, 15 + (seed % 40)));

  const buyer = input.buyer || "a buyer";
  const urls = named
    ? [`https://example.com/${input.brand.toLowerCase().replace(/\s+/g, "-")}`, "https://g2.com/categories/example"]
    : [`https://example.com/${whoWon.toLowerCase().replace(/\s+/g, "-")}`];

  const rawAnswer = [
    `${SYSTEM_HINTS[input.engine]} answer for ${buyer}.`,
    `Question: ${input.prompt}`,
    `Shortlist: ${shortlist.join(", ")}.`,
    named
      ? `${input.brand} appears in the shortlist${whoWon === input.brand ? " and leads" : ""}.`
      : `${input.brand} is not named. ${whoWon} leads this shortlist.`,
    `Sources: ${urls.join(" · ")}`,
  ].join(" ");

  return {
    rawAnswer,
    stubbed: true,
    latencyMs: Date.now() - started,
  };
}

export function isEngineApiConfigured(_engine: EngineId, env: CloudflareEnv): boolean {
  // Stub path until real keys are wired. Keep false so local always simulates.
  void env;
  return false;
}
