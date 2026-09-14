import Link from "next/link";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { Sparkline } from "@/components/app/sparkline";
import { RunNowButton } from "@/components/brands/run-now-button";
import { StatusPill } from "@/components/ui/status-pill";
import { getAppContext } from "@/lib/session";
import { buildPromptPerformance } from "@/server/dashboard-data";
import { listWorkspaceBrands } from "@/server/workspace-data";

export default async function PromptsPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string; filter?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return <EmptyState line="Sign in to see prompt performance." cta="Sign in" href="/login" />;
  }

  const params = await searchParams;
  const brands = await listWorkspaceBrands(ctx);
  if (brands.length === 0) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Prompts</h1>
        <EmptyState
          title="No brands yet"
          line="Generate buyer questions after you add a brand — then track mention and recommendation performance per prompt."
          cta="Add a brand"
          href="/app/onboarding"
          steps={["Add a brand", "Generate prompts", "Run a report to see performance"]}
        />
      </div>
    );
  }

  const selectedIds = params.brandId ? [params.brandId] : brands.map((brand) => brand.id);
  const batches = await Promise.all(selectedIds.map((id) => buildPromptPerformance(ctx, id)));
  const items = batches.flat();
  const filter = params.filter || "all";
  const filtered = items.filter((item) => {
    if (filter === "all") return true;
    return item.filterTags.includes(filter as (typeof item.filterTags)[number]);
  });

  const filters = [
    { id: "all", label: "All" },
    { id: "winning", label: "Winning" },
    { id: "losing", label: "Losing" },
    { id: "no_mention", label: "No mention" },
    { id: "competitor_wins", label: "Competitor wins" },
    { id: "high_intent", label: "High intent" },
    { id: "recently_changed", label: "Recently changed" },
    { id: "failed", label: "Failed" },
  ] as const;

  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Prompts</h1>
          <p className="mt-1 text-sm text-cb-muted">
            Buyer questions as tracked assets — mention, recommendation, competitors, and engines from the latest run.
          </p>
        </div>
        {brands.length === 1 ? (
          <Link href={`/app/brands/${brands[0].id}/prompts`} className="text-sm text-cb-accent">
            Edit prompts
          </Link>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {brands.map((brand) => {
          const active = params.brandId === brand.id;
          const href = active
            ? `/app/prompts${filter !== "all" ? `?filter=${filter}` : ""}`
            : `/app/prompts?brandId=${brand.id}${filter !== "all" ? `&filter=${filter}` : ""}`;
          return (
            <Link
              key={brand.id}
              href={href}
              className={
                active
                  ? "rounded-cb-control bg-cb-accent-subtle px-3 py-1.5 text-xs text-cb-accent"
                  : "rounded-cb-control border border-cb-line px-3 py-1.5 text-xs text-cb-muted hover:text-cb-text"
              }
            >
              {brand.name}
            </Link>
          );
        })}
        {params.brandId ? (
          <Link href={`/app/prompts${filter !== "all" ? `?filter=${filter}` : ""}`} className="px-2 py-1.5 text-xs text-cb-accent">
            All brands
          </Link>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((item) => {
          const qs = new URLSearchParams();
          if (params.brandId) qs.set("brandId", params.brandId);
          if (item.id !== "all") qs.set("filter", item.id);
          const href = qs.toString() ? `/app/prompts?${qs}` : "/app/prompts";
          const active = filter === item.id;
          return (
            <Link
              key={item.id}
              href={href}
              className={
                active
                  ? "rounded-cb-control bg-cb-accent px-3 py-1.5 text-xs text-cb-on-accent"
                  : "rounded-cb-control border border-cb-line px-3 py-1.5 text-xs text-cb-muted hover:text-cb-text"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "No prompt performance yet" : "No prompts match this filter"}
          line={
            items.length === 0
              ? "Run a Friday report to score each buyer question for mention, recommendation, and competitors."
              : "Try All or another filter to see tracked prompts."
          }
          cta={items.length === 0 ? "Open brands" : "Clear filter"}
          href={items.length === 0 ? "/app/brands" : "/app/prompts"}
        />
      ) : (
        <DataTable minWidth="1120px">
          <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
            <tr className="h-12 border-b border-cb-line">
              <Th>Prompt</Th>
              <Th>Brand</Th>
              <Th>Mix</Th>
              <Th>Score</Th>
              <Th>Trend</Th>
              <Th>Status</Th>
              <Th>Position</Th>
              <Th>Competitors</Th>
              <Th>Cited</Th>
              <Th>Engines</Th>
              <Th>Movement</Th>
              <Th>Recheck</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={`${item.brandId}-${item.promptId}`} className="h-12 border-b border-cb-line last:border-0">
                <Td truncate>
                  <Link
                    href={`/app/brands/${item.brandId}?recheck=${item.promptId}`}
                    className="text-cb-text hover:text-cb-accent"
                    title={item.lastAnswerSummary ?? undefined}
                  >
                    {item.text}
                  </Link>
                </Td>
                <Td truncate>
                  <Link href={`/app/brands/${item.brandId}`} className="text-cb-accent">
                    {item.brandName}
                  </Link>
                </Td>
                <Td className="text-cb-muted">{item.mix || "—"}</Td>
                <Td className="font-mono tabular-nums">{item.visibilityScore ?? "—"}</Td>
                <Td>
                  <Sparkline values={item.scoreHistory} />
                </Td>
                <Td>
                  {item.recommended ? (
                    <StatusPill status="named">Recommended</StatusPill>
                  ) : item.mentioned ? (
                    <StatusPill status="named">Mentioned</StatusPill>
                  ) : (
                    <StatusPill status="missing">Missing</StatusPill>
                  )}
                </Td>
                <Td className="font-mono tabular-nums">{item.brandPosition ?? "—"}</Td>
                <Td truncate className="text-cb-muted">
                  {item.competitors.length ? item.competitors.join(", ") : "—"}
                </Td>
                <Td truncate className="text-cb-muted">
                  {item.citedUrls.length ? item.citedUrls[0] : "—"}
                </Td>
                <Td className="font-mono text-xs tabular-nums text-cb-muted">
                  {item.enginesChecked.join(", ")}
                </Td>
                <Td className="text-cb-muted">
                  {item.movement == null ? "New" : item.movement > 0 ? "Up" : item.movement < 0 ? "Down" : "Flat"}
                </Td>
                <Td>
                  <RunNowButton
                    brandId={item.brandId}
                    promptId={item.promptId}
                    label="Recheck"
                    compact
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
