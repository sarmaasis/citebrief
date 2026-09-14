"use client";

import { useEffect } from "react";
import { MIX_LABEL, MIXES, mixCounts, normalizePromptDrafts, type PromptDraft, type PromptMix, isVanityPrompt } from "@/lib/prompts";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

export function MixMeter({ prompts, mixTarget = 4 }: { prompts: PromptDraft[]; mixTarget?: number }) {
  const counts = mixCounts(prompts);
  return (
    <div className="flex flex-wrap gap-2 text-xs text-cb-muted">
      {MIXES.map((mix) => (
        <span
          key={mix}
          className={cn(
            "rounded-cb-control px-2 py-1",
            counts[mix] >= mixTarget ? "bg-cb-accent-subtle text-cb-accent" : "bg-cb-surface text-cb-missing",
          )}
        >
          {MIX_LABEL[mix]} {counts[mix]}
        </span>
      ))}
    </div>
  );
}

export function PromptEditor({
  prompts,
  brandName,
  mixTarget = 4,
  onChange,
}: {
  prompts: PromptDraft[];
  brandName?: string;
  mixTarget?: number;
  onChange: (next: PromptDraft[]) => void;
}) {
  function update(index: number, patch: Partial<PromptDraft>) {
    onChange(prompts.map((prompt, i) => (i === index ? { ...prompt, ...patch } : prompt)));
  }

  useEffect(() => {
    const cleaned = normalizePromptDrafts(prompts);
    if (cleaned.some((prompt, index) => prompt.text !== prompts[index]?.text)) {
      onChange(cleaned);
    }
  }, [onChange, prompts]);

  return (
    <div className="space-y-3">
      <MixMeter prompts={prompts} mixTarget={mixTarget} />
      <ol className="space-y-3">
        {prompts.map((prompt, index) => {
          const vanity = isVanityPrompt(prompt.text, brandName, prompt.mix);
          return (
            <li key={prompt.id ?? `${prompt.sortOrder}-${index}`} className="rounded-cb-card border border-cb-line bg-cb-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-cb-muted">{String(index + 1).padStart(2, "0")}</span>
                <NativeSelect
                  aria-label={`Mix for question ${index + 1}`}
                  className="h-8 w-auto px-2 text-xs"
                  value={prompt.mix}
                  onChange={(event) => update(index, { mix: event.target.value as PromptMix })}
                >
                  {MIXES.map((mix) => (
                    <option key={mix} value={mix}>
                      {MIX_LABEL[mix]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Input
                aria-label={`Buyer question ${index + 1}`}
                value={prompt.text}
                onChange={(event) => update(index, { text: event.target.value })}
              />
              {vanity ? <p className="mt-2 text-xs text-cb-danger">{vanity}</p> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
