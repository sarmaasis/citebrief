import type { EngineId } from "@/lib/engines";
import { CORE_ENGINES } from "@/lib/engines";

/**
 * Per-engine USD per prompt, from Cloudflare AI Gateway User Insights
 * (search-backed where the model completed). Blended $0.076/call was Claude.
 *
 *   claude-sonnet-5     19 req  $3.65  → $0.192/req
 *   gemini-2.5-flash    12 req  $0.07  → $0.006/req (switched from 3.6-flash; same price tier)
 *   gpt-5.4-mini         8 req  $0.06  → $0.008/req
 *   grok-4.3            20 req  $0.01  → $0.001/req
 *   AIO is Browser Rendering, not Gateway — keep a small placeholder.
 */
export const COGS_PER_PROMPT_USD: Record<EngineId, number> = {
  chatgpt: 0.008,
  gemini: 0.006,
  claude: 0.19,
  grok: 0.001,
  aio: 0.02,
};

/** @deprecated Claude-weighted blend from $3.80/50. Prefer COGS_PER_PROMPT_USD. */
export const COGS_GATEWAY_USD_PER_CALL = 0.076;

/** Writer is not in the engine table; keep a small non-search add-on. */
export const COGS_WRITER_USD = 0.05;
export const COGS_PDF_USD = 0.02;

export type CogsEstimate = {
  runId: string;
  promptCount: number;
  engines: Array<{ id: EngineId; label: string; status: string; prompts: number; usd: number }>;
  writerUsd: number;
  pdfUsd: number;
  totalUsd: number;
  note: string;
};

export function estimateRunCogs(args: {
  runId: string;
  promptCount: number;
  engineStates: Record<string, string>;
}): CogsEstimate {
  const engines = CORE_ENGINES.filter(
    (engine) => args.engineStates[engine.id] && args.engineStates[engine.id] !== "skipped",
  ).map((engine) => {
    const status = args.engineStates[engine.id] || "unknown";
    const billed = status === "complete" || status === "failed" || status === "running";
    const prompts = billed ? args.promptCount : 0;
    const usd = Number((prompts * COGS_PER_PROMPT_USD[engine.id]).toFixed(4));
    return { id: engine.id as EngineId, label: engine.label, status, prompts, usd };
  });

  const engineUsd = engines.reduce((sum, row) => sum + row.usd, 0);
  const writerUsd = COGS_WRITER_USD;
  const pdfUsd = COGS_PDF_USD;
  const totalUsd = Number((engineUsd + writerUsd + pdfUsd).toFixed(4));

  return {
    runId: args.runId,
    promptCount: args.promptCount,
    engines,
    writerUsd,
    pdfUsd,
    totalUsd,
    note: "Per-engine rates from Gateway insights: Claude ~$0.19/req (web-search tokens), GPT-5.4-mini ~$0.008, Gemini 3.6 Flash ~$0.006, Grok 4.3 ~$0.001. Live invoices move with search page size and cache.",
  };
}
