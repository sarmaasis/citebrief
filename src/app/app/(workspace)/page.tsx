import { eq } from "drizzle-orm";
import Link from "next/link";
import { AgencySavedViews } from "@/components/app/agency-saved-views";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
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
import { buildCommandCenterSnapshot } from "@/server/command-center-data";
import { buildDashboardSnapshot } from "@/server/dashboard-data";
import { listHomeRows, withSendOverdue } from "@/server/workspace-data";

export default async function AppHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Overview</h1>
        <EmptyState line="Sign in to start the first Friday report." cta="Sign in" href="/login" />
      </div>
    );
  }

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
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Overview</h1>
        <EmptyState
          title="No brands yet"
          line="Add a brand, generate buyer questions, and run the first Friday report — Overview fills in from stored answers."
          cta="Add a brand"
          href="/app/onboarding"
          steps={[
            "Add your brand and category context",
            `Generate ${ent.promptCap} buyer questions`,
            "Run the first report on ChatGPT + Gemini",
          ]}
        />
      </div>
    );
  }

  const onlyBrand = snapshot.unfilteredCount === 1 && snapshot.rows.length === 1 ? snapshot.rows[0] : null;
  const firstBrandNeedsSetup = Boolean(onlyBrand && !onlyBrand.latestReport);
  const nextAction = snapshot.actions[0] ?? null;
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

  return (
    <div className="min-w-0">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-cb-muted">
            Are we improving, who is winning, what changed, and what to do next.
            {portfolioMovement !== "unknown" ? ` Portfolio is ${portfolioMovement}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ent.allowsPortfolioExport ? <PortfolioExport /> : null}
          {canAddBrand ? (
            <Button asChild>
              <Link href="/app/onboarding?new=1">Add a brand</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/app/settings/billing">Upgrade to add a brand</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mb-8">
        <WorkspaceCapacityStrip
          plan={ent.plan}
          brandsUsed={snapshot.unfilteredCount}
          brandLimit={ent.brandLimit}
          promptCap={ent.promptCap}
          monthlyRecheckCredits={ent.monthlyRecheckCredits}
          weekly={ent.allowsWeeklyCadence}
        />
      </div>

      <div className="mb-8">
        <p className="font-mono text-[40px] leading-none tabular-nums text-cb-accent">
          {namedAvg == null ? "—" : `${namedAvg}/${namedTotal}`}
        </p>
        <p className="mt-3 text-sm text-cb-muted">
          {namedAvg == null
            ? "Named scores appear after the first report."
            : `Named in ${namedAvg}/${namedTotal} questions this week`}
        </p>
      </div>

      {firstBrandNeedsSetup && onlyBrand ? (
        <div className="mb-8 rounded-cb-card border border-cb-accent bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Suggested next action</p>
          <p className="mt-2 text-sm font-medium">Finish the first report</p>
          <p className="mt-1 text-sm text-cb-muted">
            Generate {ent.promptCap} buyer questions, run the report, then open the PDF.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {onlyBrand.promptCount === 0 ? (
              <Link href={`/app/brands/${onlyBrand.brand.id}/prompts`} className="text-cb-accent">
                Generate {ent.promptCap} prompts
              </Link>
            ) : (
              <Link href={`/app/brands/${onlyBrand.brand.id}`} className="text-cb-accent">
                Run report
              </Link>
            )}
            <Link href="/report" className="text-cb-accent">
              View sample
            </Link>
          </div>
        </div>
      ) : nextAction ? (
        <div className="mb-8 rounded-cb-card border border-cb-accent bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Suggested next action</p>
          <p className="mt-2 text-sm font-medium">
            {nextAction.brandName}: {nextAction.verb}
          </p>
          <p className="mt-1 text-sm text-cb-muted">{nextAction.reason}</p>
          <Link href={nextAction.href} className="mt-3 inline-block text-sm text-cb-accent">
            Open
          </Link>
        </div>
      ) : null}

      <div className="mb-8">
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
                <tr key={row.brand.id} className="h-12 border-b border-cb-line last:border-0">
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
  plan: keyof typeof PLANS;
  brandLimit: number;
  promptCap: number;
  monthlyRecheckCredits: number;
  weekly: boolean;
  canAddBrand: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Overview</h1>
        <EmptyState
          title="No brands yet"
          line="Trial and Starter start here: add one brand, generate prompts, and run the first report."
          cta="Add a brand"
          href="/app/onboarding"
          secondaryCta="See plans"
          secondaryHref="/app/settings/billing"
          steps={["Add a brand", "Generate prompts", "Run ChatGPT + Gemini"]}
        />
      </div>
    );
  }

  const onlyBrand = rows.length === 1 ? rows[0] : null;
  const firstBrandNeedsSetup = Boolean(onlyBrand && !onlyBrand.latestReport);
  const nextAction = overview.suggestedNextAction;
  const namedAvg = averageNamedScore(rows);
  const namedTotal =
    rows.find((row) => row.latestReport?.scoreTotal)?.latestReport?.scoreTotal ?? promptCap;
  const brandId = rows[0]?.brand.id;

  return (
    <div className="min-w-0">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-cb-muted">
            Are we improving, who is winning, what changed, and what to do next.
            {overview.movementLabel !== "unknown" ? ` Brand is ${overview.movementLabel}.` : ""} Growth unlocks
            weekly trend depth; Agency adds multi-client white-label workflows.
          </p>
        </div>
        {canAddBrand ? (
          <Button asChild>
            <Link href="/app/onboarding?new=1">Add a brand</Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/app/settings/billing">Upgrade to add a brand</Link>
          </Button>
        )}
      </div>

      <div className="mb-8">
        <WorkspaceCapacityStrip
          plan={plan}
          brandsUsed={rows.length}
          brandLimit={brandLimit}
          promptCap={promptCap}
          monthlyRecheckCredits={monthlyRecheckCredits}
          weekly={weekly}
        />
      </div>

      <div className="mb-8">
        <p className="font-mono text-[40px] leading-none tabular-nums text-cb-accent">
          {namedAvg == null ? "—" : `${namedAvg}/${namedTotal}`}
        </p>
        <p className="mt-3 text-sm text-cb-muted">
          {namedAvg == null
            ? "Named scores appear after the first report."
            : `Named in ${namedAvg}/${namedTotal} questions this week`}
        </p>
      </div>

      {firstBrandNeedsSetup && onlyBrand ? (
        <div className="mb-8 rounded-cb-card border border-cb-accent bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Suggested next action</p>
          <p className="mt-2 text-sm font-medium">Finish the first report</p>
          <p className="mt-1 text-sm text-cb-muted">
            Generate {promptCap} buyer questions, run the report, then open the PDF.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {onlyBrand.promptCount === 0 ? (
              <Link href={`/app/brands/${onlyBrand.brand.id}/prompts`} className="text-cb-accent">
                Generate {promptCap} prompts
              </Link>
            ) : (
              <Link href={`/app/brands/${onlyBrand.brand.id}`} className="text-cb-accent">
                Run report
              </Link>
            )}
            <Link href="/report" className="text-cb-accent">
              View sample
            </Link>
          </div>
        </div>
      ) : nextAction ? (
        <div className="mb-8 rounded-cb-card border border-cb-accent bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Suggested next action</p>
          <p className="mt-2 text-sm font-medium">
            {nextAction.brandName}: {nextAction.verb}
          </p>
          <p className="mt-1 text-sm text-cb-muted">{nextAction.reason}</p>
          <Link href={nextAction.href} className="mt-3 inline-block text-sm text-cb-accent">
            Open
          </Link>
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

function WorkspaceCapacityStrip({
  plan,
  brandsUsed,
  brandLimit,
  promptCap,
  monthlyRecheckCredits,
  weekly,
}: {
  plan: keyof typeof PLANS;
  brandsUsed: number;
  brandLimit: number;
  promptCap: number;
  monthlyRecheckCredits: number;
  weekly: boolean;
}) {
  const questionCapacity = brandLimit * promptCap;
  const questionUsed = Math.min(brandsUsed * promptCap, questionCapacity);
  const items = [
    ["Plan", PLANS[plan].name],
    ["Brands", `${brandsUsed}/${brandLimit}`],
    ["Tracked questions", `${questionUsed}/${questionCapacity}`],
    ["Cadence", weekly ? "Weekly" : "Monthly"],
    ["Rechecks", `${monthlyRecheckCredits}/mo`],
  ];

  return (
    <section className="rounded-cb-card border border-cb-line bg-cb-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Workspace capacity</p>
          <p className="mt-1 text-xs text-cb-muted">
            Capacity is based on active brands and buyer questions per brand. Cited pages, alerts, and export modules are coming soon.
          </p>
        </div>
        <Link href="/app/settings/billing" className="text-xs text-cb-accent">
          Manage plan
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        {items.map(([label, value]) => (
          <div key={label} className="border-t border-cb-line pt-3 sm:border-t-0 sm:pt-0">
            <p className="text-[11px] uppercase text-cb-muted">{label}</p>
            <p className="mt-1 font-mono text-sm tabular-nums text-cb-text">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
