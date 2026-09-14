import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { HistoryExport } from "@/components/history/history-export";
import { MomChart } from "@/components/history/mom-chart";
import { Button } from "@/components/ui/button";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { getWorkspaceBrand, recommendedCountsForRuns } from "@/server/workspace-data";
import { reports, runRows, runs } from "@/db/schema";

export default async function BrandHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) notFound();
  const { id } = await params;
  const brand = await getWorkspaceBrand(ctx, id);
  if (!brand) notFound();

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const allowsHistory = workspaceEntitlements(sub).allowsHistory;

  const reportRows = await ctx.db
    .select({ report: reports, run: runs })
    .from(reports)
    .innerJoin(runs, eq(runs.id, reports.runId))
    .where(eq(reports.brandId, id))
    .orderBy(desc(reports.createdAt))
    .limit(24);

  const recommended = await recommendedCountsForRuns(
    ctx,
    reportRows.map(({ run }) => run.id),
  );

  const chartData = [...reportRows].reverse().map(({ report, run }) => ({
    period: run.periodStart || report.createdAt.toISOString().slice(0, 10),
    mentioned: report.scoreMentioned ?? 0,
    recommended: report.scoreRecommended ?? recommended[run.id] ?? 0,
  }));

  const latestRunId = reportRows[0]?.run.id;
  const whoWonCounts: Record<string, number> = {};
  if (latestRunId) {
    const rows = await ctx.db.select().from(runRows).where(eq(runRows.runId, latestRunId));
    for (const row of rows) {
      if (!row.whoWon) continue;
      whoWonCounts[row.whoWon] = (whoWonCounts[row.whoWon] || 0) + 1;
    }
  }
  const whoWonSorted = Object.entries(whoWonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{brand.name} history</h1>
          <p className="mt-2 text-sm text-cb-muted">Month-over-month named and recommended scores, and who won.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {allowsHistory && reportRows.length > 0 ? (
            <HistoryExport brandId={id} brandName={brand.name} />
          ) : null}
          <Button asChild variant="outline">
            <Link href={`/app/brands/${id}`}>Back to brand</Link>
          </Button>
        </div>
      </div>

      {!allowsHistory ? (
        <div className="mb-8">
          <UpgradePrompt
            title="History and score trend are on Agency"
            body={UPGRADE_COPY.weeklyStarter.body}
            cta="Upgrade to Agency"
          />
        </div>
      ) : null}

      {allowsHistory ? (
        <>
          <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
            <p className="text-xs text-cb-muted">Named / recommended</p>
            <div className="mt-4">
              <MomChart data={chartData} />
            </div>
          </div>

          <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
            <p className="text-xs text-cb-muted">Who won (latest run)</p>
            {whoWonSorted.length === 0 ? (
              <p className="mt-3 text-sm text-cb-muted">No who-won data yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {whoWonSorted.map(([name, count]) => (
                  <li key={name} className="flex h-12 items-center justify-between border-b border-cb-line last:border-0">
                    <span>{name}</span>
                    <span className="font-mono tabular-nums text-cb-accent">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}

      <div className="rounded-cb-card border border-cb-line bg-cb-surface">
        <div className="border-b border-cb-line px-5 py-3 text-xs text-cb-muted">All PDFs</div>
        {reportRows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              line="No reports for this period yet."
              cta="Run a report"
              href={`/app/brands/${id}`}
            />
          </div>
        ) : (
          <ul>
            {reportRows.map(({ report, run }) => (
              <li
                key={report.id}
                className="flex h-12 items-center justify-between border-b border-cb-line px-5 last:border-0"
              >
                <span className="text-sm">
                  Week of {run.periodStart || "-"} · {report.scoreMentioned ?? "-"}/{report.scoreTotal}
                  {(report.scoreRecommended ?? recommended[run.id]) != null
                    ? ` · rec ${report.scoreRecommended ?? recommended[run.id]}`
                    : ""}
                  {report.shareOpenCount ? ` · ${report.shareOpenCount} opens` : ""}
                </span>
                <Link href={`/app/brands/${id}/reports/${report.id}`} className="text-sm text-cb-accent">
                  Open report
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
