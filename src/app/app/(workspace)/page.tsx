import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { RiskPill } from "@/components/app/risk-pill";
import { ScoreChange } from "@/components/app/score-change";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  agencyRoi,
  averageNamedScore,
  clientRisk,
  opportunityFromRow,
  PIPELINE_LABEL,
  pipelineCounts,
  pipelineStage,
  weeklyAction,
  type PipelineStage,
} from "@/lib/command-center";
import { workspaceEntitlements } from "@/lib/entitlements";
import { formatShortDate, nextFriday } from "@/lib/friday";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { listHomeRows } from "@/server/workspace-data";

function runPill(status: string | undefined) {
  if (status === "complete") return { status: "complete" as const, label: "Complete" };
  if (status === "partial") return { status: "partial" as const, label: "Shipped" };
  if (status === "running") return { status: "running" as const, label: "Running" };
  if (status === "failed") return { status: "failed" as const, label: "Failed" };
  if (status === "queued") return { status: "queued" as const, label: "Queued" };
  return { status: "queued" as const, label: "Idle" };
}

const PIPELINE_ORDER: PipelineStage[] = [
  "not_configured",
  "ready_to_run",
  "running",
  "needs_review",
  "ready_to_send",
  "sent",
];

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

  const rows = await listHomeRows(ctx);
  const friday = formatShortDate(nextFriday());
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const allowsWeekly = ent.allowsWeeklyCadence;
  const allowsEmailSend = ent.allowsEmailSend;
  const showCommandCenter = ent.paid && allowsWeekly;

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

  const actions = rows
    .map((row) => weeklyAction(row, allowsEmailSend))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const opportunities = rows
    .map((row) => opportunityFromRow(row))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const pipeline = pipelineCounts(rows);
  const avgNamed = averageNamedScore(rows);
  const reportsGenerated = rows.filter((row) => Boolean(row.latestReport)).length;
  const reportsSent = rows.filter((row) => Boolean(row.latestReport?.sentAt)).length;
  const failedOrPartial = rows.filter(
    (row) => row.latestRun?.status === "failed" || row.latestRun?.status === "partial",
  ).length;
  const riskAlerts = rows.filter((row) => clientRisk(row) !== "stable");
  const roi = agencyRoi({
    brands: rows.length,
    reportsGenerated,
    reportsSent,
    opportunities: opportunities.length,
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Home</h1>
          <p className="mt-1 text-sm text-cb-muted">
            {showCommandCenter
              ? "Which clients need attention, which reports should go out, and what you can sell next."
              : "This week’s runs, send status, and brands that still need a report."}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/onboarding">Add a brand</Link>
        </Button>
      </div>

      {showCommandCenter ? (
        <>
          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Clients" value={String(rows.length)} />
            <Stat label="Avg named" value={avgNamed == null ? "—" : String(avgNamed)} />
            <Stat label="Reports ready" value={String(pipeline.needs_review)} />
            <Stat label="Reports sent" value={String(reportsSent)} />
            <Stat label="Failed / partial" value={String(failedOrPartial)} />
          </div>
          <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {PIPELINE_ORDER.map((stage) => (
              <Stat key={stage} label={PIPELINE_LABEL[stage]} value={String(pipeline[stage])} />
            ))}
          </div>
        </>
      ) : (
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
      )}

      {actions.length ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium">This week’s actions</h2>
          <div className="overflow-hidden rounded-cb-card border border-cb-line">
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

      {showCommandCenter && riskAlerts.length ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium">Client risk</h2>
          <div className="overflow-hidden rounded-cb-card border border-cb-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
                <tr className="h-12 border-b border-cb-line">
                  <th className="px-4 font-medium">Brand</th>
                  <th className="px-4 font-medium">Risk</th>
                  <th className="px-4 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {riskAlerts.map((row) => {
                  const risk = clientRisk(row);
                  const why =
                    row.latestRun?.status === "failed"
                      ? "Last run failed"
                      : row.latestReport?.scoreMentioned === 0
                        ? "No presence this period"
                        : row.mentionedDelta != null && row.mentionedDelta < 0
                          ? "Visibility dropped"
                          : row.latestReport &&
                              (row.latestReport.scoreRecommended ?? 0) < (row.latestReport.scoreMentioned ?? 0)
                            ? "Named but not recommended"
                            : row.latestReport && !row.latestReport.sentAt
                              ? "Report not sent"
                              : "Needs setup";
                  return (
                    <tr key={row.brand.id} className="h-12 border-b border-cb-line last:border-0">
                      <td className="px-4">
                        <Link href={`/app/brands/${row.brand.id}`} className="text-cb-accent">
                          {row.brand.name}
                        </Link>
                      </td>
                      <td className="px-4">
                        <RiskPill risk={risk} />
                      </td>
                      <td className="px-4 text-cb-muted">{why}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showCommandCenter && opportunities.length ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium">Revenue opportunities</h2>
          <div className="overflow-hidden rounded-cb-card border border-cb-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
                <tr className="h-12 border-b border-cb-line">
                  <th className="px-4 font-medium">Client</th>
                  <th className="px-4 font-medium">Sell next</th>
                  <th className="px-4 font-medium">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((item) => (
                  <tr key={`${item.client}-${item.service}`} className="h-12 border-b border-cb-line last:border-0">
                    <td className="px-4">
                      <Link href={item.href} className="text-cb-accent">
                        {item.client}
                      </Link>
                    </td>
                    <td className="px-4">{item.service}</td>
                    <td className="px-4 text-cb-muted">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showCommandCenter ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium">Agency ROI</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Brands monitored" value={String(roi.brands)} />
            <Stat label="Reports generated" value={String(roi.reportsGenerated)} />
            <Stat label="Reports sent" value={String(roi.reportsSent)} />
            <Stat label="Opportunities" value={String(roi.opportunities)} />
            <Stat label="Est. hours saved" value={String(roi.hoursSaved)} />
          </div>
          <p className="mt-2 text-xs text-cb-muted">Hours saved estimates 2 account-manager hours per generated report.</p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-medium">This week</h2>
        <div className="overflow-hidden rounded-cb-card border border-cb-line bg-cb-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <th className="px-4 font-medium">Brand</th>
                <th className="px-4 font-medium">Risk</th>
                <th className="px-4 font-medium">Named</th>
                <th className="px-4 font-medium">Change</th>
                <th className="px-4 font-medium">Pipeline</th>
                <th className="px-4 font-medium">Run</th>
                <th className="px-4 font-medium">Cadence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pill = runPill(row.latestRun?.status);
                const stage = pipelineStage(row);
                return (
                  <tr key={row.brand.id} className="h-12 border-b border-cb-line last:border-0">
                    <td className="px-4">
                      <Link href={`/app/brands/${row.brand.id}`} className="font-medium text-cb-text hover:text-cb-accent">
                        {row.brand.name}
                      </Link>
                    </td>
                    <td className="px-4">
                      <RiskPill risk={clientRisk(row)} />
                    </td>
                    <td className="px-4 font-mono tabular-nums">
                      {row.latestReport
                        ? `${row.latestReport.scoreMentioned ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                        : "—"}
                    </td>
                    <td className="px-4">
                      <ScoreChange delta={row.mentionedDelta} />
                    </td>
                    <td className="px-4 text-cb-muted">{PIPELINE_LABEL[stage]}</td>
                    <td className="px-4">
                      <StatusPill status={pill.status}>{pill.label}</StatusPill>
                    </td>
                    <td className="px-4 text-xs text-cb-muted">
                      {allowsWeekly ? `Friday ${friday}` : "Monthly"}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-cb-card border border-cb-line bg-cb-surface px-4 py-3">
      <p className="text-xs text-cb-muted">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums">{value}</p>
    </div>
  );
}
