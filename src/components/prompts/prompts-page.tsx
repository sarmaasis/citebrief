"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IndustryPacks } from "@/components/prompts/industry-packs";
import { PromptEditor } from "@/components/prompts/prompt-editor";
import { Button } from "@/components/ui/button";
import {
  generatePromptsCta,
  promptSetHint,
  REPLACE_PROMPTS_CONFIRM,
  type PromptDraft,
  validatePromptSet,
} from "@/lib/prompts";

export function PromptsPage({
  brandId,
  brandName,
  initial,
  promptCap,
}: {
  brandId: string;
  brandName: string;
  initial: PromptDraft[];
  promptCap: number;
}) {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptDraft[]>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function generate() {
    const belowCap = prompts.length > 0 && prompts.length < promptCap;
    const replacing = prompts.length > 0 && !belowCap;
    if (replacing && !window.confirm(REPLACE_PROMPTS_CONFIRM)) {
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/prompts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          belowCap
            ? { existing: prompts, mode: "topup" }
            : prompts.length > 0
              ? { mode: "replace" }
              : {},
        ),
      });
      const data = (await response.json()) as { prompts?: PromptDraft[]; error?: string; toppedUp?: boolean };
      if (!response.ok || !data.prompts) {
        setStatus(data.error ?? "Could not generate prompts.");
        return;
      }
      setPrompts(data.prompts);
      if (data.toppedUp) {
        setStatus(`Added ${data.prompts.length - prompts.length} buyer questions (now ${data.prompts.length}).`);
      } else if (replacing) {
        setStatus("New set ready — save to archive the previous prompts and keep past report scores.");
      }
    } finally {
      setPending(false);
    }
  }

  async function save() {
    const check = validatePromptSet(prompts, brandName, { maxCount: promptCap });
    if (!check.ok) {
      setStatus(check.error);
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/prompts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Could not save prompts.");
        return;
      }
      setStatus(`Saved ${prompts.length} buyer questions.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Prompts</h1>
          <p className="mt-1 text-sm text-cb-muted">{promptSetHint(promptCap)}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void generate()} disabled={pending}>
            {generatePromptsCta(promptCap, prompts.length > 0, prompts.length)}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={pending || prompts.length === 0}>
            Save
          </Button>
        </div>
      </div>
      <div className="mb-6">
        <IndustryPacks
          brandName={brandName}
          promptCap={promptCap}
          onApply={(next) => {
            if (prompts.length > 0 && !window.confirm(REPLACE_PROMPTS_CONFIRM)) {
              return;
            }
            setPrompts(next);
          }}
        />
      </div>
      {prompts.length === 0 ? (
        <div className="rounded-cb-card border border-cb-line bg-cb-surface px-6 py-16 text-center">
          <p className="text-sm text-cb-text">Generate {promptCap} buyer questions for this brand.</p>
          <div className="mt-4">
            <Button type="button" onClick={() => void generate()} disabled={pending}>
              {pending ? "Generating…" : generatePromptsCta(promptCap, false)}
            </Button>
          </div>
        </div>
      ) : (
        <PromptEditor prompts={prompts} brandName={brandName} mixTarget={promptCap < 20 ? 1 : 4} onChange={setPrompts} />
      )}
      {status ? <p className="mt-4 text-sm text-cb-muted">{status}</p> : null}
    </div>
  );
}
