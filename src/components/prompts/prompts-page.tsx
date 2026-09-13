"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IndustryPacks } from "@/components/prompts/industry-packs";
import { PromptEditor } from "@/components/prompts/prompt-editor";
import { Button } from "@/components/ui/button";
import { type PromptDraft, validatePromptSet } from "@/lib/prompts";

export function PromptsPage({
  brandId,
  brandName,
  initial,
}: {
  brandId: string;
  brandName: string;
  initial: PromptDraft[];
}) {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptDraft[]>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/prompts/generate`, { method: "POST" });
      const data = (await response.json()) as { prompts?: PromptDraft[]; error?: string };
      if (!response.ok || !data.prompts) {
        setStatus(data.error ?? "Could not generate prompts.");
        return;
      }
      setPrompts(data.prompts);
    } finally {
      setPending(false);
    }
  }

  async function save() {
    const check = validatePromptSet(prompts, brandName);
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
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Could not save prompts.");
        return;
      }
      setStatus("Saved twenty buyer questions.");
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
          <p className="mt-1 text-sm text-cb-muted">Lock the mix at 4+4+4+4+4. Buyer questions only.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void generate()} disabled={pending}>
            {prompts.length ? "Regenerate 20 prompts" : "Generate 20 prompts"}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={pending || prompts.length === 0}>
            Save
          </Button>
        </div>
      </div>
      <div className="mb-6">
        <IndustryPacks brandName={brandName} onApply={setPrompts} />
      </div>
      {prompts.length === 0 ? (
        <div className="rounded-cb-card border border-cb-line bg-cb-surface px-6 py-16 text-center">
          <p className="text-sm text-cb-text">Generate twenty buyer questions for this brand.</p>
          <div className="mt-4">
            <Button type="button" onClick={() => void generate()} disabled={pending}>
              {pending ? "Generating…" : "Generate 20 prompts"}
            </Button>
          </div>
        </div>
      ) : (
        <PromptEditor prompts={prompts} brandName={brandName} onChange={setPrompts} />
      )}
      {status ? <p className="mt-4 text-sm text-cb-muted">{status}</p> : null}
    </div>
  );
}
