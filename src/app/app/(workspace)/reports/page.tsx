import { ReportsQueue } from "@/components/app/bulk-report-actions";
import { ClientReportingCenter } from "@/components/app/client-reporting-center";
import { EmptyState } from "@/components/app/empty-state";
import { LockedModule } from "@/components/app/locked-module";
import { PipelineStrip } from "@/components/app/pipeline-strip";
import { PortfolioExport } from "@/components/app/portfolio-export";
import { PortfolioFilters } from "@/components/app/portfolio-filters";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { pageFilters, pipelineCounts } from "@/lib/command-center";
import { dashboardModulesForPlan } from "@/lib/dashboard-metrics";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildCommandCenterSnapshot, loadCommandRows } from "@/server/command-center-data";
import { buildClientReportingCenter } from "@/server/dashboard-data";

export default async function ReportsPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{
    stage?: string;
    pipeline?: string;
    owner?: string;
    risk?: string;
    brand?: string;
    brandId?: string;
    sent?: string;
  }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return <EmptyState line="Sign in to see the send queue." cta="Sign in" href="/login" />;
  }
  const params = await searchParams;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  if (!ent.allowsWeeklySendQueue) {
    return (
      <LockedModule
        title="Reports"
        line={
          ent.trialing
            ? "Trial includes one report on the brand page. Agency unlocks the Friday send queue and pipeline."
            : "Pipeline and Friday send queue are on Agency."
        }
        upgradeTitle={UPGRADE_COPY.commandCenter.title}
        upgradeBody={UPGRADE_COPY.commandCenter.body}
        upgradeCta={UPGRADE_COPY.commandCenter.cta}
      />
    );
  }

  const filters = pageFilters(params);
  const modules = dashboardModulesForPlan(ent);
  const [{ rows: allRows }, snapshot, reportingRows] = await Promise.all([
    loadCommandRows(ctx, ent.allowsWeeklyCadence),
    buildCommandCenterSnapshot(ctx, ent, filters),
    modules.clientReportingCenter ? buildClientReportingCenter(ctx, ent) : Promise.resolve([]),
  ]);
  if (allRows.length === 0) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Reports</h1>
        <EmptyState title="No brands yet" line="Start the first Friday report." cta="Add a brand" href="/app/onboarding" />
      </div>
    );
  }

  const owners = [...new Set(allRows.map((row) => row.brand.clientOwner).filter((value): value is string => Boolean(value)))].sort();
  const brands = allRows.map((row) => ({ id: row.brand.id, name: row.brand.name }));
  const activeStage = filters.pipeline ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-cb-muted">
            Pipeline, send queue, and client reporting center for this workspace.
          </p>
        </div>
        {ent.allowsPortfolioExport ? <PortfolioExport /> : null}
      </div>
      <div className="mt-6">
        <PipelineStrip pipeline={pipelineCounts(allRows)} active={activeStage} keep={params} />
      </div>
      <div className="mt-6">
        <PortfolioFilters
          fields={["stage", "owner", "risk", "brandId", "sent"]}
          owners={owners}
          brands={brands}
        />
      </div>
      <div className="mt-8">
        <ReportsQueue
          allowsBulkSend={ent.allowsBulkSend}
          allowsEmailSend={ent.allowsEmailSend}
          rows={snapshot.rows.map((row) => ({
            brandId: row.brand.id,
            brandName: row.brand.name,
            reportId: row.latestReport?.id ?? null,
            pipeline: row.pipeline,
            actionVerb: row.action?.verb ?? "Open",
            actionHref: row.action?.href ?? `/app/brands/${row.brand.id}`,
          }))}
        />
      </div>

      {modules.clientReportingCenter ? (
        <section className="mt-12">
          <h2 className="mb-3 text-sm font-medium">Client reporting center</h2>
          <p className="mb-4 text-sm text-cb-muted">
            Monthly summary, before/after movement, notes, and completed actions for client calls.
          </p>
          <ClientReportingCenter rows={reportingRows} />
        </section>
      ) : null}
    </div>
  );
}
