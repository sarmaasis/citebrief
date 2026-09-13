"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PortfolioExport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center?format=csv");
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not export the portfolio.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const header = response.headers.get("Content-Disposition");
      const match = header?.match(/filename="([^"]+)"/);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = match?.[1] ?? "citebrief-portfolio.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void download()}>
        {busy ? "Exporting…" : "Export CSV"}
      </Button>
      {error ? <p className="mt-2 text-xs text-cb-danger">{error}</p> : null}
    </div>
  );
}
