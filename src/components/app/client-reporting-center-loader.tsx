"use client";

import { useEffect, useState } from "react";
import { ClientReportingCenter } from "@/components/app/client-reporting-center";
import type { ClientReportingSummary } from "@/lib/dashboard-metrics";

export function ClientReportingCenterLoader() {
  const [rows, setRows] = useState<ClientReportingSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/reporting")
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          reporting?: ClientReportingSummary[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "Could not load client summaries.");
        return data.reporting ?? [];
      })
      .then((nextRows) => {
        if (alive) setRows(nextRows);
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : "Could not load client summaries.");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5 text-sm text-cb-muted">
        {error}
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5 text-sm text-cb-muted">
        Loading client summaries…
      </div>
    );
  }

  return <ClientReportingCenter rows={rows} />;
}
