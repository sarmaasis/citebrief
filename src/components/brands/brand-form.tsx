"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
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
  const [pending, setPending] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    setShowUpgrade(false);
    try {
      const response = await fetch(brandId ? `/api/brands/${brandId}` : "/api/brands", {
        method: brandId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Could not save the brand.");
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

  return (
    <div className="space-y-6">
      {showUpgrade ? (
        <UpgradePrompt
          title={UPGRADE_COPY.fourthBrand.title}
          body={UPGRADE_COPY.fourthBrand.body}
          cta={UPGRADE_COPY.fourthBrand.cta}
          onDismiss={() => setShowUpgrade(false)}
        />
      ) : null}
      <form onSubmit={onSubmit} className="max-w-xl space-y-6">
        <BrandFields values={values} onChange={setValues} />
        {status ? <p className="text-sm text-cb-danger">{status}</p> : null}
        <Button type="submit" disabled={pending}>
          {brandId ? "Save brand" : "Add brand"}
        </Button>
      </form>
    </div>
  );
}
