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
        <EmptyState title="No brands yet" line="Risk alerts roll up Watch / At risk clients from stored reports after you add a brand and run Friday." cta="Add a brand" href="/app/onboarding" steps={["Add a brand", "Run a report", "Watch At-risk clients here"]} />
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
  const unreadCount = alerts.filter((item) => item.unread && item.severity === "at_risk").length;

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-semibold tracking-tight">Risks</h1>
      <p className="mt-1 text-sm text-cb-muted">
        Severity, what happened, why it matters, and the recommended fix — from stored reports.
        {snapshot.highRiskLastNotifiedAt
          ? ` Last high-risk email ${formatShortDate(new Date(snapshot.highRiskLastNotifiedAt))}.`
          : snapshot.notifyHighRisks
            ? " High-risk Friday email is on; no digest sent yet."
            : ""}
        {unreadCount > 0 ? ` ${unreadCount} unread At-risk alert${unreadCount === 1 ? "" : "s"}.` : ""}
      </p>
      {!snapshot.notifyHighRisks ? (
        <p className="mt-2 text-xs text-cb-muted">
          Turn on “Email me when clients are At risk” in{" "}
          <Link href="/app/settings/workspace" className="text-cb-accent">
            Workspace settings
          </Link>{" "}
          for a Friday digest.
        </p>
      ) : null}
      <div className="mt-6">
        <PortfolioFilters fields={["risk", "owner", "brandId"]} owners={owners} brands={brands} />
      </div>
      {alerts.length === 0 ? (
        <div className="mt-8">
          {filters.risk || filters.owner || filters.brandId ? (
            <p className="text-sm text-cb-muted">No clients in this filter.</p>
          ) : (
            <EmptyState
              title="No Watch or At risk clients"
              line="When named scores drop, competitors lead, or sends slip, alerts land here with a recommended fix."
              cta="Open Overview"
              href="/app"
              secondaryCta="Run a brand"
              secondaryHref="/app/brands"
            />
          )}
        </div>
      ) : (
        <div className="mt-8">
          <DataTable minWidth={showAffectedPrompts || showAffectedEngines ? "1280px" : "1080px"}>
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <Th nowrap className="w-[1%] min-w-[7rem]">
                  Brand
                </Th>
                <Th nowrap>Severity</Th>
                <Th>What happened</Th>
                <Th>Why it matters</Th>
                <Th>Recommended fix</Th>
                {showFirstSeen ? <Th nowrap>First seen</Th> : null}
                <Th nowrap>Last seen</Th>
                {showAffectedPrompts ? <Th>Affected prompts</Th> : null}
                {showAffectedEngines ? <Th nowrap>Engines</Th> : null}
              </tr>
            </thead>
            <tbody>
              {alerts.map((item) => (
                <tr
                  key={item.brandId}
                  className={
                    item.unread && item.severity === "at_risk"
                      ? "h-12 border-b border-cb-line bg-cb-accent-subtle/40 last:border-0"
                      : "h-12 border-b border-cb-line last:border-0"
                  }
                >
                  <Td nowrap className="w-[1%] min-w-[7rem]">
                    <Link href={item.href} className="inline-flex max-w-[12rem] items-center gap-1.5 text-cb-accent">
                      {item.unread && item.severity === "at_risk" ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cb-accent" aria-label="Unread" />
                      ) : null}
                      <span className="truncate">{item.brandName}</span>
                    </Link>
                  </Td>
                  <Td nowrap>
                    <RiskPill risk={item.severity} />
                  </Td>
                  <Td truncate className="max-w-[180px] text-cb-muted">
                    {item.whatHappened}
                  </Td>
                  <Td truncate className="max-w-[180px] text-cb-muted">
                    {item.whyItMatters}
                  </Td>
                  <Td truncate className="max-w-[200px]">
                    {item.recommendedFix}
                  </Td>
                  {showFirstSeen ? (
                    <Td nowrap className="font-mono text-xs text-cb-muted">
                      {item.firstSeenAt ? formatShortDate(new Date(item.firstSeenAt)) : "—"}
                    </Td>
                  ) : null}
                  <Td nowrap className="font-mono text-xs text-cb-muted">
                    {item.lastSeenAt ? formatShortDate(new Date(item.lastSeenAt)) : "—"}
                  </Td>
                  {showAffectedPrompts ? (
                    <Td truncate className="max-w-[240px] text-cb-muted" title={item.affectedPrompts.join("; ")}>
                      {item.affectedPrompts.slice(0, 2).join("; ") || "—"}
                    </Td>
                  ) : null}
                  {showAffectedEngines ? (
                    <Td nowrap className="font-mono text-xs text-cb-muted">
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
