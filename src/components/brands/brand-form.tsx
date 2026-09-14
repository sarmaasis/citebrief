"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpgradeDialog } from "@/components/billing/upgrade-prompt";
import { upgradeCopyForCapCode, UPGRADE_COPY } from "@/lib/upgrade-copy";
import { BrandFields, type BrandFieldValues } from "@/components/brands/brand-fields";
import { Button } from "@/components/ui/button";

export function BrandForm({
  brandId,
  initial,
}: {
  brandId?: string;
  initial: BrandFieldValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    setCode(null);
    setShowUpgrade(false);
    try {
      const response = await fetch(brandId ? `/api/brands/${brandId}` : "/api/brands", {
        method: brandId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { id?: string; error?: string; code?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Could not save the brand.");
        setCode(data.code ?? null);
        if (!brandId && (response.status === 402 || response.status === 403 || data.error?.toLowerCase().includes("cap"))) {
          setShowUpgrade(true);
        }
        return;
      }
      router.push(`/app/brands/${data.id ?? brandId}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const upgrade = upgradeCopyForCapCode(code, status) ?? UPGRADE_COPY.trialBrand;

  return (
    <div className="min-w-0 space-y-6">
      <form onSubmit={onSubmit} className="max-w-xl space-y-6">
        <BrandFields values={values} onChange={setValues} />
        {status && !showUpgrade ? <p className="text-sm text-cb-danger">{status}</p> : null}
        <Button type="submit" disabled={pending}>
          {brandId ? "Save brand" : "Add brand"}
        </Button>
      </form>
      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        title={upgrade.title}
        body={status ?? upgrade.body}
        cta={upgrade.cta}
      />
    </div>
  );
}
