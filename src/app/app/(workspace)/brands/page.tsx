import Link from "next/link";
import { AgencySavedViews } from "@/components/app/agency-saved-views";
import { BrandScorecard } from "@/components/app/brand-scorecard";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { ListPager } from "@/components/app/list-pager";
import { PageHeader } from "@/components/app/page-header";
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
import { countActiveBrands, getWorkspaceSubscription } from "@/lib/usage";
import { buildDashboardSnapshot } from "@/server/dashboard-data";
import {
  listWorkspaceBrands,
  listWorkspaceBrandsPage,
  parseListPage,
} from "@/server/workspace-data";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; view?: string; saved?: string; page?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return <EmptyState line="Sign in to add a brand." cta="Sign in" href="/login" />;
  }

  const { archived, view, saved, page: pageRaw } = await searchParams;
  const includeArchived = archived === "1";
  const tableView = view === "table";
  const savedView = parseAgencySavedView(saved);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const showAgencyViews = Boolean(ent.allowsCommandCenter) && !includeArchived;
  const pageInfo = parseListPage(pageRaw);
  const sqlPage = !showAgencyViews || savedView === "all";
  const [activeCount, paged, allRows] = await Promise.all([
    countActiveBrands(ctx.db, ctx.workspace.id),
    sqlPage
      ? listWorkspaceBrandsPage(ctx, { includeArchived, page: pageInfo.page, pageSize: pageInfo.pageSize })
      : Promise.resolve(null),
    sqlPage ? Promise.resolve(null) : listWorkspaceBrands(ctx, includeArchived),
  ]);
  const snapshot = await buildDashboardSnapshot(ctx, ent, {
    brandIds: paged?.rows.map((brand) => brand.id),
    includeRechecks: false,
  });
  const scoreById = new Map(snapshot.scorecards.map((card) => [card.brandId, card]));
  const commandById = new Map(snapshot.rows.map((row) => [row.brand.id, row]));
  const brandLimit = ent.brandLimit;
  const atCap = activeCount >= brandLimit;
  const needsAgency = !ent.paid || ent.plan === "starter";

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

  let filteredScorecards = snapshot.scorecards;
  let filteredRows = paged?.rows ?? allRows ?? [];
  let listTotal = paged?.total ?? filteredRows.length;
  const workspaceEmpty = (paged?.total ?? allRows?.length ?? 0) === 0;

  if (!sqlPage) {
    const source = allRows ?? [];
    filteredRows = source.filter((brand) => matchesView(brand.id, savedView));
    filteredScorecards = snapshot.scorecards.filter((card) => matchesView(card.brandId, savedView));
    listTotal = tableView || includeArchived ? filteredRows.length : filteredScorecards.length;
    filteredRows = filteredRows.slice(pageInfo.offset, pageInfo.offset + pageInfo.pageSize);
    filteredScorecards = filteredScorecards.slice(pageInfo.offset, pageInfo.offset + pageInfo.pageSize);
  } else {
    const order = new Map(filteredRows.map((brand, index) => [brand.id, index]));
    filteredScorecards = snapshot.scorecards
      .filter((card) => order.has(card.brandId))
      .sort((a, b) => (order.get(a.brandId) ?? 0) - (order.get(b.brandId) ?? 0));
  }

  function brandsHref(next: { table?: boolean; archived?: boolean; saved?: AgencySavedView; page?: number }) {
    const params = new URLSearchParams();
    if (next.table ?? tableView) params.set("view", "table");
    if (next.archived ?? includeArchived) params.set("archived", "1");
    const nextSaved = next.saved ?? savedView;
    if (nextSaved !== "all") params.set("saved", nextSaved);
    const nextPage = next.page ?? 1;
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/app/brands?${qs}` : "/app/brands";
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="Clients"
        subtitle="Scorecards for client health and momentum. Duplicate a live client. Archive when a retainer ends."
        actions={
          <>
            {listTotal > 0 || snapshot.scorecards.length > 0 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={brandsHref({ table: !tableView })}>{tableView ? "Scorecards" : "Table"}</Link>
              </Button>
            ) : null}
            {atCap || workspaceEmpty ? null : (
              <Button asChild>
                <Link href="/app/onboarding?new=1">Add a brand</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/app?pitch=1">Pitch a domain</Link>
            </Button>
          </>
        }
      />

      {atCap ? (
        <div className="mb-6 max-w-xl">
          <UpgradePrompt
            title={
              needsAgency
                ? UPGRADE_COPY.fourthBrand.title
                : ent.plan === "studio"
                  ? UPGRADE_COPY.extraBrandStudio.title
                  : UPGRADE_COPY.extraBrandAgency.title
            }
            body={upgradeHintForBrandCap(ent)}
            cta={
              needsAgency
                ? UPGRADE_COPY.fourthBrand.cta
                : ent.plan === "studio"
                  ? UPGRADE_COPY.extraBrandStudio.cta
                  : UPGRADE_COPY.extraBrandAgency.cta
            }
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
          {showAgencyViews && savedView !== "all" ? ` · ${listTotal} in view` : ""}
        </span>
      </p>

      {workspaceEmpty ? (
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
              <Th>Site / market</Th>
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
                    {[brand.siteUrl || brand.vertical || brand.category, brand.market].filter(Boolean).join(" · ") || "—"}
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
      {!workspaceEmpty ? (
        <ListPager
          page={pageInfo.page}
          pageSize={pageInfo.pageSize}
          total={listTotal}
          hrefForPage={(nextPage) => brandsHref({ page: nextPage })}
        />
      ) : null}
    </div>
  );
}
