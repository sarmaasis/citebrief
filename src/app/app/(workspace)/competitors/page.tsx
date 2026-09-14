import Link from "next/link";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { EngineBreakdownEmpty, EngineBreakdownGrid } from "@/components/app/engine-breakdown";
import { LockedModule } from "@/components/app/locked-module";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { dashboardModulesForPlan } from "@/lib/dashboard-metrics";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildDashboardSnapshot, buildEngineBreakdown } from "@/server/dashboard-data";
import { listWorkspaceBrands } from "@/server/workspace-data";

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string; tab?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return <EmptyState line="Sign in to see competitor intelligence." cta="Sign in" href="/login" />;
  }

  const params = await searchParams;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const modules = dashboardModulesForPlan(ent);
  const brands = await listWorkspaceBrands(ctx);
  if (brands.length === 0) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Competitors</h1>
        <EmptyState
          title="No brands yet"
          line="Add a brand and run a report to see who AI recommends."
          cta="Add a brand"
          href="/app/onboarding"
        />
      </div>
    );
  }

  const snapshot = await buildDashboardSnapshot(ctx, ent);
  const brandId = params.brandId || brands[0]?.id;
  const byPrompt = params.tab === "prompts";
  const engineRows =
    brandId && (modules.engineBreakdown || modules.basicCompetitorMentions)
      ? await buildEngineBreakdown(ctx, brandId)
      : [];

  if (!modules.competitorLeaderboard && !modules.basicCompetitorMentions) {
    return (
      <LockedModule
        title="Competitors"
        line="Competitor intelligence unlocks with a paid plan."
        upgradeTitle={UPGRADE_COPY.commandCenter.title}
        upgradeBody={UPGRADE_COPY.commandCenter.body}
        upgradeCta={UPGRADE_COPY.commandCenter.cta}
      />
    );
  }

  const leaderboard = modules.competitorLeaderboard
    ? snapshot.competitorLeaderboard
    : snapshot.competitorLeaderboard.slice(0, 5);

  const promptRows = leaderboard.flatMap((row) =>
    row.promptsWon.map((prompt) => ({
      prompt,
      competitor: row.name,
      brandId: row.brandId,
      brandName: row.brandName,
      engines: row.engines,
      whyWinning: row.whyWinning,
      movementSinceLastRun: row.movementSinceLastRun,
    })),
  );

  const brandQuery = brandId ? `brandId=${brandId}` : "";

  return (
    <div className="min-w-0">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Competitors</h1>
        <p className="mt-1 text-sm text-cb-muted">
          Who wins buyer questions, which pages get cited, and how engines differ — from stored reports only.
        </p>
        {!modules.competitorLeaderboard ? (
          <p className="mt-2 text-xs text-cb-muted">Basic competitor mentions on this plan. Agency unlocks the full leaderboard.</p>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/app/competitors${brandQuery ? `?${brandQuery}` : ""}`}
          className={
            !byPrompt
              ? "rounded-cb-control bg-cb-accent-subtle px-2.5 py-1 text-xs text-cb-accent"
              : "rounded-cb-control border border-cb-line px-2.5 py-1 text-xs text-cb-muted"
          }
        >
          Leaderboard
        </Link>
        <Link
          href={`/app/competitors?tab=prompts${brandId ? `&brandId=${brandId}` : ""}`}
          className={
            byPrompt
              ? "rounded-cb-control bg-cb-accent-subtle px-2.5 py-1 text-xs text-cb-accent"
              : "rounded-cb-control border border-cb-line px-2.5 py-1 text-xs text-cb-muted"
          }
        >
          By prompt
        </Link>
      </div>

      {byPrompt ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium">Competitor by prompt</h2>
          {promptRows.length === 0 ? (
            <p className="text-sm text-cb-muted">No competitor prompt wins in the latest runs yet.</p>
          ) : (
            <DataTable minWidth="760px">
              <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
                <tr className="h-12 border-b border-cb-line">
                  <Th>Prompt</Th>
                  <Th>Competitor</Th>
                  <Th>Client</Th>
                  <Th>Why winning</Th>
                  <Th>Movement</Th>
                  <Th>Engines</Th>
                </tr>
              </thead>
              <tbody>
                {promptRows.map((row) => (
                  <tr key={`${row.brandId}-${row.competitor}-${row.prompt}`} className="h-12 border-b border-cb-line last:border-0">
                    <Td truncate>{row.prompt}</Td>
                    <Td className="font-medium">{row.competitor}</Td>
                    <Td>
                      <Link href={`/app/brands/${row.brandId}`} className="text-cb-accent">
                        {row.brandName}
                      </Link>
                    </Td>
                    <Td truncate className="text-cb-muted">
                      {row.whyWinning || "—"}
                    </Td>
                    <Td className="font-mono tabular-nums text-cb-muted">
                      {row.movementSinceLastRun == null
                        ? "—"
                        : row.movementSinceLastRun > 0
                          ? `+${row.movementSinceLastRun}`
                          : String(row.movementSinceLastRun)}
                    </Td>
                    <Td truncate className="font-mono text-xs text-cb-muted">
                      {row.engines.join(", ") || "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </section>
      ) : (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium">Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-cb-muted">No competitor wins in the latest runs yet.</p>
          ) : (
            <DataTable minWidth="920px">
              <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
                <tr className="h-12 border-b border-cb-line">
                  <Th>Competitor</Th>
                  <Th>Client</Th>
                  <Th>Top choice</Th>
                  <Th>Mentions</Th>
                  <Th>Citations</Th>
                  <Th>Why winning</Th>
                  <Th>Movement</Th>
                  <Th>Prompts won</Th>
                  <Th>Engines</Th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={`${row.brandId}-${row.name}`} className="h-12 border-b border-cb-line last:border-0">
                    <Td className="font-medium">{row.name}</Td>
                    <Td>
                      <Link href={`/app/brands/${row.brandId}`} className="text-cb-accent">
                        {row.brandName}
                      </Link>
                    </Td>
                    <Td className="font-mono tabular-nums">{row.topChoiceCount}</Td>
                    <Td className="font-mono tabular-nums">{row.mentionCount}</Td>
                    <Td className="font-mono tabular-nums">{row.citationCount}</Td>
                    <Td truncate className="text-cb-muted">
                      {row.whyWinning || "—"}
                    </Td>
                    <Td className="font-mono tabular-nums text-cb-muted">
                      {row.movementSinceLastRun == null
                        ? "—"
                        : row.movementSinceLastRun > 0
                          ? `+${row.movementSinceLastRun}`
                          : String(row.movementSinceLastRun)}
                    </Td>
                    <Td truncate className="text-cb-muted">
                      {row.promptsWon.slice(0, 2).join("; ") || "—"}
                    </Td>
                    <Td truncate className="font-mono text-xs text-cb-muted">
                      {row.engines.join(", ") || "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </section>
      )}

      {modules.advancedCompetitorIntel && leaderboard.some((row) => row.citedUrls.length) ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium">Cited pages</h2>
          <DataTable minWidth="560px">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <Th>URL</Th>
                <Th>Competitor</Th>
                <Th>Client</Th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.flatMap((row) =>
                row.citedUrls.slice(0, 3).map((url) => (
                  <tr key={`${row.brandId}-${row.name}-${url}`} className="h-12 border-b border-cb-line last:border-0">
                    <Td truncate>
                      <a href={url} className="text-cb-accent" target="_blank" rel="noreferrer">
                        {url}
                      </a>
                    </Td>
                    <Td truncate>{row.name}</Td>
                    <Td truncate>{row.brandName}</Td>
                  </tr>
                )),
              )}
            </tbody>
          </DataTable>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Engine breakdown</h2>
          {brands.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/app/competitors?brandId=${brand.id}${byPrompt ? "&tab=prompts" : ""}`}
                  className={
                    brand.id === brandId
                      ? "rounded-cb-control bg-cb-accent-subtle px-2 py-1 text-xs text-cb-accent"
                      : "rounded-cb-control border border-cb-line px-2 py-1 text-xs text-cb-muted"
                  }
                >
                  {brand.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        {engineRows.length === 0 ? <EngineBreakdownEmpty /> : <EngineBreakdownGrid engines={engineRows} />}
      </section>
    </div>
  );
}
