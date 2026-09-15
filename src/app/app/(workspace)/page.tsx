import { eq } from "drizzle-orm";
import Link from "next/link";
import { AgencySavedViews } from "@/components/app/agency-saved-views";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PortfolioExport } from "@/components/app/portfolio-export";
import { PortfolioFilters } from "@/components/app/portfolio-filters";
import { ScoreChange } from "@/components/app/score-change";
import { PitchDomainForm } from "@/components/brands/pitch-domain-form";
import { Button } from "@/components/ui/button";
import { workspaces } from "@/db/schema";
import { isSampleBrand } from "@/lib/brand-kind";
import { PLANS, MONTHLY_RECHECK_CREDITS, type PlanId } from "@/lib/billing";
import { PIPELINE_LABEL, averageNamedScore, pageFilters, pipelineStage, weeklyAction } from "@/lib/command-center";
import { parseAgencySavedView } from "@/lib/dashboard-metrics";
import { AGENCY_ENGINE_IDS, parseEngineStatus, type EngineId } from "@/lib/engines";
import { workspaceEntitlements } from "@/lib/entitlements";
import { nextScheduledRunAt } from "@/lib/friday-tz";
import { ensureSampleBrand } from "@/lib/sample-workspace";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { buildCommandCenterSnapshot } from "@/server/command-center-data";
import { buildDashboardSnapshot } from "@/server/dashboard-data";
import { listHomeRows, withSendOverdue } from "@/server/workspace-data";

function showCommandHome(ent: ReturnType<typeof workspaceEntitlements>) {
  return ent.allowsCommandCenter || (ent.trialing && ent.plan !== "starter");
}

function formatNextFridayLabel(at: Date | null, timezone: string) {
  if (!at) return "next Friday";
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
  return `next Friday ${time} ${timezone}`;
}

function EngineDots({ engineStates }: { engineStates: string | null | undefined }) {
  const states = parseEngineStatus(engineStates);
  return (
    <span className="inline-flex items-center gap-1" aria-label="Engines">
      {AGENCY_ENGINE_IDS.map((id) => {
        const state = states[id as EngineId];
        const tone =
          state === "complete"
            ? "bg-cb-named"
            : state === "failed"
              ? "bg-cb-missing"
              : state === "running" || state === "queued"
                ? "bg-cb-pending"
                : "bg-cb-line";
        return <span key={id} className={cn("h-1.5 w-1.5 rounded-full", tone)} title={`${id}: ${state}`} />;
      })}
    </span>
  );
}

