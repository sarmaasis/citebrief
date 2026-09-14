"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpgradeDialog } from "@/components/billing/upgrade-prompt";
import { upgradeCopyForCapCode, UPGRADE_COPY } from "@/lib/upgrade-copy";
import { Button } from "@/components/ui/button";

export function RunNowButton({
  brandId,
  disabled = false,
  hint,
  label = "Run now",
  promptId,
  compact = false,
}: {
  brandId: string;
  disabled?: boolean;
  hint?: string | null;
  label?: string;
  /** When set, deep-links into the run with this prompt highlighted. */
  promptId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [extra, setExtra] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function run() {
    setPending(true);
    setError(null);
    setCode(null);
    setExtra(false);
    setShowUpgrade(false);
    try {
      const response = await fetch(`/api/brands/${brandId}/runs`, {
        method: "POST",
        headers: promptId ? { "Content-Type": "application/json" } : undefined,
        body: promptId ? JSON.stringify({ promptId }) : undefined,
      });
      const data = (await response.json()) as {
        runId?: string;
        error?: string;
        extraRun?: boolean;
        code?: string;
      };
      if (!response.ok || !data.runId) {
        setError(data.error ?? "Could not queue the run.");
        setCode(data.code ?? null);
        if (response.status === 402) setShowUpgrade(true);
        return;
      }
      if (data.extraRun) setExtra(true);
      const focus = promptId ? `?prompt=${encodeURIComponent(promptId)}` : "";
      router.push(`/app/brands/${brandId}/runs/${data.runId}${focus}`);
    } finally {
      setPending(false);
    }
  }

  const upgrade = upgradeCopyForCapCode(code, error) ?? UPGRADE_COPY.extraRun;

  if (compact) {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => void run()}
          disabled={pending || disabled}
          className="text-sm text-cb-accent disabled:opacity-50"
        >
          {pending ? "Queuing…" : label}
        </button>
        {error && !showUpgrade ? <span className="text-xs text-cb-danger">{error}</span> : null}
        <UpgradeDialog
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          title={upgrade.title}
          body={error ?? upgrade.body}
          cta={upgrade.cta}
        />
      </span>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <Button type="button" onClick={() => void run()} disabled={pending || disabled}>
        {pending ? "Queuing…" : label}
      </Button>
      {hint ? <p className="max-w-[220px] text-right text-xs text-cb-muted">{hint}</p> : null}
      {extra ? (
        <p className="max-w-[220px] text-right text-xs text-cb-pending">
          This run is outside the included cap and will be metered.
        </p>
      ) : null}
      {error && !showUpgrade ? <p className="max-w-[220px] text-right text-xs text-cb-danger">{error}</p> : null}
      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        title={upgrade.title}
        body={error ?? upgrade.body}
        cta={upgrade.cta}
      />
    </div>
  );
}
