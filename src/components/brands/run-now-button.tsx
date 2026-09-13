"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { Button } from "@/components/ui/button";

export function RunNowButton({
  brandId,
  disabled = false,
  hint,
}: {
  brandId: string;
  disabled?: boolean;
  hint?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function run() {
    setPending(true);
    setError(null);
    setExtra(false);
    setShowUpgrade(false);
    try {
      const response = await fetch(`/api/brands/${brandId}/runs`, { method: "POST" });
      const data = (await response.json()) as { runId?: string; error?: string; extraRun?: boolean };
      if (!response.ok || !data.runId) {
        setError(data.error ?? "Could not queue the run.");
        if (response.status === 402) setShowUpgrade(true);
        return;
      }
      if (data.extraRun) setExtra(true);
      router.push(`/app/brands/${brandId}/runs/${data.runId}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col items-end gap-2">
      <Button type="button" onClick={() => void run()} disabled={pending || disabled}>
        {pending ? "Queuing…" : "Run now"}
      </Button>
      {hint ? <p className="text-xs text-cb-muted">{hint}</p> : null}
      {extra ? <p className="text-xs text-cb-pending">This run is outside the included cap and will be metered.</p> : null}
      {showUpgrade ? (
        <UpgradePrompt
          title={UPGRADE_COPY.extraRun.title}
          body={UPGRADE_COPY.extraRun.body}
          cta={UPGRADE_COPY.extraRun.cta}
          onDismiss={() => setShowUpgrade(false)}
        />
      ) : error ? (
        <p className="text-xs text-cb-danger">{error}</p>
      ) : null}
    </div>
  );
}
