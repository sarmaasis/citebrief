import Link from "next/link";
import type { ClientReportingSummary } from "@/lib/dashboard-metrics";

export function ClientReportingCenter({ rows }: { rows: ClientReportingSummary[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-cb-muted">
        Monthly summaries appear after the first sent-ready report. Run a brand, then open its PDF.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {rows.map((row) => (
        <article key={row.brandId} className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.brandName}</p>
              <p className="mt-1 text-xs text-cb-muted">Period {row.periodLabel}</p>
            </div>
            {row.latestReportId ? (
              <Link
                href={`/app/brands/${row.brandId}/reports/${row.latestReportId}`}
                className="text-sm text-cb-accent"
              >
                Open report
              </Link>
            ) : null}
          </div>

          <section className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Monthly summary</h3>
            <ul className="mt-2 space-y-1 text-sm text-cb-text">
              {row.monthlySummary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Before / after</h3>
              <p className="mt-2 font-mono text-sm tabular-nums">
                Named {row.beforeAfter.previousNamed ?? "—"} → {row.beforeAfter.currentNamed ?? "—"}
                {row.beforeAfter.namedDelta != null
                  ? ` (${row.beforeAfter.namedDelta > 0 ? "+" : ""}${row.beforeAfter.namedDelta})`
                  : ""}
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-cb-muted">
                Rec {row.beforeAfter.previousRecommended ?? "—"} → {row.beforeAfter.currentRecommended ?? "—"}
                {row.beforeAfter.recommendedDelta != null
                  ? ` (${row.beforeAfter.recommendedDelta > 0 ? "+" : ""}${row.beforeAfter.recommendedDelta})`
                  : ""}
              </p>
              <p className="mt-2 text-xs capitalize text-cb-muted">{row.beforeAfter.movementLabel}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-cb-muted">What changed</h3>
              {row.beforeAfter.whatImproved.length ? (
                <p className="mt-2 text-sm text-cb-text">
                  Improved: {row.beforeAfter.whatImproved.join("; ")}
                </p>
              ) : null}
              {row.beforeAfter.whatDeclined.length ? (
                <p className="mt-1 text-sm text-cb-muted">
                  Declined: {row.beforeAfter.whatDeclined.join("; ")}
                </p>
              ) : null}
              {!row.beforeAfter.whatImproved.length && !row.beforeAfter.whatDeclined.length ? (
                <p className="mt-2 text-sm text-cb-muted">No prior report to compare yet.</p>
              ) : null}
              {row.competitorLeader ? (
                <p className="mt-2 text-sm text-cb-muted">Competitor leading: {row.competitorLeader}</p>
              ) : null}
            </div>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Notes & recommendations</h3>
              {row.recommendedActions.length ? (
                <ul className="mt-2 space-y-1 text-sm text-cb-text">
                  {row.recommendedActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-cb-muted">No open recommendations this period.</p>
              )}
              {row.clientNotes ? <p className="mt-2 text-sm text-cb-muted">{row.clientNotes}</p> : null}
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Completed since last report</h3>
              {row.completedSinceLastReport.length ? (
                <ul className="mt-2 space-y-1 text-sm text-cb-text">
                  {row.completedSinceLastReport.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-cb-muted">Mark opportunities done to track progress here.</p>
              )}
            </div>
          </section>
        </article>
      ))}
    </div>
  );
}
