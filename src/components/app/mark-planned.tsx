"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MarkPlanned({
  brandId,
  reportId,
  opportunityKey,
  planned: initiallyPlanned,
}: {
  brandId: string;
  reportId: string | null;
  opportunityKey: string;
  planned?: boolean;
}) {
  const [planned, setPlanned] = useState(Boolean(initiallyPlanned));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark() {
    if (planned) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/opportunities/planned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, reportId, key: opportunityKey }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not mark this as planned.");
        return;
      }
      setPlanned(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" disabled={planned || busy} onClick={() => void mark()}>
        {planned ? "Planned" : busy ? "Saving…" : "Mark as planned"}
      </Button>
      {error ? <span className="text-xs text-cb-danger">{error}</span> : null}
    </span>
  );
}
