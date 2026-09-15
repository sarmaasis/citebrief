import Link from "next/link";
import { RiskPill } from "@/components/app/risk-pill";
import { ScoreChange } from "@/components/app/score-change";
import type { ScorecardMetrics } from "@/lib/dashboard-metrics";
import { formatShortDate } from "@/lib/friday";
import { cn } from "@/lib/utils";

const HEALTH_LABEL: Record<ScorecardMetrics["health"], string> = {
  healthy: "Healthy",
  needs_attention: "Needs attention",
  at_risk: "At risk",
  new_data_pending: "New data pending",
  run_failed: "Run failed",
};

export function BrandScorecard({ card }: { card: ScorecardMetrics }) {
  return (
    <article className="flex min-w-0 flex-col rounded-cb-card border border-cb-line bg-cb-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/app/brands/${card.brandId}`}
            className="truncate text-sm font-medium text-cb-text hover:text-cb-accent"
          >
            {card.brandName}
          </Link>
          <p className="mt-1 truncate text-xs text-cb-muted">
            {card.siteUrl || "No site"}
            {card.market ? ` · ${card.market}` : ""}
            {card.clientOwner ? ` · ${card.clientOwner}` : ""}
          </p>
        </div>
        <RiskPill risk={card.risk} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-cb-muted">AI visibility</p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-cb-accent">
            {card.visibilityScore == null ? "—" : `${card.visibilityScore}`}
          </p>
        </div>
        <ScoreChange delta={card.mentionedDelta} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <Stat
          label="Presence / citation"
          value={`${card.mentionShare ?? "—"}% / ${card.citationShare ?? "—"}%`}
        />
        <Stat
          label="Prominence gap"
          value={
            card.competitorGap != null
              ? `${card.competitorGap}%${card.competitorLeader ? ` · ${card.competitorLeader}` : ""}`
              : "Even"
          }
        />
        <Stat label="Prompts won / lost" value={`${card.winningPrompts} / ${card.losingPrompts}`} />
        <Stat label="Portrayal actions" value={String(card.openOpportunities)} />
        <Stat
          label="Last run"
          value={
            card.lastRunAt
              ? `${card.lastRunStatus || "done"} · ${formatShortDate(new Date(card.lastRunAt))}`
              : "Never"
          }
        />
        <Stat
          label="Next"
          value={card.nextScheduledRunAt ? formatShortDate(new Date(card.nextScheduledRunAt)) : "On demand"}
        />
      </dl>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-cb-line pt-3">
        <p className={cn("text-xs", card.health === "at_risk" || card.health === "run_failed" ? "text-cb-missing" : "text-cb-muted")}>
          {HEALTH_LABEL[card.health]}
        </p>
        <p className="text-xs text-cb-muted">
          {card.promptCount} prompts · {card.enginesMonitored} engines
        </p>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-cb-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-cb-text">{value}</dd>
    </div>
  );
}
