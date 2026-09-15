"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConvertPitchButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function convert() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/convert`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not convert this pitch.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button type="button" size="sm" disabled={busy} onClick={() => void convert()}>
        {busy ? "Converting…" : "Convert to client brand"}
      </Button>
      {error ? <p className="mt-2 text-xs text-cb-danger">{error}</p> : null}
    </div>
  );
}
