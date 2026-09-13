export type PipelineStage =
  | "not_configured"
  | "ready_to_run"
  | "running"
  | "needs_review"
  | "ready_to_send"
  | "sent";
export type ClientRisk = "stable" | "watch" | "at_risk";

export type CommandRow = {
  promptCount: number;
  mentionedDelta: number | null;
  latestRun: { status: string } | null;
  latestReport: {
    id: string;
    sentAt: Date | string | null;
    scoreMentioned: number | null;
    scoreRecommended: number | null;
    scoreTotal: number | null;
    approvalState?: string | null;
  } | null;
};

export const PIPELINE_LABEL: Record<PipelineStage, string> = {
  not_configured: "Not configured",
  ready_to_run: "Ready to run",
  running: "Running",
  needs_review: "Needs review",
  ready_to_send: "Ready to send",
  sent: "Sent",
};

export const RISK_LABEL: Record<ClientRisk, string> = {
  stable: "Stable",
  watch: "Watch",
  at_risk: "At risk",
};

export function pipelineStage(row: CommandRow): PipelineStage {
  if (row.promptCount === 0) return "not_configured";
  const status = row.latestRun?.status;
  if (status === "queued" || status === "running") return "running";
  if (row.latestReport?.sentAt) return "sent";
  if (!row.latestReport) return "ready_to_run";
  if (row.latestReport.approvalState === "approved") return "ready_to_send";
  return "needs_review";
}

export function clientRisk(row: CommandRow): ClientRisk {
  if (row.latestRun?.status === "failed") return "at_risk";
  const named = row.latestReport?.scoreMentioned;
  if (row.latestReport && named === 0) return "at_risk";
  if (row.mentionedDelta != null && row.mentionedDelta <= -3) return "at_risk";
  if (row.promptCount === 0) return "watch";
  if (!row.latestReport) return "watch";
  if (row.mentionedDelta != null && row.mentionedDelta < 0) return "watch";
  const rec = row.latestReport.scoreRecommended;
  if (named != null && named > 0 && rec === 0) return "watch";
  if (!row.latestReport.sentAt) return "watch";
  return "stable";
}

export function weeklyAction(
  row: CommandRow & { brand: { id: string; name: string } },
  allowsEmailSend: boolean,
): { brandId: string; brandName: string; verb: string; reason: string; href: string } | null {
  const brandId = row.brand.id;
  const brandName = row.brand.name;
  if (row.promptCount === 0) {
    return {
      brandId,
      brandName,
      verb: "Generate prompts",
      reason: "No 20-question set yet",
      href: `/app/brands/${brandId}/prompts`,
    };
  }
  const status = row.latestRun?.status;
  if (status === "queued" || status === "running") {
    return {
      brandId,
      brandName,
      verb: "Review run",
      reason: "A report is still running",
      href: `/app/brands/${brandId}`,
    };
  }
  if (status === "failed") {
    return {
      brandId,
      brandName,
      verb: "Rerun failed engine",
      reason: "Last run did not ship",
      href: `/app/brands/${brandId}`,
    };
  }
  if (!row.latestReport) {
    return {
      brandId,
      brandName,
      verb: "Run report",
      reason: "Prompts are ready, no PDF yet",
      href: `/app/brands/${brandId}`,
    };
  }
  if (allowsEmailSend && !row.latestReport.sentAt) {
    const approved = row.latestReport.approvalState === "approved";
    return {
      brandId,
      brandName,
      verb: approved ? "Send report" : "Review report",
      reason: approved ? "PDF is approved and ready to send" : "Approve this report before sending",
      href: `/app/brands/${brandId}/reports/${row.latestReport.id}`,
    };
  }
  if (!allowsEmailSend && !row.latestReport.sentAt) {
    return {
      brandId,
      brandName,
      verb: "Review report",
      reason: "Download or copy the client link",
      href: `/app/brands/${brandId}/reports/${row.latestReport.id}`,
    };
  }
  return null;
}

export function opportunityFromRow(row: CommandRow & { brand: { id: string; name: string } }): {
  client: string;
  reason: string;
  service: string;
  href: string;
} | null {
  const href = row.latestReport
    ? `/app/brands/${row.brand.id}/reports/${row.latestReport.id}`
    : `/app/brands/${row.brand.id}`;
  const named = row.latestReport?.scoreMentioned;
  const rec = row.latestReport?.scoreRecommended;
  if (named != null && named > 0 && (rec == null || rec < named)) {
    return {
      client: row.brand.name,
      reason: "Named in answers but not recommended first",
      service: "Comparison page",
      href,
    };
  }
  if (row.mentionedDelta != null && row.mentionedDelta < 0) {
    return {
      client: row.brand.name,
      reason: `Named score dropped ${Math.abs(row.mentionedDelta)}`,
      service: "Source refresh",
      href,
    };
  }
  if (row.latestReport && named === 0) {
    return {
      client: row.brand.name,
      reason: "No presence on key buyer questions",
      service: "GEO package",
      href,
    };
  }
  return null;
}

export function pipelineCounts(rows: CommandRow[]) {
  const counts: Record<PipelineStage, number> = {
    not_configured: 0,
    ready_to_run: 0,
    running: 0,
    needs_review: 0,
    ready_to_send: 0,
    sent: 0,
  };
  for (const row of rows) counts[pipelineStage(row)] += 1;
  return counts;
}

export function averageNamedScore(rows: CommandRow[]) {
  const scored = rows.filter((row) => row.latestReport?.scoreMentioned != null);
  if (scored.length === 0) return null;
  const total = scored.reduce((sum, row) => sum + (row.latestReport?.scoreMentioned ?? 0), 0);
  return Math.round((total / scored.length) * 10) / 10;
}

export function agencyRoi(args: {
  brands: number;
  reportsGenerated: number;
  reportsSent: number;
  opportunities: number;
}) {
  return {
    ...args,
    hoursSaved: args.reportsGenerated * 2,
  };
}

export function suggestedClientEmail(args: {
  brandName: string;
  summary: string | null;
  scoreMentioned: number | null;
  scoreRecommended: number | null;
  scoreTotal: number;
}) {
  const named =
    args.scoreMentioned == null ? "" : `Named in ${args.scoreMentioned} of ${args.scoreTotal} buyer questions.`;
  const rec =
    args.scoreRecommended == null ? "" : ` Recommended in ${args.scoreRecommended} of ${args.scoreTotal}.`;
  const body = args.summary?.trim() || "This week’s AI-search report is ready.";
  return `This week’s AI-search report for ${args.brandName} is ready.\n\n${body}\n\n${named}${rec}`.trim();
}

export const HOURS_SAVED_PER_REPORT = 2;
