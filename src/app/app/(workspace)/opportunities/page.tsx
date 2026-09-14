import Link from "next/link";
import { CopyRecommendation } from "@/components/app/copy-recommendation";
import { EmptyState } from "@/components/app/empty-state";
import { LockedModule } from "@/components/app/locked-module";
import { OpportunityStatusControl } from "@/components/app/opportunity-status";
import { PortfolioFilters } from "@/components/app/portfolio-filters";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { pageFilters } from "@/lib/command-center";
import { dashboardModulesForPlan } from "@/lib/dashboard-metrics";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildDashboardSnapshot } from "@/server/dashboard-data";
import { loadCommandRows } from "@/server/command-center-data";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    owner?: string;
    brand?: string;
    brandId?: string;
    opportunityType?: string;
  }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return <EmptyState line="Sign in to see revenue opportunities." cta="Sign in" href="/login" />;
  }
  const params = await searchParams;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const modules = dashboardModulesForPlan(ent);
  if (!modules.opportunityQueue && !modules.basicOpportunities) {
    return (
      <LockedModule
        title="Opportunities"
        line="Upsell notes from Friday reports unlock when you subscribe."
        upgradeTitle={UPGRADE_COPY.commandCenter.title}
        upgradeBody={UPGRADE_COPY.commandCenter.body}
        upgradeCta={UPGRADE_COPY.commandCenter.cta}
      />
    );
  }

  const filters = pageFilters(params);
  const [{ rows: allRows }, snapshot] = await Promise.all([
    loadCommandRows(ctx, ent.allowsWeeklyCadence),
    buildDashboardSnapshot(ctx, ent),
  ]);
  if (allRows.length === 0) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Opportunities</h1>
        <EmptyState title="No brands yet" line="Start the first Friday report." cta="Add a brand" href="/app/onboarding" />
      </div>
    );
  }

  const fullQueue = modules.opportunityQueue;
  const owners = [...new Set(allRows.map((row) => row.brand.clientOwner).filter((value): value is string => Boolean(value)))].sort();
  const brands = allRows.map((row) => ({ id: row.brand.id, name: row.brand.name }));
  let items = fullQueue ? snapshot.opportunities : snapshot.opportunities.slice(0, 3);
  if (filters.brandId) items = items.filter((item) => item.brandId === filters.brandId);
  if (fullQueue && filters.owner) {
    const owned = new Set(allRows.filter((row) => row.brand.clientOwner === filters.owner).map((row) => row.brand.id));
    items = items.filter((item) => owned.has(item.brandId));
  }
  if (fullQueue && filters.opportunityType) {
    items = items.filter((item) => item.key === filters.opportunityType);
  }

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-semibold tracking-tight">Opportunities</h1>
      <p className="mt-1 text-sm text-cb-muted">
        {fullQueue
          ? "Action queue from stored reports. Impact, effort, and status for the next client conversation."
          : "Basic opportunities from your latest report. Agency unlocks the full multi-client queue with status and owners."}
      </p>
      {fullQueue ? (
        <div className="mt-6">
          <PortfolioFilters fields={["opportunityType", "owner", "brandId"]} owners={owners} brands={brands} />
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="mt-8 text-sm text-cb-muted">
          {filters.opportunityType || filters.owner || filters.brandId
            ? "No opportunities in this filter."
            : "No comparison gaps or visibility drops in the latest reports. Run or review a report to find the next piece of work."}
        </p>
      ) : (
        <div className="mt-8 grid gap-4">
          {items.map((item) => (
            <article key={`${item.brandId}-${item.key}`} className="min-w-0 rounded-cb-card border border-cb-line bg-cb-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-cb-muted">{item.brandName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-cb-muted">
                  <span className="rounded-cb-control bg-cb-muted-bg px-2 py-1 capitalize">{item.status}</span>
                  <span>{item.impact} impact</span>
                  <span>{item.effort} effort</span>
                  {fullQueue && item.priorityScore > 0 ? (
                    <span className="font-mono tabular-nums">P{item.priorityScore}</span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm text-cb-text">{item.suggestedAction}</p>
              <p className="mt-2 text-sm text-cb-muted">{item.reason}</p>
              {item.suggestedPage ? (
                <p className="mt-2 text-xs text-cb-muted">Suggested page: {item.suggestedPage}</p>
              ) : null}
              {item.relatedPrompt || item.relatedEngine ? (
                <p className="mt-2 text-xs text-cb-muted">
                  {item.relatedEngine ? `${item.relatedEngine}` : ""}
                  {item.relatedEngine && item.relatedPrompt ? " · " : ""}
                  {item.relatedPrompt || ""}
                </p>
              ) : null}
              {item.owner ? <p className="mt-1 text-xs text-cb-muted">Owner: {item.owner}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={item.href} className="text-sm text-cb-accent">
                  Open report
                </Link>
                <CopyRecommendation text={item.suggestedAction} />
                {fullQueue ? (
                  <OpportunityStatusControl
                    brandId={item.brandId}
                    reportId={item.reportId}
                    opportunityKey={item.key}
                    status={item.status}
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
