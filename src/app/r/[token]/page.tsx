import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brandKits, brands, reports, runs, workspaces } from "@/db/schema";
import { getReportObject } from "@/lib/r2";

export const dynamic = "force-dynamic";

export default async function ClientSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();

  const [row] = await db
    .select({
      report: reports,
      brand: brands,
      run: runs,
      workspace: workspaces,
    })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .innerJoin(runs, eq(runs.id, reports.runId))
    .innerJoin(workspaces, eq(workspaces.id, brands.workspaceId))
    .where(eq(reports.shareToken, token))
    .limit(1);

  if (!row) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Report not found</h1>
        <p className="mt-3 text-sm text-cb-muted">Ask your agency for a new client link.</p>
      </main>
    );
  }

  const expiresAt = row.report.shareExpiresAt
    ? new Date(row.report.shareExpiresAt).getTime()
    : null;
  const expired = expiresAt != null && expiresAt < new Date().getTime();
  if (expired) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">This client link expired</h1>
        <p className="mt-3 text-sm text-cb-muted">Ask your agency for a new one.</p>
      </main>
    );
  }

  const [kit] = await db.select().from(brandKits).where(eq(brandKits.workspaceId, row.workspace.id)).limit(1);
  const accent = kit?.accentColor || "#0B3D2E";
  const preparedBy = kit?.preparedBy || row.report.agencyName || row.workspace.name;

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
    <main className="min-h-screen bg-cb-bg">
      <header className="border-b border-cb-line bg-cb-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {kit?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={kit.logoUrl} alt="" className="h-6 object-contain" />
            ) : null}
            <div>
              <p className="text-sm font-medium" style={{ color: accent }}>
                {preparedBy}
              </p>
              <p className="text-xs text-cb-muted">
                {row.brand.name}
                {row.run.periodStart ? ` · Week of ${row.run.periodStart}` : ""}
              </p>
            </div>
          </div>
          <p className="font-mono text-sm tabular-nums" style={{ color: accent }}>
            {row.report.scoreMentioned ?? "-"}/{row.report.scoreTotal}
          </p>
        </div>
      </header>

      {row.run.status === "partial" ? (
        <div className="border-b border-cb-line bg-[#f6ead4] px-6 py-3 text-center text-sm text-cb-pending">
          3 of 4 engines returned. Numbers reflect available engines.
        </div>
      ) : null}

      <div className="mx-auto max-w-4xl px-6 py-8">
        {html ? (
          <iframe title="Client report" className="min-h-[80vh] w-full rounded-cb-card border border-cb-line bg-cb-surface" srcDoc={html} />
        ) : (
          <div className="rounded-cb-card border border-cb-line bg-cb-surface p-8">
            <p className="font-mono text-[28px] tabular-nums" style={{ color: accent }}>
              {row.report.scoreMentioned ?? "-"}/{row.report.scoreTotal}
            </p>
            <p className="mt-4 text-sm text-cb-text">{row.report.summary}</p>
            {kit?.footerText ? <p className="mt-8 text-xs text-cb-muted">{kit.footerText}</p> : null}
            <p className="mt-2 text-xs text-cb-muted">Prepared by {preparedBy}</p>
          </div>
        )}
      </div>
    </main>
  );
}
