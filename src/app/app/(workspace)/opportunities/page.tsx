import Link from "next/link";
import { CopyRecommendation } from "@/components/app/copy-recommendation";
import { EmptyState } from "@/components/app/empty-state";
import { MarkPlanned } from "@/components/app/mark-planned";
import { PortfolioFilters } from "@/components/app/portfolio-filters";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { pageFilters } from "@/lib/command-center";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildCommandCenterSnapshot, loadCommandRows } from "@/server/command-center-data";

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
  if (!ent.allowsOpportunityRollups) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Opportunities</h1>
        <p className="mt-3 text-sm text-cb-muted">Upsell notes from Friday reports are on Agency.</p>
        <div className="mt-6">
          <UpgradePrompt
            title={UPGRADE_COPY.commandCenter.title}
            body={UPGRADE_COPY.commandCenter.body}
            cta={UPGRADE_COPY.commandCenter.cta}
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
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Opportunities</h1>
        <EmptyState title="No brands yet" line="Start the first Friday report." cta="Add a brand" href="/app/onboarding" />
      </div>
    );
  }

  const owners = [...new Set(allRows.map((row) => row.brand.clientOwner).filter((value): value is string => Boolean(value)))].sort();
  const brands = allRows.map((row) => ({ id: row.brand.id, name: row.brand.name }));
  const items = snapshot.opportunities;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Opportunities</h1>
      <p className="mt-1 text-sm text-cb-muted">Work you can sell from this week’s stored reports. No new model calls.</p>
      <div className="mt-6">
        <PortfolioFilters fields={["opportunityType", "owner", "brandId"]} owners={owners} brands={brands} />
      </div>
      {items.length === 0 ? (
        <p className="mt-8 text-sm text-cb-muted">
          {filters.opportunityType || filters.owner || filters.brandId
            ? "No opportunities in this filter."
            : "No comparison gaps or visibility drops in the latest reports. Run or review a report to find the next piece of work."}
        </p>
      ) : (
        <div className="mt-8 grid gap-4">
          {items.map((item) => (
            <article key={`${item.brandId}-${item.key}`} className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{item.client}</p>
                <p className="text-xs text-cb-muted">{item.planned ? "Planned" : item.value}</p>
              </div>
              <p className="mt-2 text-sm text-cb-text">
                {item.type} · {item.service}
              </p>
              <p className="mt-2 text-sm text-cb-muted">{item.evidence}</p>
              <p className="mt-3 text-sm text-cb-text">{item.wording}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={item.href} className="text-sm text-cb-accent">
                  Open report
                </Link>
                <CopyRecommendation text={item.wording} />
                <MarkPlanned
                  brandId={item.brandId}
                  reportId={item.reportId}
                  opportunityKey={item.key}
                  planned={item.planned}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
