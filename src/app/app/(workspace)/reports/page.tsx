import { ReportsQueue } from "@/components/app/bulk-report-actions";
import { ClientReportingCenterLoader } from "@/components/app/client-reporting-center-loader";
import { EmptyState } from "@/components/app/empty-state";
import { LockedModule } from "@/components/app/locked-module";
import { PageHeader } from "@/components/app/page-header";
import { PipelineStrip } from "@/components/app/pipeline-strip";
import { PortfolioExport } from "@/components/app/portfolio-export";
import { PortfolioFilters } from "@/components/app/portfolio-filters";
import { StudioBadge, StudioUpgradeHint } from "@/components/app/studio-badge";
import { PLANS } from "@/lib/billing";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { pageFilters, pipelineCounts } from "@/lib/command-center";
import { dashboardModulesForPlan } from "@/lib/dashboard-metrics";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildCommandCenterSnapshot } from "@/server/command-center-data";

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
        title="Briefs"
        line={
          ent.trialing
            ? `Trial includes one report on the brand page. ${PLANS.agency.name} unlocks the Friday send queue and pipeline.`
            : `Pipeline and Friday send queue are on ${PLANS.agency.name}.`
        }
        upgradeTitle={UPGRADE_COPY.commandCenter.title}
        upgradeBody={UPGRADE_COPY.commandCenter.body}
        upgradeCta={UPGRADE_COPY.commandCenter.cta}
      />
    );
  }

  const filters = pageFilters(params);
  const modules = dashboardModulesForPlan(ent);
  const snapshot = await buildCommandCenterSnapshot(ctx, ent, filters, { includeAllRows: true });
  const allRows = snapshot.allRows ?? [];
  if (allRows.length === 0) {
    return (
      <div>
        <PageHeader title="Briefs" subtitle="Friday send queue fills after the first client report." />
        <EmptyState title="No brands yet" line="The send queue and client reporting center fill after you add a brand and generate the first Friday report." cta="Add a brand" href="/app/onboarding" steps={["Add a brand", "Run a report", "Approve and send from this queue"]} />
      </div>
    );
  }

  const owners = [...new Set(allRows.map((row) => row.brand.clientOwner).filter((value): value is string => Boolean(value)))].sort();
  const brands = allRows.map((row) => ({ id: row.brand.id, name: row.brand.name }));
  const activeStage = filters.pipeline ?? null;

  return (
    <div>
      <PageHeader
        title="Briefs"
        subtitle="Pipeline, send queue, and client reporting center for this workspace."
        actions={ent.allowsPortfolioExport ? <PortfolioExport /> : null}
      />
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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Client reporting center</h2>
            {ent.allowsCustomSender ? <StudioBadge /> : null}
          </div>
          <p className="mb-4 text-sm text-cb-muted">
            Monthly summary, before/after movement, notes, and completed actions for client calls.
            {ent.allowsCustomSender
              ? ` ${PLANS.studio.name} custom sender applies after Domains DNS verification.`
              : ""}
          </p>
          <ClientReportingCenterLoader />
          {!ent.allowsCustomSender ? (
            <div className="mt-4">
              <StudioUpgradeHint
                title="Custom sender + white-label send path"
                body={`${PLANS.agency.name} already gets the reporting center. ${PLANS.studio.name} adds custom sender name/domain (Settings → Domains) so client-facing emails leave from your agency identity.`}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
