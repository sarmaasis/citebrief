import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MomChart } from "@/components/history/mom-chart";
import { Button } from "@/components/ui/button";
import { getAppContext } from "@/lib/session";
import { getWorkspaceBrand } from "@/server/workspace-data";
import { reports, runRows, runs } from "@/db/schema";

export default async function BrandHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) notFound();
  const { id } = await params;
  const brand = await getWorkspaceBrand(ctx, id);
  if (!brand) notFound();

  const reportRows = await ctx.db
    .select({ report: reports, run: runs })
    .from(reports)
    .innerJoin(runs, eq(runs.id, reports.runId))
    .where(eq(reports.brandId, id))
    .orderBy(desc(reports.createdAt))
    .limit(24);

  const chartData = [...reportRows]
    .reverse()
    .map(({ report, run }) => ({
      period: run.periodStart || report.createdAt.toISOString().slice(0, 10),
      mentioned: report.scoreMentioned ?? 0,
    }));

  // Who-won basics from latest run rows
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
          <p className="mt-2 text-sm text-cb-muted">Month-over-month mentioned score and who won.</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/app/brands/${id}`}>Back to brand</Link>
        </Button>
      </div>

      <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <p className="text-xs text-cb-muted">Mentioned score</p>
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

      <div className="rounded-cb-card border border-cb-line bg-cb-surface">
        <div className="border-b border-cb-line px-5 py-3 text-xs text-cb-muted">All PDFs</div>
        <ul>
          {reportRows.length === 0 ? (
            <li className="px-5 py-6 text-sm text-cb-muted">No reports for this period yet.</li>
          ) : (
            reportRows.map(({ report, run }) => (
              <li key={report.id} className="flex h-12 items-center justify-between border-b border-cb-line px-5 last:border-0">
                <span className="text-sm">
                  Week of {run.periodStart || "-"} · {report.scoreMentioned ?? "-"}/{report.scoreTotal}
                </span>
                <Link href={`/app/brands/${id}/reports/${report.id}`} className="text-sm text-cb-accent">
                  Open report
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
