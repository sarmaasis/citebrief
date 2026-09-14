export type PipelineStage =
  | "not_configured"
  | "ready_to_run"
  | "running"
  | "needs_review"
  | "ready_to_send"
  | "sent";
export type ClientRisk = "stable" | "watch" | "at_risk";
export type OpportunityKey =
  | "geo_package"
  | "comparison_page"
  | "source_refresh"
  | "pr_placement"
  | "technical_seo";
export type OpportunityValue = "Small" | "Medium" | "High";

export type CommandRow = {
  promptCount: number;
  mentionedDelta: number | null;
  competitorLeadShare?: number | null;
  competitorLeadCount?: number | null;
  competitorLeader?: string | null;
  sendOverdue?: boolean;
  missingSources?: boolean;
  latestRun: { status: string } | null;
  latestReport: {
    id: string;
    sentAt: Date | string | null;
    createdAt?: Date | string | null;
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
  ready_to_send: "Approved",
  sent: "Sent",
};

export const RISK_LABEL: Record<ClientRisk, string> = {
  stable: "Stable",
  watch: "Watch",
  at_risk: "At risk",
};

/** PRODUCT §18.2.1: owners may set 45–90 minutes saved per generated report. */
export const MINUTES_SAVED_MIN = 45;
export const MINUTES_SAVED_MAX = 90;
export const MINUTES_SAVED_DEFAULT = 60;
export const HOURS_SAVED_PER_REPORT = MINUTES_SAVED_DEFAULT / 60;

export function clampMinutesSaved(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MINUTES_SAVED_DEFAULT;
  return Math.min(MINUTES_SAVED_MAX, Math.max(MINUTES_SAVED_MIN, Math.round(n)));
}

export function pipelineStage(row: CommandRow): PipelineStage {
  if (row.promptCount === 0) return "not_configured";
  const status = row.latestRun?.status;
  if (status === "queued" || status === "running") return "running";
  if (row.latestReport?.sentAt) return "sent";
  if (!row.latestReport) return "ready_to_run";
  if (row.latestReport.approvalState === "approved") return "ready_to_send";
  return "needs_review";
}

function namesMatch(a: string, b: string) {
  const left = a.toLowerCase().trim();
  const right = b.toLowerCase().trim();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function previousNamed(row: CommandRow) {
  const named = row.latestReport?.scoreMentioned;
  if (named == null || row.mentionedDelta == null) return null;
  return named - row.mentionedDelta;
}

export function dropShare(row: CommandRow) {
  const prev = previousNamed(row);
  const named = row.latestReport?.scoreMentioned;
  if (prev == null || prev <= 0 || named == null) return null;
  return (prev - named) / prev;
}

export function competitorSignalsFromRows(
  brandName: string,
  rows: {
    promptId: string;
    whoWon?: string | null;
    citedUrls?: string | null;
    citedBrandUrl?: boolean | null;
  }[],
): {
  competitorLeadShare: number | null;
  competitorLeadCount: number;
  competitorLeader: string | null;
  missingSources: boolean;
} {
  if (rows.length === 0) {
    return { competitorLeadShare: null, competitorLeadCount: 0, competitorLeader: null, missingSources: false };
  }

  const byPrompt = new Map<string, { winner: string | null; cited: boolean }>();
  for (const row of rows) {
    const current = byPrompt.get(row.promptId) ?? { winner: null, cited: false };
    const won = row.whoWon?.trim() || null;
    if (won && !namesMatch(won, brandName)) {
      current.winner = won;
    } else if (won && !current.winner) {
      current.winner = won;
    }
    const cited =
      Boolean(row.citedBrandUrl) ||
      Boolean(row.citedUrls && row.citedUrls !== "[]" && row.citedUrls.trim() !== "");
    if (cited) current.cited = true;
    byPrompt.set(row.promptId, current);
  }

  const prompts = [...byPrompt.values()];
  const competitorWins = prompts.filter((item) => item.winner && !namesMatch(item.winner, brandName));
  const leaderCounts = new Map<string, number>();
  for (const item of competitorWins) {
    const name = item.winner as string;
    leaderCounts.set(name, (leaderCounts.get(name) ?? 0) + 1);
  }
  const leader = [...leaderCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const noCite = rows.filter((row) => !row.citedBrandUrl && (!row.citedUrls || row.citedUrls === "[]")).length;

  return {
    competitorLeadShare: prompts.length ? competitorWins.length / prompts.length : null,
    competitorLeadCount: competitorWins.length,
    competitorLeader: leader,
    missingSources: rows.length > 0 && noCite / rows.length >= 0.5,
  };
}

export function clientRisk(row: CommandRow): ClientRisk {
  if (row.latestRun?.status === "failed") return "at_risk";
  const rec = row.latestReport?.scoreRecommended;
  if (row.latestReport && rec === 0) return "at_risk";
  const drop = dropShare(row);
  if (drop != null && drop >= 0.25) return "at_risk";
  if (row.sendOverdue) return "at_risk";
  if (row.competitorLeadShare != null && row.competitorLeadShare >= 0.5) return "at_risk";

  if (row.latestRun?.status === "partial") return "watch";
  if (drop != null && drop >= 0.1) return "watch";
  if (row.missingSources) return "watch";
  const named = row.latestReport?.scoreMentioned;
  if (named != null && named > 0 && rec != null && rec < named * 0.5) return "watch";
  if (row.promptCount === 0) return "watch";
  if (!row.latestReport) return "watch";
  if (row.latestReport && !row.latestReport.sentAt) return "watch";
  return "stable";
}

export function riskWhy(row: CommandRow): string {
  const named = row.latestReport?.scoreMentioned;
  const rec = row.latestReport?.scoreRecommended;
  const total = row.latestReport?.scoreTotal ?? 20;
  const prev = previousNamed(row);
  const drop = dropShare(row);
  if (row.latestRun?.status === "failed") return "Report failed.";
  if (row.latestReport && rec === 0) return "No recommendations this week.";
  if (drop != null && drop >= 0.1 && prev != null && named != null) {
    return `Dropped from ${prev}/${total} to ${named}/${total} named.`;
  }
  if (row.competitorLeadCount != null && row.competitorLeadCount > 0 && (row.competitorLeadShare ?? 0) >= 0.5) {
    return `Competitor leads ${row.competitorLeadCount} buyer questions.`;
  }
  if (row.sendOverdue || (row.latestReport && !row.latestReport.sentAt)) return "Report ready but not sent.";
  if (row.latestRun?.status === "partial") return "Partial report — some sources missed.";
  if (row.missingSources) return "Missing sources on most answers.";
  if (named != null && rec != null && named > 0 && rec < named * 0.5) {
    return "Named but rarely recommended.";
  }
  if (row.promptCount === 0) return "No question set yet.";
  if (!row.latestReport) return "No report this period.";
  return "Needs attention.";
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
      reason: "No question set yet",
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
  if (status === "partial" && row.latestReport) {
    return {
      brandId,
      brandName,
      verb: "Review report",
      reason: "Partial report — some sources missed",
      href: `/app/brands/${brandId}/reports/${row.latestReport.id}`,
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
      verb: approved ? "Send report" : "Approve report",
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
  if (clientRisk(row) === "at_risk") {
    return {
      brandId,
      brandName,
      verb: "Follow up",
      reason: riskWhy(row),
      href: `/app/brands/${brandId}/reports/${row.latestReport.id}`,
    };
  }
  const opportunity = opportunityFromRow({ ...row, brand: row.brand });
  if (opportunity) {
    return {
      brandId,
      brandName,
      verb: "Create recommendation",
      reason: opportunity.reason,
      href: opportunity.href,
    };
  }
  return null;
}

export function opportunityFromRow(row: CommandRow & { brand: { id: string; name: string } }): {
  client: string;
  brandId: string;
  reportId: string | null;
  key: OpportunityKey;
  type: string;
  reason: string;
  evidence: string;
  service: string;
  wording: string;
  value: OpportunityValue;
  href: string;
} | null {
  const href = row.latestReport
    ? `/app/brands/${row.brand.id}/reports/${row.latestReport.id}`
    : `/app/brands/${row.brand.id}`;
  const named = row.latestReport?.scoreMentioned;
  const rec = row.latestReport?.scoreRecommended;
  const total = row.latestReport?.scoreTotal ?? 20;
  const base = {
    client: row.brand.name,
    brandId: row.brand.id,
    reportId: row.latestReport?.id ?? null,
    href,
  };
  if (row.latestReport && named === 0) {
    return {
      ...base,
      key: "geo_package",
      type: "Own the category answers AI still skips",
      reason: `${row.brand.name} is invisible on high-intent buyer questions — named in 0 of ${total}. Until category and “best for” pages exist, engines will keep recommending someone else.`,
      evidence: `Named in 0 of ${total} buyer questions.`,
      service: "Ship a GEO content package: category, best-for, and comparison pages this month",
      wording: `${row.brand.name} has zero presence on the buyer questions that drive shortlists. A focused GEO package — category positioning, best-for landers, and comparison pages — is the retainer conversation this week.`,
      value: "High",
    };
  }
  if (row.competitorLeadShare != null && row.competitorLeadShare >= 0.5 && row.competitorLeadCount) {
    const leader = row.competitorLeader?.trim() || "a competitor";
    return {
      ...base,
      key: "pr_placement",
      type: `Displace ${leader} as the default shortlist pick`,
      reason: `${leader} leads ${row.competitorLeadCount} of ${total} buyer questions (${Math.round(row.competitorLeadShare * 100)}%). Impact: AI is training buyers on their narrative before yours. Effort: PR and third-party citations, not just on-site edits.`,
      evidence: `Competitor leads ${row.competitorLeadCount} of ${total} buyer questions. ${leader} is winning the shortlist.`,
      service: `Prioritize review, listing, and citation placements that name ${row.brand.name} alongside or ahead of ${leader}`,
      wording: `${row.brand.name} loses high-intent questions because third-party sources surface ${leader} first. A citation and review push — not another homepage tweak — is the next client conversation.`,
      value: "High",
    };
  }
  if (named != null && named > 0 && (rec == null || rec < named)) {
    const gap = named - (rec ?? 0);
    const leader = row.competitorLeader?.trim();
    return {
      ...base,
      key: "comparison_page",
      type: leader
        ? `Close the shortlist gap vs ${leader}`
        : "Win the recommendation, not just the mention",
      reason: `Named in ${named}/${total} but recommended in only ${rec ?? 0}/${total} (gap ${gap}). Impact: buyers see you, then choose someone else. Effort: one clear comparison/alternatives page usually moves this.`,
      evidence: `Named in ${named}/${total}, recommended in ${rec ?? "—"}/${total}.`,
      service: leader
        ? `Publish a ${row.brand.name} vs ${leader} comparison (and alternatives) page`
        : "Publish a comparison / alternatives page that states when you win",
      wording: `${row.brand.name} is in the answer set, but ${leader || "a competitor"} still wins the shortlist. A decisive comparison page is the highest-leverage content move before the next Friday send.`,
      value: gap >= 5 ? "High" : "Medium",
    };
  }
  if (row.mentionedDelta != null && row.mentionedDelta < 0) {
    const drop = Math.abs(row.mentionedDelta);
    return {
      ...base,
      key: "source_refresh",
      type: `Recover ${drop} lost named answer${drop === 1 ? "" : "s"}`,
      reason: `Named score dropped ${drop} vs the prior report. Impact: momentum is going the wrong way into the next client send. Effort: refresh the pages engines already cite before inventing new content.`,
      evidence: `Named score dropped ${drop} versus the last report.`,
      service: "Refresh source-worthy pages AI already cites (proof, pricing clarity, freshness)",
      wording: `Visibility slipped this period. Before pitching net-new pages, refresh the URLs AI already cites so named answers rebound before the next Friday send.`,
      value: drop >= 5 ? "High" : "Medium",
    };
  }
  if (row.missingSources && row.latestReport) {
    return {
      ...base,
      key: "technical_seo",
      type: "Make cited pages quoteable",
      reason: `${row.brand.name} appears in answers without source URLs. Impact: mentions without citations are fragile — engines cannot defend the pick. Effort: crawlability, schema, and clear page entities beat a full redesign.`,
      evidence: "Most engine answers are missing source URLs.",
      service: "Technical SEO cleanup so AI can cite homepage, product, and proof pages",
      wording: `${row.brand.name} is discoverable in answers but pages are not being cited. Clean up source pages so AI can quote them with confidence.`,
      value: "Small",
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
  minutesPerReport?: number;
}) {
  const minutesPerReport = clampMinutesSaved(args.minutesPerReport ?? MINUTES_SAVED_DEFAULT);
  return {
    ...args,
    minutesPerReport,
    hoursSaved: Math.round(args.reportsGenerated * (minutesPerReport / 60) * 10) / 10,
    extraRevenueConversations: args.opportunities,
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

export type CommandCenterFilters = {
  owner?: string | null;
  risk?: ClientRisk | string | null;
  pipeline?: PipelineStage | string | null;
  brandId?: string | null;
  sent?: string | null;
  opportunityType?: string | null;
};

export function pageFilters(params: {
  stage?: string;
  pipeline?: string;
  owner?: string;
  risk?: string;
  brand?: string;
  brandId?: string;
  sent?: string;
  opportunityType?: string;
}): CommandCenterFilters {
  return {
    owner: params.owner || null,
    risk: params.risk || null,
    pipeline: params.stage || params.pipeline || null,
    brandId: params.brandId || params.brand || null,
    sent: params.sent || null,
    opportunityType: params.opportunityType || null,
  };
}

export function filterCommandRows<
  T extends CommandRow & { brand: { id: string; name: string; clientOwner?: string | null } },
>(rows: T[], filters: CommandCenterFilters): T[] {
  return rows.filter((row) => {
    if (filters.brandId && row.brand.id !== filters.brandId) return false;
    if (filters.owner && (row.brand.clientOwner || "") !== filters.owner) return false;
    if (filters.risk && clientRisk(row) !== filters.risk) return false;
    if (filters.pipeline && pipelineStage(row) !== filters.pipeline) return false;
    if (filters.sent === "1" && !row.latestReport?.sentAt) return false;
    if (filters.sent === "0" && row.latestReport?.sentAt) return false;
    if (filters.opportunityType) {
      const opportunity = opportunityFromRow(row);
      if (!opportunity || opportunity.key !== filters.opportunityType) return false;
    }
    return true;
  });
}

export function commandCenterCsv(rows: Array<CommandRow & { brand: { id: string; name: string; clientOwner?: string | null } }>) {
  const header = [
    "brand",
    "owner",
    "named",
    "recommended",
    "competitor",
    "risk",
    "why",
    "pipeline",
    "sent",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const named = row.latestReport?.scoreMentioned ?? "";
    const rec = row.latestReport?.scoreRecommended ?? "";
    const cells = [
      row.brand.name,
      row.brand.clientOwner ?? "",
      String(named),
      String(rec),
      row.competitorLeader ?? "",
      clientRisk(row),
      riskWhy(row),
      pipelineStage(row),
      row.latestReport?.sentAt ? "1" : "0",
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}
