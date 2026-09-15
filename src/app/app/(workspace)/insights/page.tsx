import Link from "next/link";
import { CopyRecommendation } from "@/components/app/copy-recommendation";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { LockedModule } from "@/components/app/locked-module";
import { OpportunityStatusControl } from "@/components/app/opportunity-status";
import { PortfolioFilters, type PortfolioFilterField } from "@/components/app/portfolio-filters";
import { RiskPill } from "@/components/app/risk-pill";
import { StudioBadge, StudioUpgradeHint } from "@/components/app/studio-badge";
import { PLANS } from "@/lib/billing";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { pageFilters } from "@/lib/command-center";
import { dashboardModulesForPlan } from "@/lib/dashboard-metrics";
import { workspaceEntitlements } from "@/lib/entitlements";
import { formatShortDate } from "@/lib/friday";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildDashboardSnapshot } from "@/server/dashboard-data";
import { loadCommandRows } from "@/server/command-center-data";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    owner?: string;
    risk?: string;
    brand?: string;
    brandId?: string;
    opportunityType?: string;
  }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return <EmptyState line="Sign in to see risks and opportunities." cta="Sign in" href="/login" />;
  }
  const params = await searchParams;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const modules = dashboardModulesForPlan(ent);
  const showOpps = modules.opportunityQueue || modules.basicOpportunities;
  const showRisks = ent.allowsPortfolioRollups;
  if (!showOpps && !showRisks) {
    return (
      <LockedModule
        title="Insights"
        line={
          ent.trialing
            ? `Trial keeps a lighter Home. ${PLANS.agency.name} unlocks risk rollups and the opportunity queue.`
            : `Risks and opportunities are on ${PLANS.agency.name}.`
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
    buildDashboardSnapshot(ctx, ent, { includeRechecks: false }),
  ]);
  if (allRows.length === 0) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Insights</h1>
        <EmptyState
          title="No brands yet"
          line="Risks and opportunities come from Friday reports after you add a brand."
          cta="Add a brand"
          href="/app/onboarding"
          steps={["Add a brand", "Run a report", "Return here for risks and next work"]}
        />
      </div>
    );
  }

  const fullQueue = modules.opportunityQueue;
  const owners = [
    ...new Set(allRows.map((row) => row.brand.clientOwner).filter((value): value is string => Boolean(value))),
  ].sort();
  const brands = allRows.map((row) => ({ id: row.brand.id, name: row.brand.name }));

  let alerts = showRisks ? snapshot.risks : [];
  if (filters.risk) alerts = alerts.filter((item) => item.severity === filters.risk);
  if (filters.brandId) alerts = alerts.filter((item) => item.brandId === filters.brandId);
  if (filters.owner) {
    const owned = new Set(allRows.filter((row) => row.brand.clientOwner === filters.owner).map((row) => row.brand.id));
    alerts = alerts.filter((item) => owned.has(item.brandId));
  }

  let items = showOpps ? (fullQueue ? snapshot.opportunities : snapshot.opportunities.slice(0, 3)) : [];
  if (filters.brandId) items = items.filter((item) => item.brandId === filters.brandId);
  if (fullQueue && filters.owner) {
    const owned = new Set(
      allRows.filter((row) => row.brand.clientOwner === filters.owner).map((row) => row.brand.id),
    );
    items = items.filter((item) => owned.has(item.brandId));
  }
  if (fullQueue && filters.opportunityType) {
    items = items.filter((item) => item.key === filters.opportunityType);
  }

  const showFirstSeen = alerts.some((item) => item.firstSeenAt);
  const showAffectedPrompts = alerts.some((item) => item.affectedPrompts.length > 0);
  const showAffectedEngines = alerts.some((item) => item.affectedEngines.length > 0);
  const unreadCount = alerts.filter((item) => item.unread && item.severity === "at_risk").length;
  const filterFields: PortfolioFilterField[] = [
    ...(showRisks ? (["risk"] as const) : []),
    ...(fullQueue ? (["opportunityType"] as const) : []),
    ...((showRisks || fullQueue) && (owners.length > 0 || brands.length > 1)
      ? (["owner", "brandId"] as const)
      : []),
  ];

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-semibold tracking-tight">Insights</h1>
      <p className="mt-1 text-sm text-cb-muted">
        Client risk and the next piece of work, from stored reports.
        {showRisks && snapshot.highRiskLastNotifiedAt
          ? ` Last high-risk email ${formatShortDate(new Date(snapshot.highRiskLastNotifiedAt))}.`
          : showRisks && snapshot.notifyHighRisks
            ? " High-risk Friday email is on; no digest sent yet."
            : ""}
        {unreadCount > 0 ? ` ${unreadCount} unread At-risk alert${unreadCount === 1 ? "" : "s"}.` : ""}
      </p>
      {showRisks && !snapshot.notifyHighRisks ? (
        <p className="mt-2 text-xs text-cb-muted">
          Turn on “Email me when clients are At risk” in{" "}
          <Link href="/app/settings/workspace" className="text-cb-accent">
            Workspace settings
          </Link>{" "}
          for a Friday digest.
        </p>
      ) : null}
      {filterFields.length > 0 ? (
        <div className="mt-6">
          <PortfolioFilters fields={filterFields} owners={owners} brands={brands} />
        </div>
      ) : null}

      {showRisks ? (
        <section id="risks" className="mt-10">
          <h2 className="text-sm font-medium">Risks</h2>
          {alerts.length === 0 ? (
            <div className="mt-4">
              {filters.risk || filters.owner || filters.brandId ? (
                <p className="text-sm text-cb-muted">No clients in this filter.</p>
              ) : (
                <p className="text-sm text-cb-muted">
                  No Watch or At risk clients. Alerts land here when named scores drop, competitors lead, or sends slip.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4">
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
        </section>
      ) : null}

      {showOpps ? (
        <section id="opportunities" className="mt-10">
          <h2 className="text-sm font-medium">Opportunities</h2>
          <p className="mt-1 text-sm text-cb-muted">
            {fullQueue
              ? "Action queue from stored reports. Impact, effort, and status for the next client conversation."
              : `Basic opportunities from your latest report. ${PLANS.agency.name} unlocks the full multi-client queue with status and owners.`}
          </p>
          {fullQueue && !modules.opportunityScoring ? (
            <div className="mt-4">
              <StudioUpgradeHint
                title="Priority opportunity scoring"
                body={`${PLANS.studio.name} doubles scoring weight so the queue sorts like a consultant triage — high-impact, lower-effort work floats first across the portfolio.`}
              />
            </div>
          ) : null}
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-cb-muted">
              {filters.opportunityType || filters.owner || filters.brandId
                ? "No opportunities in this filter."
                : "No comparison gaps or visibility drops in the latest reports."}
            </p>
          ) : (
            <div className="mt-4 grid gap-4">
              {items.map((item) => (
                <article
                  key={`${item.brandId}-${item.key}`}
                  className="min-w-0 rounded-cb-card border border-cb-line bg-cb-surface p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-cb-muted">{item.brandName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-cb-muted">
                      <span className="rounded-cb-control bg-cb-muted-bg px-2 py-1 capitalize">{item.status}</span>
                      <span>{item.impact} impact</span>
                      <span>{item.effort} effort</span>
                      {fullQueue && modules.opportunityScoring && item.priorityScore > 0 ? (
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <StudioBadge /> P{item.priorityScore}
                        </span>
                      ) : fullQueue && item.priorityScore > 0 ? (
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
        </section>
      ) : null}
    </div>
  );
}
