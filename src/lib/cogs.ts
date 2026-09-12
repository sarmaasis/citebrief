import type { EngineId } from "@/lib/engines";
import { CORE_ENGINES, STUDIO_ENGINES } from "@/lib/engines";

/** Rough USD COGS estimates per prompt call (product unit economics). */
export const COGS_PER_PROMPT_USD: Record<EngineId, number> = {
  chatgpt: 0.012,
  perplexity: 0.015,
  gemini: 0.01,
  aio: 0.02,
  claude: 0.018,
  grok: 0.014,
};

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
  const all = [...CORE_ENGINES, ...STUDIO_ENGINES];
  const engines = all
    .filter((engine) => args.engineStates[engine.id] && args.engineStates[engine.id] !== "skipped")
    .map((engine) => {
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
    note: "Estimate only. Live invoices may differ by model tier and cache hits.",
  };
}
