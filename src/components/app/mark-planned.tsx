"use client";

import { OpportunityStatusControl } from "@/components/app/opportunity-status";
import type { OpportunityStatus } from "@/lib/dashboard-metrics";

/** @deprecated Prefer OpportunityStatusControl with explicit status. */
export function MarkPlanned({
  brandId,
  reportId,
  opportunityKey,
  planned: initiallyPlanned,
  status,
}: {
  brandId: string;
  reportId: string | null;
  opportunityKey: string;
  planned?: boolean;
  status?: OpportunityStatus;
}) {
  return (
    <OpportunityStatusControl
      brandId={brandId}
      reportId={reportId}
      opportunityKey={opportunityKey}
      status={status ?? (initiallyPlanned ? "planned" : "open")}
    />
  );
}
