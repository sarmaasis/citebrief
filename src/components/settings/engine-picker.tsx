"use client";

import { CORE_ENGINES, isClaudeDisabled, type EngineId } from "@/lib/engines";
import {
  defaultEngineStringForPlan,
  selectableEngineIds,
  type PlanEngineGate,
} from "@/lib/plan-engines";

const CATALOG_ENGINES = CORE_ENGINES.filter((engine) => !isClaudeDisabled(engine.id) && engine.id !== "perplexity");

export function EnginePicker({
  value,
  onChange,
  paid,
  studioAllowed,
}: {
  value: string;
  onChange: (next: string) => void;
  paid: boolean;
  studioAllowed: boolean;
}) {
  const gate: PlanEngineGate = { paid, allowsStudioEngines: studioAllowed };
  const allowedIds = selectableEngineIds(gate);
  const allowed = new Set<EngineId>(allowedIds);
  const planDefault = defaultEngineStringForPlan(gate);
  const selected = new Set(
    value
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((id): id is EngineId => Boolean(id) && allowed.has(id as EngineId)),
  );

  function toggle(id: EngineId, checked: boolean) {
    if (!allowed.has(id) || isClaudeDisabled(id)) return;
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    const core = allowedIds.filter((engineId) => next.has(engineId));
    onChange(core.join(",") || planDefault);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-cb-text">Default engines</legend>
      <p className="text-xs text-cb-muted">
        {paid
          ? studioAllowed
            ? "Friday reports use ChatGPT, Gemini, Grok, and AI Overviews. Reports ship if most sources return."
            : "Friday reports use ChatGPT, Gemini, Grok, and AI Overviews."
          : "Trial reports use ChatGPT, Gemini, Grok, and AI Overviews. One full run."}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {CATALOG_ENGINES.map((engine) => {
          const locked = !allowed.has(engine.id);
          return (
            <label
              key={engine.id}
              className={`flex h-10 items-center gap-2 text-sm ${locked ? "text-cb-muted" : ""}`}
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--cb-accent)]"
                checked={!locked && selected.has(engine.id)}
                disabled={locked}
                onChange={(event) => toggle(engine.id, event.target.checked)}
              />
              <span>
                {engine.label}
                {locked ? (
                  <span className="ml-1 text-xs text-cb-muted">
                    (paid)
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
