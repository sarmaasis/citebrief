"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RunNowButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/runs`, { method: "POST" });
      const data = (await response.json()) as { runId?: string; error?: string };
      if (!response.ok || !data.runId) {
        setError(data.error ?? "Could not queue the run.");
        return;
      }
      router.push(`/app/brands/${brandId}/runs/${data.runId}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" onClick={() => void run()} disabled={pending}>
        Run now
      </Button>
      {error ? <p className="text-xs text-cb-danger">{error}</p> : null}
    </div>
  );
}
