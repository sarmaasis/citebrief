"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import type { OpportunityStatus } from "@/lib/dashboard-metrics";

const STATUSES: Array<{ value: OpportunityStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "dismissed", label: "Dismissed" },
];

export function OpportunityStatusControl({
  brandId,
  reportId,
  opportunityKey,
  status: initialStatus,
}: {
  brandId: string;
  reportId: string | null;
  opportunityKey: string;
  status: OpportunityStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OpportunityStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(next: OpportunityStatus) {
    if (next === status || busy) return;
    const previous = status;
    setStatus(next);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/opportunities/planned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, reportId, key: opportunityKey, status: next }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setStatus(previous);
        setError(data.error ?? "Could not update status.");
        return;
      }
      router.refresh();
    } catch {
      setStatus(previous);
      setError("Could not update status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <NativeSelect
        aria-label="Opportunity status"
        className="min-w-36"
        disabled={busy}
        value={status}
        onChange={(event) => void onChange(event.target.value as OpportunityStatus)}
      >
        {STATUSES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </NativeSelect>
      {busy ? <span className="text-xs text-cb-muted">Saving…</span> : null}
      {error ? <span className="text-xs text-cb-danger">{error}</span> : null}
    </span>
  );
}
