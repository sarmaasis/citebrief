import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReportViewer } from "@/components/reports/report-viewer";
import { getReportObject } from "@/lib/r2";
import { getAppContext } from "@/lib/session";
import { brands, reports, runs } from "@/db/schema";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }
  const { id, reportId } = await params;

  const [row] = await ctx.db
    .select({
      report: reports,
      brand: brands,
      run: runs,
    })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .innerJoin(runs, eq(runs.id, reports.runId))
    .where(
      and(
        eq(reports.id, reportId),
        eq(brands.id, id),
        eq(brands.workspaceId, ctx.workspace.id),
      ),
    )
    .limit(1);

  if (!row) {
    notFound();
  }

  let html: string | null = null;
  if (row.report.htmlKey) {
    try {
      const { env } = await getCloudflareContext({ async: true });
      const bytes = await getReportObject(env, row.report.htmlKey);
      if (bytes) {
        html = new TextDecoder().decode(bytes);
      }
    } catch {
      html = null;
    }
  }

  return (
    <ReportViewer
      brandId={id}
      brandName={row.brand.name}
      reportId={row.report.id}
      period={row.run.periodStart}
      scoreMentioned={row.report.scoreMentioned}
      scoreTotal={row.report.scoreTotal}
      summary={row.report.summary}
      html={html}
      shareToken={row.report.shareToken}
      partial={row.run.status === "partial"}
    />
  );
}
