import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PortfolioFilters } from "@/components/app/portfolio-filters";
import { RiskPill } from "@/components/app/risk-pill";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { pageFilters } from "@/lib/command-center";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildCommandCenterSnapshot, loadCommandRows } from "@/server/command-center-data";

export default async function RisksPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; risk?: string; brand?: string; brandId?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return <EmptyState line="Sign in to see client risk." cta="Sign in" href="/login" />;
  }
  const params = await searchParams;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  if (!ent.allowsPortfolioRollups) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Client risk</h1>
        <p className="mt-3 text-sm text-cb-muted">Stable / Watch / At risk rollups are on Agency.</p>
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
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Client risk</h1>
        <EmptyState title="No brands yet" line="Start the first Friday report." cta="Add a brand" href="/app/onboarding" />
      </div>
    );
  }

  const owners = [...new Set(allRows.map((row) => row.brand.clientOwner).filter((value): value is string => Boolean(value)))].sort();
  const brands = allRows.map((row) => ({ id: row.brand.id, name: row.brand.name }));
  const alerts = filters.risk
    ? snapshot.rows.map((row) => ({
        brandId: row.brand.id,
        brandName: row.brand.name,
        risk: row.risk,
        why: row.why,
        href: row.latestReport
          ? `/app/brands/${row.brand.id}/reports/${row.latestReport.id}`
          : `/app/brands/${row.brand.id}`,
      }))
    : snapshot.risks;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Client risk</h1>
      <p className="mt-1 text-sm text-cb-muted">Why a client is Stable, Watch, or At risk — from stored reports.</p>
      <div className="mt-6">
        <PortfolioFilters fields={["risk", "owner", "brandId"]} owners={owners} brands={brands} />
      </div>
      {alerts.length === 0 ? (
        <p className="mt-8 text-sm text-cb-muted">No Watch or At risk clients in this filter.</p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-cb-card border border-cb-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <th className="px-4 font-medium">Brand</th>
                <th className="px-4 font-medium">Risk</th>
                <th className="px-4 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((item) => (
                <tr key={item.brandId} className="h-12 border-b border-cb-line last:border-0">
                  <td className="px-4">
                    <Link href={item.href} className="text-cb-accent">
                      {item.brandName}
                    </Link>
                  </td>
                  <td className="px-4">
                    <RiskPill risk={item.risk} />
                  </td>
                  <td className="px-4 text-cb-muted">{item.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