export default async function AppHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; owner?: string; risk?: string; brandId?: string; stage?: string; sent?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return (
      <div>
        <PageHeader title="This week" subtitle="Sign in to start the first Friday report." />
        <EmptyState line="Sign in to start the first Friday report." cta="Sign in" href="/login" />
      </div>
    );
  }

  await ensureSampleBrand(ctx.db, ctx.workspace.id);

  const params = (await searchParams) ?? {};
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const savedView = parseAgencySavedView(params.view);
  const commandHome = showCommandHome(ent);

  if (!commandHome) {
    const [workspace] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, ctx.workspace.id)).limit(1);
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
        canAddBrand={rows.filter((r) => !isSampleBrand(r.brand.kind)).length < ent.brandLimit}
        timezone={workspace?.timezone || "America/New_York"}
        trialing={ent.trialing}
        paid={ent.paid}
      />
    );
  }

  const filters = pageFilters(params);
  const snapshot = await buildCommandCenterSnapshot(ctx, ent, filters, { view: savedView });
  const timezone = snapshot.timezone || "America/New_York";
  const nextAt = nextScheduledRunAt({
    timezone,
    weekly: ent.allowsWeeklyCadence || (ent.trialing && ent.plan !== "starter"),
  });
  const fridayLabel = formatNextFridayLabel(nextAt, timezone);

  if (snapshot.unfilteredCount === 0) {
    return (
      <div>
        <PageHeader title="This week" subtitle={`Add a client · ${fridayLabel}`} />
        <EmptyState
          title="No clients yet"
          line="Add a client, generate buyer questions, and run the first Friday brief."
          cta="Add client"
          href="/app/onboarding"
          steps={[
            "Add your client and category context",
            `Generate ${ent.promptCap} buyer questions`,
            "Run the first brief on four AI surfaces",
          ]}
        />
        <div className="mt-8 max-w-md rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="mb-3 text-sm font-medium">48h pitch audit</p>
          <PitchDomainForm />
          <p className="mt-3 text-xs text-cb-muted">
            Or open{" "}
            <Link href="/app/onboarding?kind=pitch" className="text-cb-accent">
              pitch onboarding
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const canAddBrand = snapshot.unfilteredCount < ent.brandLimit;
  const namedAvg = snapshot.kpis.portfolioVisibility;
  const namedTotal =
    snapshot.rows.find((row) => row.latestReport?.scoreTotal)?.latestReport?.scoreTotal ?? 20;
  const deltas = snapshot.rows.map((row) => row.mentionedDelta).filter((d): d is number => d != null);
  const movement =
    deltas.length === 0 ? null : Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;

  const competitorTally = new Map<string, number>();
  for (const row of snapshot.rows) {
    if (row.competitorLeader) {
      competitorTally.set(row.competitorLeader, (competitorTally.get(row.competitorLeader) ?? 0) + 1);
    }
  }
  const topCompetitor = [...competitorTally.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const readyRows = snapshot.rows.filter(
    (row) =>
      row.latestReport &&
      !row.latestReport.sentAt &&
      (row.pipeline === "needs_review" || row.pipeline === "ready_to_send"),
  );
  const sampleOnHome = snapshot.rows.find((row) => isSampleBrand(row.brand.kind));

  const owners = [
    ...new Set(snapshot.rows.map((row) => row.brand.clientOwner).filter((v): v is string => Boolean(v))),
  ].sort();
  const brands = snapshot.rows.map((row) => ({ id: row.brand.id, name: row.brand.name }));
  const planName = PLANS[ent.plan].name;
  const primaryReady = snapshot.kpis.reportsReady > 0;
  const approveHref =
    ent.allowsWeeklySendQueue || readyRows.length === 0
      ? "/app/reports"
      : `/app/brands/${readyRows[0]!.brand.id}/reports/${readyRows[0]!.latestReport!.id}`;

  return (
    <div className="min-w-0">
      <PageHeader
        title="This week"
        subtitle={`${snapshot.kpis.reportsReady} brief${snapshot.kpis.reportsReady === 1 ? "" : "s"} ready · ${fridayLabel}`}
        actions={
          <>
            {primaryReady ? (
              <Button asChild>
                <Link href={approveHref}>{ent.allowsEmailSend ? "Approve & send" : "Preview PDF"}</Link>
              </Button>
            ) : canAddBrand ? (
              <Button asChild>
                <Link href="/app/onboarding?new=1">Add client</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/app/brands">Run brief</Link>
              </Button>
            )}
            {ent.allowsPortfolioExport ? <PortfolioExport /> : null}
            {!primaryReady && canAddBrand ? null : canAddBrand ? (
              <Button asChild variant="outline">
                <Link href="/app/onboarding?new=1">Add client</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/app/settings/billing">Upgrade to add a client</Link>
              </Button>
            )}
          </>
        }
      />

      {sampleOnHome ? (
        <div className="mb-6 rounded-cb-card border border-cb-accent bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Sample client</p>
          <p className="mt-2 text-sm font-medium">
            {sampleOnHome.brand.name} already shipped last Friday
            {sampleOnHome.latestReport
              ? ` · named ${sampleOnHome.latestReport.scoreMentioned}/${sampleOnHome.latestReport.scoreTotal}`
              : ""}
            {sampleOnHome.competitorLeader ? ` · ${sampleOnHome.competitorLeader} won the shortlist` : ""}.
          </p>
          <p className="mt-1 text-sm text-cb-muted">Read-only demo. Add your client to run the same letter.</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {sampleOnHome.latestReport ? (
              <Link
                href={`/app/brands/${sampleOnHome.brand.id}/reports/${sampleOnHome.latestReport.id}`}
                className="text-cb-accent"
              >
                Open sample PDF →
              </Link>
            ) : (
              <Link href={`/app/brands/${sampleOnHome.brand.id}`} className="text-cb-accent">
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

      {/* Zone A — Ready to send (trial: Preview / Copy / Download + upgrade; Send is paid) */}
      {readyRows.length > 0 ? (
        <section className="mb-6 rounded-cb-card border border-cb-line bg-cb-surface">
          <div className="flex items-center justify-between border-b border-cb-line px-4 py-3">
            <p className="text-sm font-medium">Ready to send</p>
            <span className="text-xs text-cb-muted">{readyRows.length}</span>
          </div>
          <ul>
            {readyRows.slice(0, 8).map((row) => {
              const reportId = row.latestReport!.id;
              const share = row.latestReport?.shareToken;
              return (
                <li
                  key={row.brand.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-cb-line px-4 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.brand.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-cb-muted">
                      <span>
                        Named {row.latestReport?.scoreMentioned ?? "—"}/{row.latestReport?.scoreTotal ?? "—"}
                      </span>
                      {row.mentionedDelta != null ? <ScoreChange delta={row.mentionedDelta} /> : null}
                      {row.competitorLeader ? <span>Who won: {row.competitorLeader}</span> : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <Link href={`/app/brands/${row.brand.id}/reports/${reportId}`} className="text-cb-accent">
                      Preview PDF
                    </Link>
                    {share ? (
                      <CopyLinkButton href={`/r/${share}`} className="text-cb-accent" />
                    ) : null}
                    <a href={`/api/reports/${reportId}/download`} className="text-cb-accent">
                      Download
                    </a>
                    {ent.allowsEmailSend ? (
                      <Link href={`/app/brands/${row.brand.id}/reports/${reportId}`} className="text-cb-accent">
                        Send
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {!ent.allowsEmailSend ? (
            <p className="border-t border-cb-line px-4 py-3 text-sm text-cb-muted">
              Weekly email send unlocks when you subscribe.{" "}
              <Link href="/app/settings/billing" className="text-cb-accent">
                Upgrade
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="mb-4">
        <PortfolioFilters fields={["stage", "owner", "risk", "brandId", "sent"]} owners={owners} brands={brands} />
      </div>

      {/* Zone B — Four KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Ready to send"
          value={String(snapshot.kpis.reportsReady)}
          sub={
            snapshot.kpis.reportsReady > 0
              ? ent.allowsEmailSend
                ? "Approve & send"
                : "Preview ready"
              : "Nothing waiting"
          }
          subTone={snapshot.kpis.reportsReady > 0 ? "accent" : "muted"}
          href={ent.allowsWeeklySendQueue ? "/app/reports" : approveHref}
        />
        <KpiCard
          label="Named"
          value={namedAvg == null ? "—" : `${namedAvg}/${namedTotal}`}
          sub={
            movement == null
              ? "Unbranded only"
              : movement > 0
                ? `↑ +${movement} vs last week`
                : movement < 0
                  ? `↓ ${movement} vs last week`
                  : "Flat this week"
          }
          subTone={movement == null ? "muted" : movement > 0 ? "named" : movement < 0 ? "missing" : "muted"}
          href="/app/brands"
        />
        <KpiCard
          label="At risk"
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

      {snapshot.kpis.failedOrPartial > 0 ? (
        <div className="mb-6">
          <Link
            href="/app/reports"
            className="inline-flex items-center gap-2 rounded-cb-control border border-cb-line bg-cb-surface px-3 py-2 text-sm text-cb-missing"
          >
            {snapshot.kpis.failedOrPartial} run{snapshot.kpis.failedOrPartial === 1 ? "" : "s"} failed — retry
          </Link>
        </div>
      ) : null}

      <div className="mb-6">
        <AgencySavedViews active={savedView} basePath="/app" paramKey="view" />
      </div>

      {/* Zone C — Clients this week */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Clients this week</h2>
          <Link href="/app/brands" className="text-xs text-cb-accent">
            All clients
          </Link>
        </div>
        {snapshot.rows.length === 0 ? (
          <p className="text-sm text-cb-muted">No clients in this filter.</p>
        ) : (
          <DataTable minWidth="960px">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <Th>Client</Th>
                <Th>Named</Th>
                <Th>Rec</Th>
                <Th>Δ</Th>
                <Th>Who won</Th>
                <Th>Pipeline</Th>
                <Th>Engines</Th>
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
                    <EngineDots engineStates={row.latestRun?.engineStates} />
                  </Td>
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

      {/* Zone D — Competitors / At risk / Actions */}
      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Competitors</h2>
            <Link href="/app/competitors" className="text-xs text-cb-accent">
              Open
            </Link>
          </div>
          {topCompetitor ? (
            <p className="mt-3 text-sm text-cb-muted">
              {topCompetitor[0]} leads on {topCompetitor[1]} client{topCompetitor[1] === 1 ? "" : "s"}.
            </p>
          ) : (
            <p className="mt-3 text-sm text-cb-muted">
              Competitor intelligence fills after Friday answers — who AI names and which pages get cited.
            </p>
          )}
        </div>
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">At risk</h2>
            <Link href="/app/risks" className="text-xs text-cb-accent">
              Open
            </Link>
          </div>
          {snapshot.risks.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {snapshot.risks.slice(0, 3).map((risk) => (
                <li key={risk.brandId}>
                  <Link href={risk.href} className="text-cb-accent">
                    {risk.brandName}
                  </Link>
                  <span className="text-cb-muted"> — {risk.why}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-cb-muted">
              Risk flags appear when named score drops, send is overdue, or a rival owns the shortlist.
            </p>
          )}
        </div>
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Actions</h2>
            <Link href="/app/opportunities" className="text-xs text-cb-accent">
              Open
            </Link>
          </div>
          {snapshot.actions.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {snapshot.actions.slice(0, 3).map((action, i) => (
                <li key={i}>
                  <Link href={action.href} className="text-cb-accent">
                    {action.brandName}: {action.verb}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-cb-muted">
              Recommended next actions and content fixes show here after the first scored brief.
            </p>
          )}
        </div>
      </section>

      {/* Zone E — plan strip */}
      <footer className="rounded-cb-card border border-cb-line bg-cb-surface px-4 py-3 text-sm text-cb-muted">
        <Link href="/app/settings/billing" className="text-cb-text hover:text-cb-accent">
          {planName}
        </Link>
        {" · "}
        {snapshot.unfilteredCount}/{ent.brandLimit} clients
        {" · "}
        {ent.monthlyRecheckCredits} rechecks/mo
        {" · "}
        {fridayLabel}
        {ent.trialing || !ent.paid ? (
          <>
            {" · "}
            <Link href="/app/settings/billing" className="text-cb-accent">
              Upgrade
            </Link>
          </>
        ) : null}
      </footer>

      <div className="mt-6 max-w-md">
        <p className="mb-2 text-sm font-medium">48h pitch audit</p>
        <Link href="/app/onboarding?kind=pitch" className="text-sm text-cb-accent">
          Pitch a domain →
        </Link>
      </div>
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
  timezone,
  trialing,
  paid,
}: {
  rows: Awaited<ReturnType<typeof listHomeRows>>;
  overview: Awaited<ReturnType<typeof buildDashboardSnapshot>>["overview"];
  allowsEmailSend: boolean;
  allowsApproval: boolean;
  plan: PlanId;
  brandLimit: number;
  promptCap: number;
  monthlyRecheckCredits: number;
  weekly: boolean;
  canAddBrand: boolean;
  timezone: string;
  trialing: boolean;
  paid: boolean;
}) {
  void allowsApproval;
  void brandLimit;
  const sampleRow = rows.find((row) => isSampleBrand(row.brand.kind));
  const clientRows = rows.filter((row) => !isSampleBrand(row.brand.kind));
  const nextAt = nextScheduledRunAt({ timezone, weekly });
  const fridayLabel = formatNextFridayLabel(nextAt, timezone);
  const readyCount = clientRows.filter((row) => row.latestReport && !row.latestReport.sentAt).length;

  if (rows.length === 0) {
    return (
      <div>
        <PageHeader title="This week" subtitle={`Add a client · ${fridayLabel}`} />
        <EmptyState
          title="No clients yet"
          line="Add a client, generate buyer questions, and run the first brief."
          cta="Add client"
          href="/app/onboarding"
          secondaryCta="See plans"
          secondaryHref="/app/settings/billing"
          steps={["Add a client", "Generate prompts", "Run all four engines"]}
        />
        <div className="mt-8 max-w-md rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="mb-3 text-sm font-medium">48h pitch audit</p>
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
  const downloadHref =
    onlyBrand?.latestReport != null ? `/api/reports/${onlyBrand.latestReport.id}/download` : null;
  const previewHref = onlyBrand?.latestReport
    ? `/app/brands/${onlyBrand.brand.id}/reports/${onlyBrand.latestReport.id}`
    : null;

  return (
    <div className="min-w-0">
      <PageHeader
        title="This week"
        subtitle={
          readyCount > 0
            ? `${readyCount} brief${readyCount === 1 ? "" : "s"} ready · ${fridayLabel}`
            : `${fridayLabel} · Continue on ${PLANS[plan].name} when you subscribe.`
        }
        actions={
          <>
            {downloadHref ? (
              <Button asChild>
                <a href={downloadHref}>Download PDF</a>
              </Button>
            ) : previewHref ? (
              <Button asChild>
                <Link href={previewHref}>Preview PDF</Link>
              </Button>
            ) : null}
            {canAddBrand ? (
              <Button asChild variant={downloadHref || previewHref ? "outline" : "default"}>
                <Link href="/app/onboarding?new=1">{sampleRow ? "Run this for my client" : "Add client"}</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/app/settings/billing">Upgrade</Link>
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

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Ready to send"
          value={String(readyCount)}
          sub="Starter: download PDF"
          subTone={readyCount > 0 ? "accent" : "muted"}
          href={previewHref ?? "/app/brands"}
        />
        <KpiCard
          label="Named"
          value={namedAvg == null ? "—" : `${namedAvg}/${namedTotal}`}
          sub={
            delta == null
              ? "Unbranded only"
              : delta > 0
                ? `↑ +${delta} vs last week`
                : delta < 0
                  ? `↓ ${delta} vs last week`
                  : "Flat this week"
          }
          subTone={delta == null ? "muted" : delta > 0 ? "named" : delta < 0 ? "missing" : "muted"}
          href={brandId ? `/app/brands/${brandId}` : "/app/brands"}
        />
        <KpiCard
          label="At risk"
          value="—"
          sub="Upgrade for risk rollups"
          subTone="muted"
          href="/app/settings/billing"
        />
        <KpiCard
          label="Who is winning"
          value={topCompetitor ?? "—"}
          sub={topCompetitor ? "Leading against you" : "Add competitors"}
          subTone={topCompetitor ? "missing" : "muted"}
          href={brandId ? `/app/brands/${brandId}?tab=competitors` : "/app/brands"}
        />
      </div>

      <div className="mb-6 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <p className="mb-3 text-sm font-medium">48h pitch audit</p>
        <PitchDomainForm compact />
      </div>

      {firstBrandNeedsSetup && onlyBrand ? (
        <div className="mb-6 rounded-cb-card border border-cb-accent bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Next step</p>
          <p className="mt-2 text-sm font-medium">Finish the first brief</p>
          <p className="mt-1 text-sm text-cb-muted">
            Generate {promptCap} buyer questions, run the brief, then download the PDF.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {onlyBrand.promptCount === 0 ? (
              <Link href={`/app/brands/${onlyBrand.brand.id}/prompts`} className="text-cb-accent">
                Generate {promptCap} prompts →
              </Link>
            ) : (
              <Link href={`/app/brands/${onlyBrand.brand.id}`} className="text-cb-accent">
                Run brief →
              </Link>
            )}
          </div>
        </div>
      ) : nextAction ? (
        <div className="mb-6 rounded-cb-card border border-cb-line bg-cb-surface">
          <div className="border-b border-cb-line px-4 py-3">
            <p className="text-sm font-medium">Next action</p>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {nextAction.brandName}: {nextAction.verb}
              </p>
              <p className="mt-0.5 truncate text-xs text-cb-muted">{nextAction.reason}</p>
            </div>
            <Link href={nextAction.href} className="shrink-0 text-sm text-cb-accent">
              Open →
            </Link>
          </div>
        </div>
      ) : null}

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Clients this week</h2>
          {brandId ? (
            <div className="flex gap-3 text-xs">
              <Link href={`/app/brands/${brandId}/prompts`} className="text-cb-accent">
                Questions
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
              <Th>Client</Th>
              <Th>Named</Th>
              <Th>Rec</Th>
              <Th>Δ</Th>
              <Th>Who won</Th>
              <Th>Pipeline</Th>
              <Th>Engines</Th>
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
                    <EngineDots engineStates={row.latestRun?.engineStates} />
                  </Td>
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

      <footer className="rounded-cb-card border border-cb-line bg-cb-surface px-4 py-3 text-sm text-cb-muted">
        <Link href="/app/settings/billing" className="text-cb-text hover:text-cb-accent">
          {PLANS[plan].name}
        </Link>
        {" · "}
        {clientRows.length}/{brandLimit} clients
        {" · "}
        {monthlyRecheckCredits || MONTHLY_RECHECK_CREDITS[plan]} rechecks/mo
        {" · "}
        {fridayLabel}
        {trialing || !paid ? (
          <>
            {" · "}
            <Link href="/app/settings/billing" className="text-cb-accent">
              Upgrade
            </Link>
          </>
        ) : null}
      </footer>
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
      <p className="mt-2 font-mono text-2xl tabular-nums text-cb-text group-hover:text-cb-accent">{value}</p>
      <p className={cn("mt-1 text-xs", toneClass)}>{sub}</p>
    </Link>
  );
}
