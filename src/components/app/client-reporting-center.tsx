import Link from "next/link";
import type { ClientReportingSummary } from "@/lib/dashboard-metrics";

export function ClientReportingCenter({ rows }: { rows: ClientReportingSummary[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-cb-card border border-dashed border-cb-line bg-cb-surface px-6 py-10 text-center">
        <p className="text-sm font-medium text-cb-text">No client summaries yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-cb-muted">
          After the first Friday report is ready, this center becomes the print-friendly brief for client calls —
          movement, competitors, and recommended actions in one place.
        </p>
        <Link href="/app/brands" className="mt-4 inline-block text-sm text-cb-accent">
          Open brands to run a report
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 print:gap-8">
      {rows.map((row) => (
        <article
          key={row.brandId}
          className="rounded-cb-card border border-cb-line bg-cb-surface p-6 print:break-inside-avoid print:border-cb-text/20"
        >
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-cb-line pb-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.12em] text-cb-muted">Client brief</p>
              <h3 className="mt-1 text-xl font-medium tracking-tight text-cb-text">{row.brandName}</h3>
              <p className="mt-1 text-sm text-cb-muted">Period {row.periodLabel}</p>
            </div>
            {row.latestReportId ? (
              <Link
                href={`/app/brands/${row.brandId}/reports/${row.latestReportId}`}
                className="text-sm text-cb-accent print:hidden"
              >
                Open full report
              </Link>
            ) : null}
          </header>

          <section className="mt-5">
            <h4 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Executive summary</h4>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-cb-text">
              {row.monthlySummary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="mt-6 grid gap-6 border-t border-cb-line pt-5 sm:grid-cols-[1fr_1.2fr]">
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Before → after</h4>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs text-cb-muted">Named</p>
                  <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight text-cb-text">
                    {row.beforeAfter.previousNamed ?? "—"}
                    <span className="mx-2 text-base text-cb-muted">→</span>
                    {row.beforeAfter.currentNamed ?? "—"}
                    {row.beforeAfter.namedDelta != null ? (
                      <span className="ml-2 text-sm text-cb-muted">
                        ({row.beforeAfter.namedDelta > 0 ? "+" : ""}
                        {row.beforeAfter.namedDelta})
                      </span>
                    ) : null}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-cb-muted">Recommended</p>
                  <p className="mt-1 font-mono text-lg tabular-nums text-cb-text">
                    {row.beforeAfter.previousRecommended ?? "—"}
                    <span className="mx-2 text-sm text-cb-muted">→</span>
                    {row.beforeAfter.currentRecommended ?? "—"}
                    {row.beforeAfter.recommendedDelta != null ? (
                      <span className="ml-2 text-sm text-cb-muted">
                        ({row.beforeAfter.recommendedDelta > 0 ? "+" : ""}
                        {row.beforeAfter.recommendedDelta})
                      </span>
                    ) : null}
                  </p>
                </div>
                <p className="text-xs capitalize text-cb-muted">Trend: {row.beforeAfter.movementLabel}</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-cb-muted">What changed</h4>
              {row.beforeAfter.whatImproved.length ? (
                <p className="mt-3 text-sm text-cb-text">
                  <span className="font-medium">Improved — </span>
                  {row.beforeAfter.whatImproved.join("; ")}
                </p>
              ) : null}
              {row.beforeAfter.whatDeclined.length ? (
                <p className="mt-2 text-sm text-cb-muted">
                  <span className="font-medium text-cb-text">Declined — </span>
                  {row.beforeAfter.whatDeclined.join("; ")}
                </p>
              ) : null}
              {!row.beforeAfter.whatImproved.length && !row.beforeAfter.whatDeclined.length ? (
                <p className="mt-3 text-sm text-cb-muted">No prior report to compare yet.</p>
              ) : null}
              {row.competitorLeader ? (
                <p className="mt-3 border-l-2 border-cb-line pl-3 text-sm text-cb-text">
                  Competitor leading buyer questions: <span className="font-medium">{row.competitorLeader}</span>
                </p>
              ) : null}
            </div>
          </section>

          <section className="mt-6 grid gap-6 border-t border-cb-line pt-5 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Notes & recommendations</h4>
              {row.recommendedActions.length ? (
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-cb-text">
                  {row.recommendedActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-cb-muted">No open recommendations this period.</p>
              )}
              {row.clientNotes ? (
                <p className="mt-4 rounded-cb-control bg-cb-muted-bg px-3 py-2 text-sm text-cb-muted">{row.clientNotes}</p>
              ) : null}
            </div>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Completed since last report</h4>
              {row.completedSinceLastReport.length ? (
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-cb-text">
                  {row.completedSinceLastReport.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-cb-muted">Mark opportunities done to track progress here.</p>
              )}
            </div>
          </section>
        </article>
      ))}
    </div>
  );
}
