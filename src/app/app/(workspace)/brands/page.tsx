import Link from "next/link";
import { AgencySavedViews } from "@/components/app/agency-saved-views";
import { BrandScorecard } from "@/components/app/brand-scorecard";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { RiskPill } from "@/components/app/risk-pill";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { ArchiveButton } from "@/components/brands/archive-button";
import { DuplicateBrandButton } from "@/components/brands/duplicate-brand-button";
import { Button } from "@/components/ui/button";
import {
  matchesAgencySavedView,
  parseAgencySavedView,
  type AgencySavedView,
} from "@/lib/dashboard-metrics";
import { upgradeHintForBrandCap, workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildDashboardSnapshot } from "@/server/dashboard-data";
import { listWorkspaceBrands } from "@/server/workspace-data";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; view?: string; saved?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return <EmptyState line="Sign in to add a brand." cta="Sign in" href="/login" />;
  }

  const { archived, view, saved } = await searchParams;
  const includeArchived = archived === "1";
  const tableView = view === "table";
  const savedView = parseAgencySavedView(saved);
  const rows = await listWorkspaceBrands(ctx, includeArchived);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const snapshot = await buildDashboardSnapshot(ctx, ent);
  const scoreById = new Map(snapshot.scorecards.map((card) => [card.brandId, card]));
  const commandById = new Map(snapshot.rows.map((row) => [row.brand.id, row]));
  const brandLimit = ent.brandLimit;
  const activeCount = includeArchived ? rows.filter((brand) => !brand.archivedAt).length : rows.length;
  const atCap = activeCount >= brandLimit;
  const needsAgency = !ent.paid || ent.plan === "starter";
  const showAgencyViews = Boolean(snapshot.modules.agencyWorkspace) && !includeArchived;

  function matchesView(brandId: string, agencyView: AgencySavedView) {
    const card = scoreById.get(brandId);
    const command = commandById.get(brandId);
    if (!card) return agencyView === "all";
    return matchesAgencySavedView(
      {
        health: card.health,
        risk: card.risk,
        pipeline: command?.pipeline,
        sendOverdue: command?.sendOverdue,
        mentionedDelta: card.mentionedDelta,
        competitorLeadShare: command?.competitorLeadShare,
        competitorLeader: card.competitorLeader,
      },
      agencyView,
    );
  }

  const filteredScorecards =
    showAgencyViews && savedView !== "all"
      ? snapshot.scorecards.filter((card) => matchesView(card.brandId, savedView))
      : snapshot.scorecards;
  const filteredRows =
    showAgencyViews && savedView !== "all" ? rows.filter((brand) => matchesView(brand.id, savedView)) : rows;

  function brandsHref(next: { table?: boolean; archived?: boolean; saved?: AgencySavedView }) {
    const params = new URLSearchParams();
    if (next.table ?? tableView) params.set("view", "table");
    if (next.archived ?? includeArchived) params.set("archived", "1");
    const nextSaved = next.saved ?? savedView;
    if (nextSaved !== "all") params.set("saved", nextSaved);
    const qs = params.toString();
    return qs ? `/app/brands?${qs}` : "/app/brands";
  }

  return (
    <div className="min-w-0">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Brands</h1>
          <p className="mt-1 text-sm text-cb-muted">
            Scorecards for client health and momentum. Duplicate a live client. Archive when a retainer ends.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {snapshot.scorecards.length > 0 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={brandsHref({ table: !tableView })}>{tableView ? "Scorecards" : "Table"}</Link>
            </Button>
          ) : null}
          {atCap || rows.length === 0 ? null : (
            <Button asChild>
              <Link href="/app/onboarding?new=1">Add a brand</Link>
            </Button>
          )}
        </div>
      </div>

      {atCap ? (
        <div className="mb-6 max-w-xl">
          <UpgradePrompt
            title={
              needsAgency
                ? UPGRADE_COPY.fourthBrand.title
                : ent.plan === "studio"
                  ? "You hit the Studio brand cap"
                  : UPGRADE_COPY.extraBrandAgency.title
            }
            body={upgradeHintForBrandCap(ent)}
            cta={needsAgency ? UPGRADE_COPY.fourthBrand.cta : UPGRADE_COPY.extraBrandAgency.cta}
          />
        </div>
      ) : null}

      {showAgencyViews ? (
        <div className="mb-4">
          <AgencySavedViews
            active={savedView}
            basePath="/app/brands"
            keep={{
              view: tableView ? "table" : undefined,
              archived: includeArchived ? "1" : undefined,
            }}
          />
        </div>
      ) : null}

      <p className="mb-4 text-sm">
        {includeArchived ? (
          <Link href={brandsHref({ archived: false })} className="text-cb-accent">
            Hide archived
          </Link>
        ) : (
          <Link href={brandsHref({ archived: true, table: true })} className="text-cb-accent">
            Show archived
          </Link>
        )}
        <span className="ml-3 text-cb-muted">
          {activeCount}/{brandLimit} active
          {!ent.paid ? " · trial" : ""}
          {showAgencyViews && savedView !== "all"
            ? ` · ${tableView || includeArchived ? filteredRows.length : filteredScorecards.length} in view`
            : ""}
        </span>
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="No brands yet"
          line="Scorecards appear after you add a brand and run a report. Start with onboarding — one brand is enough to prove the workflow."
          cta="Add a brand"
          href="/app/onboarding"
          steps={["Add a brand", "Generate prompts", "Run the first Friday report"]}
        />
      ) : !tableView && !includeArchived ? (
        filteredScorecards.length === 0 ? (
          <p className="text-sm text-cb-muted">No brands in this saved view.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredScorecards.map((card) => (
              <BrandScorecard key={card.brandId} card={card} />
            ))}
          </div>
        )
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-cb-muted">No brands in this saved view.</p>
      ) : (
        <DataTable minWidth="720px">
          <thead className="bg-cb-surface text-left text-cb-muted">
            <tr className="h-12 border-b border-cb-line">
              <Th>Brand</Th>
              <Th>Risk</Th>
              <Th>Visibility</Th>
              <Th>Site / vertical</Th>
              <Th>Client owner</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((brand) => {
              const card = scoreById.get(brand.id);
              return (
                <tr key={brand.id} className="h-12 border-b border-cb-line last:border-0">
                  <Td>
                    <Link href={`/app/brands/${brand.id}`} className="flex min-w-0 items-center gap-3">
                      {brand.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={brand.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-cb-accent-subtle text-xs text-cb-accent">
                          {brand.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="truncate font-medium">
                        {brand.name}
                        {brand.archivedAt ? <span className="ml-2 text-xs text-cb-muted">Archived</span> : null}
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    {brand.archivedAt ? (
                      <span className="text-xs text-cb-muted">Archived</span>
                    ) : (
                      <RiskPill risk={card?.risk ?? "watch"} />
                    )}
                  </Td>
                  <Td className="font-mono tabular-nums">{card?.visibilityScore ?? "—"}</Td>
                  <Td truncate className="text-cb-muted">
                    {brand.siteUrl || brand.vertical || brand.category || "—"}
                  </Td>
                  <Td truncate className="text-cb-muted">
                    {brand.clientOwner || brand.buyer || "—"}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      {brand.archivedAt ? null : <DuplicateBrandButton brandId={brand.id} />}
                      <ArchiveButton brandId={brand.id} archived={Boolean(brand.archivedAt)} />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
