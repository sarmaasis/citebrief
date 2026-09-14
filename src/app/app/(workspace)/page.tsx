import { eq } from "drizzle-orm";
import Link from "next/link";
import { CopyRecommendation } from "@/components/app/copy-recommendation";
import { EmptyState } from "@/components/app/empty-state";
import { MarkPlanned } from "@/components/app/mark-planned";
import { PipelineStrip } from "@/components/app/pipeline-strip";
import { PortfolioExport } from "@/components/app/portfolio-export";
import { RiskPill } from "@/components/app/risk-pill";
import { ScoreChange } from "@/components/app/score-change";
import { Button } from "@/components/ui/button";
import { workspaces } from "@/db/schema";
import { PIPELINE_LABEL, pipelineCounts, pipelineStage, weeklyAction } from "@/lib/command-center";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildCommandCenterSnapshot } from "@/server/command-center-data";
import { listHomeRows, withSendOverdue } from "@/server/workspace-data";

export default async function AppHomePage() {
  const ctx = await getAppContext();
  if (!ctx) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Home</h1>
        <EmptyState line="Sign in to start the first Friday report." cta="Sign in" href="/login" />
      </div>
    );
  }

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);

  if (!ent.allowsCommandCenter) {
    const [workspace] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, ctx.workspace.id)).limit(1);
    const rows = withSendOverdue(await listHomeRows(ctx), {
      timezone: workspace?.timezone || "America/New_York",
      weekly: ent.allowsWeeklyCadence,
    });
    return <LightHome rows={rows} allowsEmailSend={ent.allowsEmailSend} />;
  }

  const snapshot = await buildCommandCenterSnapshot(ctx, ent);
  if (snapshot.rows.length === 0) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Home</h1>
        <EmptyState
          title="No brands yet"
          line="Start the first Friday report."
          cta="Add a brand"
          href="/app/onboarding"
        />
      </div>
    );
  }

  const onlyBrand = snapshot.rows.length === 1 ? snapshot.rows[0] : null;
  const firstBrandNeedsSetup = Boolean(onlyBrand && !onlyBrand.latestReport);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Home</h1>
          <p className="mt-1 text-sm text-cb-muted">
            Which clients need attention, which reports should go out, and what you can sell next.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ent.allowsPortfolioExport ? <PortfolioExport /> : null}
          <Button asChild>
            <Link href="/app/onboarding?new=1">Add a brand</Link>
          </Button>
        </div>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Clients" value={String(snapshot.kpis.clientsMonitored)} href="/app" />
        <Stat
          label="Avg named"
          value={snapshot.kpis.portfolioVisibility == null ? "—" : String(snapshot.kpis.portfolioVisibility)}
        />
        <Stat label="At risk" value={String(snapshot.kpis.clientsAtRisk)} href="/app/risks" />
        <Stat label="Opportunities" value={String(snapshot.kpis.opportunitiesFound)} href="/app/opportunities" />
        <Stat label="Est. hours saved" value={String(snapshot.kpis.hoursSaved)} />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Reports ready" value={String(snapshot.kpis.reportsReady)} href="/app/reports" />
        <Stat label="Reports sent" value={String(snapshot.kpis.reportsSent)} href="/app/reports?sent=1" />
        <Stat label="Failed / partial" value={String(snapshot.kpis.failedOrPartial)} />
      </div>
      <div className="mb-8">
        <PipelineStrip pipeline={snapshot.pipeline} />
      </div>

      {firstBrandNeedsSetup && onlyBrand ? (
        <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-sm font-medium">Finish the first report</p>
          <p className="mt-1 text-sm text-cb-muted">Generate twenty buyer questions, run the report, then open the PDF.</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {onlyBrand.promptCount === 0 ? (
              <Link href={`/app/brands/${onlyBrand.brand.id}/prompts`} className="text-cb-accent">
                Generate 20 prompts
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
          <div className="overflow-x-auto rounded-cb-card border border-cb-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
                <tr className="h-12 border-b border-cb-line">
                  <th className="px-4 font-medium">Brand</th>
                  <th className="px-4 font-medium">Action</th>
                  <th className="px-4 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.actions.map((item) => (
                  <tr key={`${item.brandId}-${item.verb}`} className="h-12 border-b border-cb-line last:border-0">
                    <td className="px-4">
                      <Link href={`/app/brands/${item.brandId}`} className="text-cb-accent">
                        {item.brandName}
                      </Link>
                    </td>
                    <td className="px-4">
                      <Link href={item.href} className="text-cb-accent">
                        {item.verb}
                      </Link>
                    </td>
                    <td className="px-4 text-cb-muted">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {snapshot.risks.length ? (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Client risk</h2>
            <Link href="/app/risks" className="text-xs text-cb-accent">
              All risks
            </Link>
          </div>
          <div className="overflow-x-auto rounded-cb-card border border-cb-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
                <tr className="h-12 border-b border-cb-line">
                  <th className="px-4 font-medium">Brand</th>
                  <th className="px-4 font-medium">Risk</th>
                  <th className="px-4 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.risks.map((item) => (
                  <tr key={item.brandId} className="h-12 border-b border-cb-line last:border-0">
                    <td className="px-4">
                      <Link href={`/app/brands/${item.brandId}`} className="text-cb-accent">
                        {item.brandName}
                      </Link>
                    </td>
                    <td className="px-4">
                      <RiskPill risk={item.risk} />
                    </td>
                    <td className="px-4 text-cb-muted">{item.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Revenue opportunities</h2>
          <Link href="/app/opportunities" className="text-xs text-cb-accent">
            All opportunities
          </Link>
        </div>
        {snapshot.opportunities.length === 0 ? (
          <p className="text-sm text-cb-muted">
            No comparison gaps or visibility drops in the latest reports. Review a report to find the next piece of
            work.
          </p>
        ) : (
          <div className="grid gap-4">
            {snapshot.opportunities.map((item) => (
              <article key={`${item.brandId}-${item.key}`} className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{item.client}</p>
                  <p className="text-xs text-cb-muted">{item.value}</p>
                </div>
                <p className="mt-2 text-sm text-cb-text">
                  {item.type} · {item.service}
                </p>
                <p className="mt-2 text-sm text-cb-muted">{item.evidence}</p>
                <p className="mt-3 text-sm text-cb-text">{item.wording}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={item.href} className="text-sm text-cb-accent">
                    Open report
                  </Link>
                  <CopyRecommendation text={item.wording} />
                  <MarkPlanned
                    brandId={item.brandId}
                    reportId={item.reportId}
                    opportunityKey={item.key}
                    planned={item.planned}
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
        <h2 className="mb-3 text-sm font-medium">This week</h2>
        <div className="overflow-x-auto rounded-cb-card border border-cb-line bg-cb-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <th className="px-4 font-medium">Brand</th>
                <th className="px-4 font-medium">Owner</th>
                <th className="px-4 font-medium">Risk</th>
                <th className="px-4 font-medium">Named</th>
                <th className="px-4 font-medium">Rec</th>
                <th className="px-4 font-medium">Change</th>
                <th className="px-4 font-medium">Pipeline</th>
                <th className="px-4 font-medium">Next</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.rows.map((row) => (
                <tr key={row.brand.id} className="h-12 border-b border-cb-line last:border-0">
                  <td className="px-4">
                    <Link href={`/app/brands/${row.brand.id}`} className="font-medium text-cb-text hover:text-cb-accent">
                      {row.brand.name}
                    </Link>
                  </td>
                  <td className="px-4 text-cb-muted">{row.brand.clientOwner || "—"}</td>
                  <td className="px-4">
                    <RiskPill risk={row.risk} />
                  </td>
                  <td className="px-4 font-mono tabular-nums">
                    {row.latestReport
                      ? `${row.latestReport.scoreMentioned ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                      : "—"}
                  </td>
                  <td className="px-4 font-mono tabular-nums">
                    {row.latestReport
                      ? `${row.latestReport.scoreRecommended ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                      : "—"}
                  </td>
                  <td className="px-4">
                    <ScoreChange delta={row.mentionedDelta} />
                  </td>
                  <td className="px-4 text-cb-muted">{PIPELINE_LABEL[row.pipeline]}</td>
                  <td className="px-4">
                    {row.action ? (
                      <Link href={row.action.href} className="text-cb-accent">
                        {row.action.verb}
                      </Link>
                    ) : (
                      <span className="text-cb-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function LightHome({
  rows,
  allowsEmailSend,
}: {
  rows: Awaited<ReturnType<typeof listHomeRows>>;
  allowsEmailSend: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Home</h1>
        <EmptyState
          title="No brands yet"
          line="Start the first Friday report."
          cta="Add a brand"
          href="/app/onboarding"
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

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Home</h1>
          <p className="mt-1 text-sm text-cb-muted">This week’s runs, send status, and brands that still need a report.</p>
        </div>
        <Button asChild>
          <Link href="/app/onboarding?new=1">Add a brand</Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Brands active" value={String(rows.length)} />
        <Stat
          label="Runs this week"
          value={String(rows.filter((row) => row.latestRun && row.latestRun.status !== "failed").length)}
        />
        <Stat
          label={allowsEmailSend ? "Needs send" : "Reports ready"}
          value={String(allowsEmailSend ? pipeline.needs_review : reportsGenerated)}
        />
      </div>

      {firstBrandNeedsSetup && onlyBrand ? (
        <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-sm font-medium">Finish the first report</p>
          <p className="mt-1 text-sm text-cb-muted">Generate twenty buyer questions, run the report, then open the PDF.</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {onlyBrand.promptCount === 0 ? (
              <Link href={`/app/brands/${onlyBrand.brand.id}/prompts`} className="text-cb-accent">
                Generate 20 prompts
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
          <div className="overflow-x-auto rounded-cb-card border border-cb-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
                <tr className="h-12 border-b border-cb-line">
                  <th className="px-4 font-medium">Brand</th>
                  <th className="px-4 font-medium">Action</th>
                  <th className="px-4 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((item) => (
                  <tr key={`${item.brandId}-${item.verb}`} className="h-12 border-b border-cb-line last:border-0">
                    <td className="px-4">
                      <Link href={`/app/brands/${item.brandId}`} className="text-cb-accent">
                        {item.brandName}
                      </Link>
                    </td>
                    <td className="px-4">
                      <Link href={item.href} className="text-cb-accent">
                        {item.verb}
                      </Link>
                    </td>
                    <td className="px-4 text-cb-muted">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-medium">This week</h2>
        <div className="overflow-x-auto rounded-cb-card border border-cb-line bg-cb-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <th className="px-4 font-medium">Brand</th>
                <th className="px-4 font-medium">Owner</th>
                <th className="px-4 font-medium">Named</th>
                <th className="px-4 font-medium">Rec</th>
                <th className="px-4 font-medium">Change</th>
                <th className="px-4 font-medium">Pipeline</th>
                <th className="px-4 font-medium">Next</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const stage = pipelineStage(row);
                const action = weeklyAction(row, allowsEmailSend);
                return (
                  <tr key={row.brand.id} className="h-12 border-b border-cb-line last:border-0">
                    <td className="px-4">
                      <Link href={`/app/brands/${row.brand.id}`} className="font-medium text-cb-text hover:text-cb-accent">
                        {row.brand.name}
                      </Link>
                    </td>
                    <td className="px-4 text-cb-muted">{row.brand.clientOwner || row.brand.buyer || "—"}</td>
                    <td className="px-4 font-mono tabular-nums">
                      {row.latestReport
                        ? `${row.latestReport.scoreMentioned ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                        : "—"}
                    </td>
                    <td className="px-4 font-mono tabular-nums">
                      {row.latestReport
                        ? `${row.latestReport.scoreRecommended ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                        : "—"}
                    </td>
                    <td className="px-4">
                      <ScoreChange delta={row.mentionedDelta} />
                    </td>
                    <td className="px-4 text-cb-muted">{PIPELINE_LABEL[stage]}</td>
                    <td className="px-4">
                      {action ? (
                        <Link href={action.href} className="text-cb-accent">
                          {action.verb}
                        </Link>
                      ) : (
                        <span className="text-cb-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
