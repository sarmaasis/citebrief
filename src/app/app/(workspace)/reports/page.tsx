import { ReportsQueue } from "@/components/app/bulk-report-actions";
import { EmptyState } from "@/components/app/empty-state";
import { PipelineStrip } from "@/components/app/pipeline-strip";
import { PortfolioExport } from "@/components/app/portfolio-export";
import { PortfolioFilters } from "@/components/app/portfolio-filters";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { pageFilters, pipelineCounts } from "@/lib/command-center";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildCommandCenterSnapshot, loadCommandRows } from "@/server/command-center-data";

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
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-3 text-sm text-cb-muted">Pipeline and Friday send queue are on Agency.</p>
        <div className="mt-6">
          <UpgradePrompt
            title={UPGRADE_COPY.weeklyStarter.title}
            body={UPGRADE_COPY.weeklyStarter.body}
            cta={UPGRADE_COPY.weeklyStarter.cta}
          />
        </div>
      </div>
    );
  }

  const filters = pageFilters(params);
  const [{ rows: allRows }, snapshot] = await Promise.all([
    loadCommandRows(ctx, ent.allowsWeeklyCadence),
    buildCommandCenterSnapshot(ctx, ent, filters),
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
          <p className="mt-1 text-sm text-cb-muted">Pipeline and send queue for this workspace.</p>
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
    </div>
  );
}
