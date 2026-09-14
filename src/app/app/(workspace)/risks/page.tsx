import Link from "next/link";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { LockedModule } from "@/components/app/locked-module";
import { PortfolioFilters } from "@/components/app/portfolio-filters";
import { RiskPill } from "@/components/app/risk-pill";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { pageFilters } from "@/lib/command-center";
import { workspaceEntitlements } from "@/lib/entitlements";
import { formatShortDate } from "@/lib/friday";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildDashboardSnapshot } from "@/server/dashboard-data";
import { loadCommandRows } from "@/server/command-center-data";

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
      <LockedModule
        title="Risks"
        line={
          ent.trialing
            ? "Trial keeps a lighter Home. Agency unlocks Stable / Watch / At risk rollups."
            : "Stable / Watch / At risk rollups are on Agency."
        }
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
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Risks</h1>
        <EmptyState title="No brands yet" line="Start the first Friday report." cta="Add a brand" href="/app/onboarding" />
      </div>
    );
  }

  const owners = [...new Set(allRows.map((row) => row.brand.clientOwner).filter((value): value is string => Boolean(value)))].sort();
  const brands = allRows.map((row) => ({ id: row.brand.id, name: row.brand.name }));
  let alerts = snapshot.risks;
  if (filters.risk) alerts = alerts.filter((item) => item.severity === filters.risk);
  if (filters.brandId) alerts = alerts.filter((item) => item.brandId === filters.brandId);
  if (filters.owner) {
    const owned = new Set(allRows.filter((row) => row.brand.clientOwner === filters.owner).map((row) => row.brand.id));
    alerts = alerts.filter((item) => owned.has(item.brandId));
  }

  const showFirstSeen = alerts.some((item) => item.firstSeenAt);
  const showAffectedPrompts = alerts.some((item) => item.affectedPrompts.length > 0);
  const showAffectedEngines = alerts.some((item) => item.affectedEngines.length > 0);

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-semibold tracking-tight">Risks</h1>
      <p className="mt-1 text-sm text-cb-muted">
        Severity, what happened, why it matters, and the recommended fix — from stored reports.
      </p>
      <div className="mt-6">
        <PortfolioFilters fields={["risk", "owner", "brandId"]} owners={owners} brands={brands} />
      </div>
      {alerts.length === 0 ? (
        <p className="mt-8 text-sm text-cb-muted">
          {filters.risk || filters.owner || filters.brandId
            ? "No clients in this filter."
            : "No Watch or At risk clients this week."}
        </p>
      ) : (
        <div className="mt-8">
          <DataTable minWidth="1080px">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <Th>Brand</Th>
                <Th>Severity</Th>
                <Th>What happened</Th>
                <Th>Why it matters</Th>
                <Th>Recommended fix</Th>
                {showFirstSeen ? <Th>First seen</Th> : null}
                <Th>Last seen</Th>
                {showAffectedPrompts ? <Th>Affected prompts</Th> : null}
                {showAffectedEngines ? <Th>Engines</Th> : null}
              </tr>
            </thead>
            <tbody>
              {alerts.map((item) => (
                <tr key={item.brandId} className="h-12 border-b border-cb-line last:border-0">
                  <Td>
                    <Link href={item.href} className="text-cb-accent">
                      {item.brandName}
                    </Link>
                  </Td>
                  <Td>
                    <RiskPill risk={item.severity} />
                  </Td>
                  <Td truncate className="text-cb-muted">
                    {item.whatHappened}
                  </Td>
                  <Td truncate className="text-cb-muted">
                    {item.whyItMatters}
                  </Td>
                  <Td truncate>{item.recommendedFix}</Td>
                  {showFirstSeen ? (
                    <Td className="whitespace-nowrap font-mono text-xs text-cb-muted">
                      {item.firstSeenAt ? formatShortDate(new Date(item.firstSeenAt)) : "—"}
                    </Td>
                  ) : null}
                  <Td className="whitespace-nowrap font-mono text-xs text-cb-muted">
                    {item.lastSeenAt ? formatShortDate(new Date(item.lastSeenAt)) : "—"}
                  </Td>
                  {showAffectedPrompts ? (
                    <Td truncate className="text-cb-muted">
                      {item.affectedPrompts.slice(0, 2).join("; ") || "—"}
                    </Td>
                  ) : null}
                  {showAffectedEngines ? (
                    <Td truncate className="font-mono text-xs text-cb-muted">
                      {item.affectedEngines.join(", ") || "—"}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}
    </div>
  );
}
