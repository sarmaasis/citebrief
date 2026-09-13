"use client";

import { CORE_ENGINES, STUDIO_ENGINES } from "@/lib/engines";
import { Label } from "@/components/ui/label";

export function EnginePicker({
  value,
  onChange,
  studioAllowed,
}: {
  value: string;
  onChange: (next: string) => void;
  studioAllowed: boolean;
}) {
  const selected = new Set(
    value
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );

  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    const core = CORE_ENGINES.map((engine) => engine.id).filter((id) => next.has(id));
    const studio = STUDIO_ENGINES.map((engine) => engine.id).filter((id) => next.has(id));
    onChange([...core, ...studio].join(",") || "chatgpt,perplexity,gemini,aio");
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-cb-text">Default engines</legend>
      <p className="text-xs text-cb-muted">
        Friday reports still ship if three of the four core sources return.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {CORE_ENGINES.map((engine) => (
          <label key={engine.id} className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--cb-accent)]"
              checked={selected.has(engine.id)}
              onChange={(event) => toggle(engine.id, event.target.checked)}
            />
            {engine.label}
          </label>
        ))}
      </div>
      <div className="pt-2">
        <Label className="text-xs text-cb-muted">Studio add-on</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {STUDIO_ENGINES.map((engine) => (
            <label
              key={engine.id}
              className={`flex h-10 items-center gap-2 text-sm ${studioAllowed ? "" : "text-cb-muted"}`}
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--cb-accent)]"
                checked={selected.has(engine.id)}
                disabled={!studioAllowed}
                onChange={(event) => toggle(engine.id, event.target.checked)}
              />
              {engine.label}
            </label>
          ))}
        </div>
        {!studioAllowed ? (
          <p className="mt-1 text-xs text-cb-muted">Claude and Grok are on Studio.</p>
        ) : null}
      </div>
    </fieldset>
  );
}
