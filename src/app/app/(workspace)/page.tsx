import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { ScoreChange } from "@/components/app/score-change";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { workspaceEntitlements } from "@/lib/entitlements";
import { formatShortDate, nextFriday } from "@/lib/friday";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { listHomeRows } from "@/server/workspace-data";

function runPill(status: string | undefined) {
  if (status === "complete") return { status: "complete" as const, label: "Complete" };
  if (status === "partial") return { status: "partial" as const, label: "Shipped" };
  if (status === "running") return { status: "running" as const, label: "Running" };
  if (status === "failed") return { status: "failed" as const, label: "Did not ship" };
  if (status === "queued") return { status: "queued" as const, label: "Queued" };
  return { status: "queued" as const, label: "Idle" };
}

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
  const allowsWeekly = workspaceEntitlements(sub).allowsWeeklyCadence;
  const needsSend = rows.filter((row) => row.latestReport && !row.latestReport.sentAt);
  const needsAttention = rows.filter((row) => {
    if (row.promptCount === 0) return true;
    if (row.latestRun?.status === "failed") return true;
    if (row.latestReport && !row.latestReport.sentAt) return true;
    if (!row.latestReport) return true;
    return false;
  });

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

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Home</h1>
          <p className="mt-1 text-sm text-cb-muted">
            This week’s runs, send status, and brands that still need a report.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/onboarding">Add a brand</Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Brands active" value={String(rows.length)} />
        <Stat
          label="Runs this week"
          value={String(rows.filter((row) => row.latestRun && row.latestRun.status !== "failed").length)}
        />
        <Stat label="Needs send" value={String(needsSend.length)} />
      </div>

      {needsAttention.length ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium">Needs attention</h2>
          <div className="overflow-hidden rounded-cb-card border border-cb-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
                <tr className="h-12 border-b border-cb-line">
                  <th className="px-4 font-medium">Brand</th>
                  <th className="px-4 font-medium">Why</th>
                  <th className="px-4 font-medium">Next</th>
                </tr>
              </thead>
              <tbody>
                {needsAttention.map((row) => {
                  const why =
                    row.promptCount === 0
                      ? "Generate 20 prompts"
                      : row.latestRun?.status === "failed"
                        ? "Report did not ship"
                        : row.latestReport && !row.latestReport.sentAt
                          ? "Send this week’s PDF"
                          : "Run the first report";
                  const href =
                    row.promptCount === 0
                      ? `/app/brands/${row.brand.id}/prompts`
                      : row.latestReport
                        ? `/app/brands/${row.brand.id}/reports/${row.latestReport.id}`
                        : `/app/brands/${row.brand.id}`;
                  return (
                    <tr key={row.brand.id} className="h-12 border-b border-cb-line last:border-0">
                      <td className="px-4">
                        <Link href={`/app/brands/${row.brand.id}`} className="text-cb-accent">
                          {row.brand.name}
                        </Link>
                      </td>
                      <td className="px-4 text-cb-muted">{why}</td>
                      <td className="px-4">
                        <Link href={href} className="text-cb-accent">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-medium">This week</h2>
        <div className="overflow-hidden rounded-cb-card border border-cb-line bg-cb-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <th className="px-4 font-medium">Brand</th>
                <th className="px-4 font-medium">Named</th>
                <th className="px-4 font-medium">Change</th>
                <th className="px-4 font-medium">Status</th>
                <th className="px-4 font-medium">Send</th>
                <th className="px-4 font-medium">Cadence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pill = runPill(row.latestRun?.status);
                const sent = Boolean(row.latestReport?.sentAt);
                return (
                  <tr key={row.brand.id} className="h-12 border-b border-cb-line last:border-0">
                    <td className="px-4">
                      <Link href={`/app/brands/${row.brand.id}`} className="font-medium text-cb-text hover:text-cb-accent">
                        {row.brand.name}
                      </Link>
                    </td>
                    <td className="px-4 font-mono tabular-nums">
                      {row.latestReport
                        ? `${row.latestReport.scoreMentioned ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                        : "—"}
                    </td>
                    <td className="px-4">
                      <ScoreChange delta={row.mentionedDelta} />
                    </td>
                    <td className="px-4">
                      <StatusPill status={pill.status}>{pill.label}</StatusPill>
                    </td>
                    <td className="px-4 text-cb-muted">
                      {row.latestReport ? (sent ? "Sent" : "Not sent") : "No PDF"}
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
