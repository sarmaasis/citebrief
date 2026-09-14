"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpgradeDialog } from "@/components/billing/upgrade-prompt";
import { brandCapUpgradeFromError, upgradeCopyForCapCode, UPGRADE_COPY } from "@/lib/upgrade-copy";
import { Button } from "@/components/ui/button";

export function DuplicateBrandButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function duplicate() {
    setPending(true);
    setError(null);
    setCode(null);
    setShowUpgrade(false);
    try {
      const created = await fetch(`/api/brands/${brandId}/duplicate`, { method: "POST" });
      const data = (await created.json()) as { id?: string; error?: string; code?: string };
      if (!created.ok || !data.id) {
        setError(data.error ?? "Could not duplicate this brand.");
        setCode(data.code ?? null);
        if (created.status === 402 || created.status === 403) setShowUpgrade(true);
        return;
      }
      router.push(`/app/brands/${data.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const upgrade = code
    ? upgradeCopyForCapCode(code, error)
    : brandCapUpgradeFromError(error) ?? UPGRADE_COPY.trialBrand;

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void duplicate()}>
        {pending ? "Duplicating…" : "Duplicate"}
      </Button>
      {error && !showUpgrade ? <span className="sr-only">{error}</span> : null}
      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        title={upgrade.title}
        body={error ?? upgrade.body}
        cta={upgrade.cta}
      />
    </>
  );
}
