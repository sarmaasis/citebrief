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

  async function mark() {
    if (planned) return;
    setBusy(true);
    try {
      const response = await fetch("/api/opportunities/planned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, reportId, key: opportunityKey }),
      });
      if (response.ok) setPlanned(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={planned || busy} onClick={() => void mark()}>
      {planned ? "Planned" : busy ? "Saving…" : "Mark as planned"}
    </Button>
  );
}
