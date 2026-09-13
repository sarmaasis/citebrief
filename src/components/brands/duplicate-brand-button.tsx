"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { Button } from "@/components/ui/button";

export function DuplicateBrandButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function duplicate() {
    setPending(true);
    setError(null);
    setShowUpgrade(false);
    try {
      const created = await fetch(`/api/brands/${brandId}/duplicate`, { method: "POST" });
      const data = (await created.json()) as { id?: string; error?: string };
      if (!created.ok || !data.id) {
        setError(data.error ?? "Could not duplicate this brand.");
        if (created.status === 402 || created.status === 403) setShowUpgrade(true);
        return;
      }
      router.push(`/app/brands/${data.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void duplicate()}>
        {pending ? "Duplicating…" : "Duplicate"}
      </Button>
      {error ? <p className="text-xs text-cb-danger">{error}</p> : null}
      {showUpgrade ? (
        <UpgradePrompt
          title={UPGRADE_COPY.fourthBrand.title}
          body={UPGRADE_COPY.fourthBrand.body}
          cta={UPGRADE_COPY.fourthBrand.cta}
          onDismiss={() => setShowUpgrade(false)}
        />
      ) : null}
    </div>
  );
}
