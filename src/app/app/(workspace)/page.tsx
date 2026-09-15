import { eq } from "drizzle-orm";
import Link from "next/link";
import { AgencySavedViews } from "@/components/app/agency-saved-views";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PortfolioExport } from "@/components/app/portfolio-export";
import { RiskPill } from "@/components/app/risk-pill";
import { ScoreChange } from "@/components/app/score-change";
import { Button } from "@/components/ui/button";
import { workspaces } from "@/db/schema";
import { PLANS } from "@/lib/billing";
import { PIPELINE_LABEL, averageNamedScore, pipelineStage, weeklyAction } from "@/lib/command-center";
import { movementLabel, parseAgencySavedView } from "@/lib/dashboard-metrics";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { buildCommandCenterSnapshot } from "@/server/command-center-data";
import { buildDashboardSnapshot } from "@/server/dashboard-data";
import { listHomeRows, withSendOverdue } from "@/server/workspace-data";
import { ensureSampleBrand } from "@/lib/sample-workspace";
import { PitchDomainForm } from "@/components/brands/pitch-domain-form";
import { isSampleBrand } from "@/lib/brand-kind";

export default async function AppHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return (
      <div>
        <PageHeader title="Home" subtitle="Sign in to start the first Friday report." />
        <EmptyState line="Sign in to start the first Friday report." cta="Sign in" href="/login" />
      </div>
    );
  }

  await ensureSampleBrand(ctx.db, ctx.workspace.id);

  const params = (await searchParams) ?? {};
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const savedView = parseAgencySavedView(params.view);

  if (!ent.allowsCommandCenter) {
    const [workspace] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, ctx.workspace.id)).limit(1);
    // listHomeRows is request-cached; buildDashboardSnapshot reuses it via loadCommandRows.
    const [rows, dash] = await Promise.all([
      listHomeRows(ctx).then((homeRows) =>
        withSendOverdue(homeRows, {
          timezone: workspace?.timezone || "America/New_York",
          weekly: ent.allowsWeeklyCadence,
        }),
      ),
      buildDashboardSnapshot(ctx, ent),
    ]);
    return (
      <LightHome
        rows={rows}
        overview={dash.overview}
        allowsEmailSend={ent.allowsEmailSend}
        allowsApproval={ent.allowsApproval}
        plan={ent.plan}
        brandLimit={ent.brandLimit}
        promptCap={ent.promptCap}
        monthlyRecheckCredits={ent.monthlyRecheckCredits}
        weekly={ent.allowsWeeklyCadence}
        canAddBrand={rows.length < ent.brandLimit}
      />
    );
  }

  // Command center snapshot is enough for Overview — skip the heavier dashboard builder
  // (second listHomeRows + full runRows join) that only fed duplicate table/overview fields.
  const snapshot = await buildCommandCenterSnapshot(ctx, ent, {}, { view: savedView });
  if (snapshot.unfilteredCount === 0) {
    return (
      <div>
        <PageHeader title="Home" subtitle="Add a brand to fill this week’s letters." />
        <EmptyState
          title="No brands yet"
          line="Add a brand, generate buyer questions, and run the first Friday report — Overview fills in from stored answers."
          cta="Add a brand"
          href="/app/onboarding"
          steps={[
            "Add your brand and category context",
            `Generate ${ent.promptCap} buyer questions`,
            "Run the first report on four AI surfaces",
          ]}
        />
      </div>
    );
  }

  const canAddBrand = snapshot.unfilteredCount < ent.brandLimit;
  const namedAvg = snapshot.kpis.portfolioVisibility;
  const namedTotal =
    snapshot.rows.find((row) => row.latestReport?.scoreTotal)?.latestReport?.scoreTotal ?? 20;
  const deltas = snapshot.rows
    .map((row) => row.mentionedDelta)
    .filter((d): d is number => d != null);
  const movement =
    deltas.length === 0 ? null : Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;
  const portfolioMovement = movementLabel(movement);

  // Top competitor across portfolio (most frequent competitor leader)
  const competitorTally = new Map<string, number>();
  for (const row of snapshot.rows) {
    if (row.competitorLeader) {
      competitorTally.set(row.competitorLeader, (competitorTally.get(row.competitorLeader) ?? 0) + 1);
    }
  }
  const topCompetitor = [...competitorTally.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  return (
    <div className="min-w-0">
      <PageHeader
        title="Home"
        subtitle={
          snapshot.kpis.reportsReady > 0
            ? `${snapshot.kpis.reportsReady} report${snapshot.kpis.reportsReady === 1 ? "" : "s"} ready to approve and send.`
            : portfolioMovement !== "unknown"
              ? `Portfolio is ${portfolioMovement}.`
              : "All clients stable."
        }
        actions={
          <>
            {snapshot.kpis.reportsReady > 0 ? (
              <Button asChild>
                <Link href="/app/reports">Approve & send</Link>
              </Button>
            ) : null}
            {ent.allowsPortfolioExport ? <PortfolioExport /> : null}
            {canAddBrand ? (
              <Button asChild variant={snapshot.kpis.reportsReady > 0 ? "outline" : "default"}>
                <Link href="/app/onboarding?new=1">Add a brand</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/app/settings/billing">Upgrade to add a brand</Link>
              </Button>
            )}
          </>
        }
      />

      {/* KPI cards — send job first, not hours-saved */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Ready to send"
          value={String(snapshot.kpis.reportsReady)}
          sub={snapshot.kpis.reportsReady > 0 ? "Approve & send" : "Nothing waiting"}
          subTone={snapshot.kpis.reportsReady > 0 ? "accent" : "muted"}
          href="/app/reports"
        />
        <KpiCard
          label="AI visibility"
          value={namedAvg == null ? "—" : `${namedAvg}/${namedTotal}`}
          sub={movement == null ? "No data yet" : movement > 0 ? `↑ +${movement} vs last week` : movement < 0 ? `↓ ${movement} vs last week` : "Flat this week"}
          subTone={movement == null ? "muted" : movement > 0 ? "named" : movement < 0 ? "missing" : "muted"}
          href="/app/brands"
        />
        <KpiCard
          label="Clients at risk"
          value={String(snapshot.kpis.clientsAtRisk)}
          sub={snapshot.kpis.clientsAtRisk === 0 ? "All stable" : "Need action"}
          subTone={snapshot.kpis.clientsAtRisk > 0 ? "missing" : "named"}
          href="/app/risks"
        />
        <KpiCard
          label="Who is winning"
          value={topCompetitor ? topCompetitor[0] : "—"}
          sub={
            topCompetitor
              ? `${topCompetitor[1]} client${topCompetitor[1] === 1 ? "" : "s"}`
              : "No rival lead yet"
          }
          subTone={topCompetitor ? "missing" : "muted"}
          href="/app/competitors"
        />
      </div>

      {/* Reports ready / competitor intel strip */}
      {(snapshot.kpis.reportsReady > 0 || topCompetitor) ? (
        <div className="mb-6 flex flex-wrap gap-3">
          {snapshot.kpis.reportsReady > 0 ? (
            <Link
              href="/app/reports"
              className="flex items-center gap-2 rounded-cb-control border border-cb-pending bg-cb-pending-subtle px-3 py-2 text-sm"
            >
              <span className="font-medium text-cb-pending">
                {snapshot.kpis.reportsReady} report{snapshot.kpis.reportsReady === 1 ? "" : "s"} ready to send
              </span>
              <span className="text-cb-muted">→</span>
            </Link>
          ) : null}
          {topCompetitor ? (
            <div className="flex items-center gap-2 rounded-cb-control border border-cb-line bg-cb-surface px-3 py-2 text-sm text-cb-muted">
              <span className="font-medium text-cb-text">{topCompetitor[0]}</span>
              <span>
                leading against {topCompetitor[1]} client{topCompetitor[1] === 1 ? "" : "s"}
              </span>
            </div>
          ) : null}
          {snapshot.kpis.failedOrPartial > 0 ? (
            <Link
              href="/app/activity"
              className="flex items-center gap-2 rounded-cb-control border border-cb-line bg-cb-surface px-3 py-2 text-sm text-cb-missing"
            >
              {snapshot.kpis.failedOrPartial} run{snapshot.kpis.failedOrPartial === 1 ? "" : "s"} failed — retry
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Actions queue — top 3, not just 1 */}
      {snapshot.actions.length > 0 ? (
        <div className="mb-6 rounded-cb-card border border-cb-line bg-cb-surface">
          <div className="flex items-center justify-between border-b border-cb-line px-4 py-3">
            <p className="text-sm font-medium">Actions this week</p>
            <span className="text-xs text-cb-muted">{snapshot.actions.length} pending</span>
          </div>
          <ul>
            {snapshot.actions.slice(0, 3).map((action, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-4 border-b border-cb-line px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{action.brandName}: {action.verb}</p>
                  <p className="mt-0.5 truncate text-xs text-cb-muted">{action.reason}</p>
                </div>
                <Link href={action.href} className="shrink-0 text-sm text-cb-accent">
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-6">
        <AgencySavedViews active={savedView} basePath="/app" paramKey="view" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">This week</h2>
          <Link href="/app/brands" className="text-xs text-cb-accent">
            Brand scorecards
          </Link>
        </div>
        {snapshot.rows.length === 0 ? (
          <p className="text-sm text-cb-muted">No clients in this saved view.</p>
        ) : (
          <DataTable minWidth="900px">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <Th>Brand</Th>
                <Th>Owner</Th>
                <Th>Risk</Th>
                <Th>Named</Th>
                <Th>Rec</Th>
                <Th>Change</Th>
                <Th>Competitor</Th>
                <Th>Pipeline</Th>
                <Th>Next</Th>
              </tr>
            </thead>
            <tbody>
              {snapshot.rows.map((row) => (
                <tr
                  key={row.brand.id}
                  className={cn(
                    "h-12 border-b border-cb-line last:border-0",
                    row.risk === "at_risk" && "border-l-2 border-l-cb-missing bg-cb-missing-subtle/30",
                    row.risk === "watch" && "border-l-2 border-l-cb-pending",
                  )}
                >
                  <Td>
                    <Link href={`/app/brands/${row.brand.id}`} className="font-medium text-cb-text hover:text-cb-accent">
                      {row.brand.name}
                    </Link>
                  </Td>
                  <Td truncate className="text-cb-muted">
                    {row.brand.clientOwner || "—"}
                  </Td>
                  <Td>
                    <RiskPill risk={row.risk} />
                  </Td>
                  <Td className="font-mono tabular-nums">
                    {row.latestReport
                      ? `${row.latestReport.scoreMentioned ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                      : "—"}
                  </Td>
                  <Td className="font-mono tabular-nums">
                    {row.latestReport
                      ? `${row.latestReport.scoreRecommended ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                      : "—"}
                  </Td>
                  <Td>
                    <ScoreChange delta={row.mentionedDelta} />
                  </Td>
                  <Td truncate className="text-cb-muted">
                    {row.competitorLeader
                      ? `${row.competitorLeader}${row.competitorLeadCount ? ` · ${row.competitorLeadCount}` : ""}`
                      : "—"}
                  </Td>
                  <Td className="text-cb-muted">{PIPELINE_LABEL[row.pipeline]}</Td>
                  <Td>
                    {row.action ? (
                      <Link href={row.action.href} className="text-cb-accent">
                        {row.action.verb}
                      </Link>
                    ) : (
                      <span className="text-cb-muted">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </section>
    </div>
  );
}

function LightHome({
  rows,
  overview,
  allowsEmailSend,
  allowsApproval,
  plan,
  brandLimit,
  promptCap,
  monthlyRecheckCredits,
  weekly,
  canAddBrand,
}: {
  rows: Awaited<ReturnType<typeof listHomeRows>>;
  overview: Awaited<ReturnType<typeof buildDashboardSnapshot>>["overview"];
  allowsEmailSend: boolean;
  allowsApproval: boolean;
  plan: keyof typeof PLANS;
  brandLimit: number;
  promptCap: number;
  monthlyRecheckCredits: number;
  weekly: boolean;
  canAddBrand: boolean;
}) {
  void monthlyRecheckCredits;
  void weekly;
  void brandLimit;
  const sampleRow = rows.find((row) => isSampleBrand(row.brand.kind));
  const clientRows = rows.filter((row) => !isSampleBrand(row.brand.kind));
  const readyCount = clientRows.filter((row) => row.latestReport && !row.latestReport.sentAt).length;

  if (rows.length === 0) {
    return (
      <div>
        <PageHeader title="Home" subtitle="Add a client brand to start Friday letters." />
        <EmptyState
          title="No brands yet"
          line="Add a client brand, generate buyer questions, and run the first report."
          cta="Add a brand"
          href="/app/onboarding"
          secondaryCta="See plans"
          secondaryHref="/app/settings/billing"
          steps={["Add a brand", "Generate prompts", "Run all four engines"]}
        />
        <div className="mt-8 max-w-md rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <PitchDomainForm />
        </div>
      </div>
    );
  }

  const onlyBrand = clientRows.length === 1 ? clientRows[0] : rows.length === 1 ? rows[0] : null;
  const firstBrandNeedsSetup = Boolean(onlyBrand && !onlyBrand.latestReport && !isSampleBrand(onlyBrand.brand.kind));
  const nextAction = overview.suggestedNextAction;
  const namedAvg = averageNamedScore(rows);
  const namedTotal =
    rows.find((row) => row.latestReport?.scoreTotal)?.latestReport?.scoreTotal ?? promptCap;
  const brandId = (clientRows[0] ?? rows[0])?.brand.id;
  const delta = rows.length === 1 ? (rows[0]?.mentionedDelta ?? null) : null;
  const topCompetitor = rows[0]?.competitorLeader ?? null;
  const sendHref = onlyBrand?.latestReport
    ? `/app/brands/${onlyBrand.brand.id}/reports/${onlyBrand.latestReport.id}`
    : "/app/brands";

  return (
    <div className="min-w-0">
      <PageHeader
        title="Home"
        subtitle={
          `${overview.movementLabel !== "unknown" ? `Brand is ${overview.movementLabel}. ` : ""}${
            readyCount > 0
              ? `${readyCount} report${readyCount === 1 ? "" : "s"} ready to send.`
              : `Continue on ${PLANS[plan].name} when you subscribe.`
          }`
        }
        actions={
          <>
            {onlyBrand?.latestReport ? (
              <Button asChild>
                <Link href={sendHref}>{allowsApproval || allowsEmailSend ? "Approve & send" : "Preview PDF"}</Link>
              </Button>
            ) : null}
            {canAddBrand ? (
              <Button asChild variant={onlyBrand?.latestReport ? "outline" : "default"}>
                <Link href="/app/onboarding?new=1">{sampleRow ? "Run this for my client" : "Add a brand"}</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/app/settings/billing">Upgrade to add a brand</Link>
              </Button>
            )}
          </>
        }
      />

      {sampleRow ? (
        <div className="mb-6 rounded-cb-card border border-cb-accent bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Sample client</p>
          <p className="mt-2 text-sm font-medium">
            {sampleRow.brand.name} already shipped last Friday
            {sampleRow.latestReport
              ? ` · named ${sampleRow.latestReport.scoreMentioned}/${sampleRow.latestReport.scoreTotal}`
              : ""}
            {sampleRow.competitorLeader ? ` · ${sampleRow.competitorLeader} won the shortlist` : ""}.
          </p>
          <p className="mt-1 text-sm text-cb-muted">Read-only demo. Add your client to run the same letter.</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {sampleRow.latestReport ? (
              <Link href={`/app/brands/${sampleRow.brand.id}/reports/${sampleRow.latestReport.id}`} className="text-cb-accent">
                Open sample PDF →
              </Link>
            ) : (
              <Link href={`/app/brands/${sampleRow.brand.id}`} className="text-cb-accent">
                Open sample →
              </Link>
            )}
            {canAddBrand ? (
              <Link href="/app/onboarding?new=1" className="text-cb-accent">
                Run this for my client →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard
          label="AI visibility"
          value={namedAvg == null ? "—" : `${namedAvg}/${namedTotal}`}
          sub={
            delta == null ? "Run first report" :
            delta > 0 ? `↑ +${delta} vs last week` :
            delta < 0 ? `↓ ${delta} vs last week` : "Flat this week"
          }
          subTone={delta == null ? "muted" : delta > 0 ? "named" : delta < 0 ? "missing" : "muted"}
          href={brandId ? `/app/brands/${brandId}` : "/app/brands"}
        />
        <KpiCard
          label="Top competitor"
          value={topCompetitor ?? "None tracked"}
          sub={topCompetitor ? "Leading against you" : "Add competitors"}
          subTone={topCompetitor ? "missing" : "muted"}
          href={brandId ? `/app/brands/${brandId}?tab=competitors` : "/app/brands"}
        />
        <KpiCard
          label="Next action"
          value={nextAction?.verb ?? (firstBrandNeedsSetup ? "Finish setup" : "—")}
          sub={nextAction?.brandName ?? PLANS[plan].name}
          subTone={nextAction ? "accent" : "muted"}
          href={nextAction?.href ?? (brandId ? `/app/brands/${brandId}` : "/app/settings/billing")}
        />
      </div>

      <div className="mb-6 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <PitchDomainForm compact />
      </div>

      {firstBrandNeedsSetup && onlyBrand ? (
        <div className="mb-6 rounded-cb-card border border-cb-accent bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Next step</p>
          <p className="mt-2 text-sm font-medium">Finish the first report</p>
          <p className="mt-1 text-sm text-cb-muted">
            Generate {promptCap} buyer questions, run the report, then open the PDF.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {onlyBrand.promptCount === 0 ? (
              <Link href={`/app/brands/${onlyBrand.brand.id}/prompts`} className="text-cb-accent">
                Generate {promptCap} prompts →
              </Link>
            ) : (
              <Link href={`/app/brands/${onlyBrand.brand.id}`} className="text-cb-accent">
                Run report →
              </Link>
            )}
            <Link href="/report" className="text-cb-muted">
              View sample
            </Link>
          </div>
        </div>
      ) : nextAction ? (
        <div className="mb-6 rounded-cb-card border border-cb-line bg-cb-surface">
          <div className="border-b border-cb-line px-4 py-3">
            <p className="text-sm font-medium">Next action</p>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{nextAction.brandName}: {nextAction.verb}</p>
              <p className="mt-0.5 truncate text-xs text-cb-muted">{nextAction.reason}</p>
            </div>
            <Link href={nextAction.href} className="shrink-0 text-sm text-cb-accent">
              Open →
            </Link>
          </div>
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">This week</h2>
          {brandId ? (
            <div className="flex gap-3 text-xs">
              <Link href={`/app/brands/${brandId}/prompts`} className="text-cb-accent">
                Prompts
              </Link>
              <Link href={`/app/brands/${brandId}?tab=competitors`} className="text-cb-accent">
                Competitors
              </Link>
            </div>
          ) : null}
        </div>
        <DataTable minWidth="760px">
          <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
            <tr className="h-12 border-b border-cb-line">
              <Th>Brand</Th>
              <Th>Owner</Th>
              <Th>Named</Th>
              <Th>Rec</Th>
              <Th>Change</Th>
              <Th>Competitor</Th>
              <Th>Pipeline</Th>
              <Th>Next</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const stage = pipelineStage(row);
              const action = weeklyAction(row, allowsEmailSend);
              return (
                <tr key={row.brand.id} className="h-12 border-b border-cb-line last:border-0">
                  <Td>
                    <Link href={`/app/brands/${row.brand.id}`} className="font-medium text-cb-text hover:text-cb-accent">
                      {row.brand.name}
                    </Link>
                  </Td>
                  <Td truncate className="text-cb-muted">
                    {row.brand.clientOwner || row.brand.buyer || "—"}
                  </Td>
                  <Td className="font-mono tabular-nums">
                    {row.latestReport
                      ? `${row.latestReport.scoreMentioned ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                      : "—"}
                  </Td>
                  <Td className="font-mono tabular-nums">
                    {row.latestReport
                      ? `${row.latestReport.scoreRecommended ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                      : "—"}
                  </Td>
                  <Td>
                    <ScoreChange delta={row.mentionedDelta} />
                  </Td>
                  <Td truncate className="text-cb-muted">
                    {row.competitorLeader || "—"}
                  </Td>
                  <Td className="text-cb-muted">{PIPELINE_LABEL[stage]}</Td>
                  <Td>
                    {action ? (
                      <Link href={action.href} className="text-cb-accent">
                        {action.verb}
                      </Link>
                    ) : (
                      <span className="text-cb-muted">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  subTone,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  subTone: "muted" | "named" | "missing" | "accent";
  href: string;
}) {
  const toneClass = {
    muted: "text-cb-muted",
    named: "text-cb-named",
    missing: "text-cb-missing",
    accent: "text-cb-accent",
  }[subTone];

  return (
    <Link
      href={href}
      className="group rounded-cb-card border border-cb-line bg-cb-surface p-4 hover:border-cb-accent"
    >
      <p className="text-[11px] uppercase tracking-wide text-cb-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl tabular-nums text-cb-text group-hover:text-cb-accent">
        {value}
      </p>
      <p className={cn("mt-1 text-xs", toneClass)}>{sub}</p>
    </Link>
  );
}
