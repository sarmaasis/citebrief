import { eq } from "drizzle-orm";
import Link from "next/link";
import { AgencySavedViews } from "@/components/app/agency-saved-views";
import { CopyRecommendation } from "@/components/app/copy-recommendation";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { OpportunityStatusControl } from "@/components/app/opportunity-status";
import { PipelineStrip } from "@/components/app/pipeline-strip";
import { PortfolioExport } from "@/components/app/portfolio-export";
import { RiskPill } from "@/components/app/risk-pill";
import { ScoreChange } from "@/components/app/score-change";
import { Button } from "@/components/ui/button";
import { workspaces } from "@/db/schema";
import { PIPELINE_LABEL, pipelineCounts, pipelineStage, weeklyAction } from "@/lib/command-center";
import { parseAgencySavedView } from "@/lib/dashboard-metrics";
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
    const rows = withSendOverdue(await listHomeRows(ctx), {
      timezone: workspace?.timezone || "America/New_York",
      weekly: ent.allowsWeeklyCadence,
    });
    const dash = await buildDashboardSnapshot(ctx, ent);
    return (
      <LightHome
        rows={rows}
        overview={dash.overview}
        allowsEmailSend={ent.allowsEmailSend}
        promptCap={ent.promptCap}
        canAddBrand={rows.length < ent.brandLimit}
        showRechecks={dash.modules.recheckCreditVisibility}
      />
    );
  }

  const snapshot = await buildCommandCenterSnapshot(ctx, ent, {}, { view: savedView });
  const dash = await buildDashboardSnapshot(ctx, ent, { view: savedView });
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
            "Generate 20 buyer questions",
            "Run the first report on ChatGPT + Gemini",
          ]}
        />
      </div>
    );
  }

  const onlyBrand = snapshot.unfilteredCount === 1 && snapshot.rows.length === 1 ? snapshot.rows[0] : null;
  const firstBrandNeedsSetup = Boolean(onlyBrand && !onlyBrand.latestReport);
  const nextAction = dash.overview.suggestedNextAction ?? snapshot.actions[0] ?? null;
  const ov = dash.overview;
  const canAddBrand = snapshot.unfilteredCount < ent.brandLimit;
  const opportunityItems = dash.opportunities;
  const riskItems = dash.risks;

  return (
    <div className="min-w-0">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-cb-muted">
            Are we improving, who is winning, what changed, and what to do next.
            {ov.movementLabel !== "unknown" ? ` Portfolio is ${ov.movementLabel}.` : ""}
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
        <AgencySavedViews active={savedView} basePath="/app" paramKey="view" />
      </div>

      {nextAction ? (
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

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="AI visibility" value={ov.visibilityScore == null ? "—" : String(ov.visibilityScore)} />
        <Stat
          label="Movement"
          value={ov.movement == null ? "—" : ov.movement > 0 ? `+${ov.movement}` : String(ov.movement)}
        />
        <Stat label="Brands" value={String(ov.brandsMonitored)} href="/app/brands" />
        <Stat label="Prompts tracked" value={String(ov.promptsTracked)} href="/app/prompts" />
        <Stat label="Engines" value={String(ov.enginesMonitored)} href="/app/competitors" />
        <Stat label="Competitor wins" value={String(ov.competitorMentions)} href="/app/competitors" />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="At risk" value={String(ov.activeRisks)} href="/app/risks" />
        <Stat label="Opportunities" value={String(ov.openOpportunities)} href="/app/opportunities" />
        <Stat label="Reports ready" value={String(snapshot.kpis.reportsReady)} href="/app/reports" />
        <Stat label="Reports sent" value={String(snapshot.kpis.reportsSent)} href="/app/reports?sent=1" />
        <Stat
          label="Run success"
          value={ov.runSuccessRate == null ? "—" : `${ov.runSuccessRate}%`}
        />
        <Stat
          label={dash.modules.recheckCreditVisibility ? "Rechecks left" : "Failed / partial"}
          value={
            dash.modules.recheckCreditVisibility
              ? String(ov.recheckCreditsRemaining)
              : String(snapshot.kpis.failedOrPartial)
          }
          href={dash.modules.recheckCreditVisibility ? "/app/settings/billing" : undefined}
        />
      </div>
      <div className="mb-8">
        <PipelineStrip pipeline={snapshot.pipeline} />
      </div>

      {firstBrandNeedsSetup && onlyBrand ? (
        <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-sm font-medium">Finish the first report</p>
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
      ) : null}

      {snapshot.actions.length ? (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">This week’s actions</h2>
            <Link href="/app/reports" className="text-xs text-cb-accent">
              Send queue
            </Link>
          </div>
          <DataTable minWidth="560px">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <Th>Brand</Th>
                <Th>Action</Th>
                <Th>Why</Th>
              </tr>
            </thead>
            <tbody>
              {snapshot.actions.map((item) => (
                <tr key={`${item.brandId}-${item.verb}`} className="h-12 border-b border-cb-line last:border-0">
                  <Td>
                    <Link href={`/app/brands/${item.brandId}`} className="text-cb-accent">
                      {item.brandName}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={item.href} className="text-cb-accent">
                      {item.verb}
                    </Link>
                  </Td>
                  <Td truncate className="text-cb-muted">
                    {item.reason}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>
      ) : null}

      {riskItems.length ? (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Client risk</h2>
            <Link href="/app/risks" className="text-xs text-cb-accent">
              All risks
            </Link>
          </div>
          <DataTable minWidth="720px">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <Th>Brand</Th>
                <Th>Risk</Th>
                <Th>Why</Th>
                <Th>First seen</Th>
                <Th>Affected</Th>
              </tr>
            </thead>
            <tbody>
              {riskItems.map((item) => (
                <tr key={item.brandId} className="h-12 border-b border-cb-line last:border-0">
                  <Td>
                    <Link href={`/app/brands/${item.brandId}`} className="text-cb-accent">
                      {item.brandName}
                    </Link>
                  </Td>
                  <Td>
                    <RiskPill risk={item.severity} />
                  </Td>
                  <Td truncate className="text-cb-muted">
                    {item.whatHappened}
                  </Td>
                  <Td className="text-xs text-cb-muted">
                    {item.firstSeenAt ? item.firstSeenAt.slice(0, 10) : "—"}
                  </Td>
                  <Td truncate className="text-xs text-cb-muted">
                    {[item.affectedEngines.join(", "), item.affectedPrompts[0]].filter(Boolean).join(" · ") ||
                      "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>
      ) : null}

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Revenue opportunities</h2>
          <Link href="/app/opportunities" className="text-xs text-cb-accent">
            All opportunities
          </Link>
        </div>
        {opportunityItems.length === 0 ? (
          <p className="text-sm text-cb-muted">
            No comparison gaps or visibility drops in the latest reports. Review a report to find the next piece of
            work.
          </p>
        ) : (
          <div className="grid gap-4">
            {opportunityItems.map((item) => (
              <article key={`${item.brandId}-${item.key}`} className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{item.brandName}</p>
                  <p className="text-xs text-cb-muted">
                    {item.impact} · {item.effort}
                  </p>
                </div>
                <p className="mt-2 text-sm text-cb-text">
                  {item.title} · {item.suggestedAction}
                </p>
                <p className="mt-2 text-sm text-cb-muted">{item.reason}</p>
                {item.relatedPrompt || item.relatedEngine ? (
                  <p className="mt-2 text-xs text-cb-muted">
                    {item.relatedEngine ? `${item.relatedEngine} · ` : ""}
                    {item.relatedPrompt || ""}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link href={item.href} className="text-sm text-cb-accent">
                    Open report
                  </Link>
                  <CopyRecommendation text={`${item.title}: ${item.suggestedAction}. ${item.reason}`} />
                  <OpportunityStatusControl
                    brandId={item.brandId}
                    reportId={item.reportId}
                    opportunityKey={item.key}
                    status={item.status}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium">Agency ROI</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Brands monitored" value={String(snapshot.roi.brands)} />
          <Stat label="Reports generated" value={String(snapshot.roi.reportsGenerated)} />
          <Stat label="Reports sent" value={String(snapshot.roi.reportsSent)} />
          <Stat label="Opportunities" value={String(snapshot.roi.opportunities)} />
          <Stat label="Est. hours saved" value={String(snapshot.roi.hoursSaved)} />
        </div>
        <p className="mt-2 text-xs text-cb-muted">
          Hours saved uses {snapshot.minutesSavedPerReport} minutes per generated report (45–90, set in workspace
          settings).
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">This week</h2>
          <Link href="/app/brands" className="text-xs text-cb-accent">
            Brand scorecards
          </Link>
        </div>
        {dash.rows.length === 0 ? (
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
              {dash.rows.map((row) => (
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
  promptCap,
  canAddBrand,
  showRechecks,
}: {
  rows: Awaited<ReturnType<typeof listHomeRows>>;
  overview: Awaited<ReturnType<typeof buildDashboardSnapshot>>["overview"];
  allowsEmailSend: boolean;
  promptCap: number;
  canAddBrand: boolean;
  showRechecks: boolean;
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

  const pipeline = pipelineCounts(rows);
  const reportsGenerated = rows.filter((row) => Boolean(row.latestReport)).length;
  const onlyBrand = rows.length === 1 ? rows[0] : null;
  const firstBrandNeedsSetup = Boolean(onlyBrand && !onlyBrand.latestReport);
  const actions = rows
    .map((row) => weeklyAction(row, allowsEmailSend))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const nextAction = overview.suggestedNextAction;

  return (
    <div className="min-w-0">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-cb-muted">
            Are we improving, who is winning, what changed, and what to do next.
            {overview.movementLabel !== "unknown" ? ` Brand is ${overview.movementLabel}.` : ""} Agency unlocks
            multi-client risk and opportunity rollups.
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

      {nextAction ? (
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

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="AI visibility" value={overview.visibilityScore == null ? "—" : String(overview.visibilityScore)} />
        <Stat
          label="Movement"
          value={
            overview.movement == null ? "—" : overview.movement > 0 ? `+${overview.movement}` : String(overview.movement)
          }
        />
        <Stat label="Brands" value={String(overview.brandsMonitored)} href="/app/brands" />
        <Stat label="Prompts tracked" value={String(overview.promptsTracked)} href="/app/prompts" />
        <Stat label="Engines" value={String(overview.enginesMonitored)} href="/app/competitors" />
        <Stat label="Competitor wins" value={String(overview.competitorMentions)} href="/app/competitors" />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Opportunities" value={String(overview.openOpportunities)} href="/app/opportunities" />
        <Stat
          label={allowsEmailSend ? "Needs send" : "Reports ready"}
          value={String(allowsEmailSend ? pipeline.needs_review : reportsGenerated)}
        />
        <Stat label="Latest status" value={overview.latestReportStatus || "—"} />
        <Stat
          label="Run success"
          value={overview.runSuccessRate == null ? "—" : `${overview.runSuccessRate}%`}
        />
        <Stat
          label={showRechecks ? "Rechecks left" : "Runs this week"}
          value={
            showRechecks
              ? String(overview.recheckCreditsRemaining)
              : String(rows.filter((row) => row.latestRun && row.latestRun.status !== "failed").length)
          }
          href={showRechecks ? "/app/settings/billing" : undefined}
        />
      </div>

      {firstBrandNeedsSetup && onlyBrand ? (
        <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-sm font-medium">Finish the first report</p>
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
      ) : null}

      {actions.length ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium">This week’s actions</h2>
          <DataTable minWidth="560px">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <Th>Brand</Th>
                <Th>Action</Th>
                <Th>Why</Th>
              </tr>
            </thead>
            <tbody>
              {actions.map((item) => (
                <tr key={`${item.brandId}-${item.verb}`} className="h-12 border-b border-cb-line last:border-0">
                  <Td>
                    <Link href={`/app/brands/${item.brandId}`} className="text-cb-accent">
                      {item.brandName}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={item.href} className="text-cb-accent">
                      {item.verb}
                    </Link>
                  </Td>
                  <Td truncate className="text-cb-muted">
                    {item.reason}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">This week</h2>
          <div className="flex gap-3 text-xs">
            <Link href="/app/prompts" className="text-cb-accent">
              Prompt performance
            </Link>
            <Link href="/app/competitors" className="text-cb-accent">
              Competitors
            </Link>
          </div>
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

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <>
      <p className="text-xs text-cb-muted">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums">{value}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="rounded-cb-card border border-cb-line bg-cb-surface px-4 py-3 hover:border-cb-accent">
        {inner}
      </Link>
    );
  }
  return <div className="rounded-cb-card border border-cb-line bg-cb-surface px-4 py-3">{inner}</div>;
}
