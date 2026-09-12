import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { formatShortDate, nextFriday } from "@/lib/friday";
import { getAppContext } from "@/lib/session";
import { listHomeRows } from "@/server/workspace-data";

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
  const needsSend = rows.filter((row) => row.latestReport && !row.latestReport.sentAt);

  if (rows.length === 0) {
    return (
      <div>
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Home</h1>
          <Button asChild>
            <Link href="/app/onboarding">Add a brand</Link>
          </Button>
        </div>
        <EmptyState
          line="Add a brand to start the first Friday report."
          cta="Add a brand"
          href="/app/onboarding"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Home</h1>
        <Button asChild>
          <Link href="/app/onboarding">Add a brand</Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Brands active" value={String(rows.length)} />
        <Stat label="Runs this week" value={String(rows.filter((row) => row.latestRun).length)} />
        <Stat label="Needs send" value={String(needsSend.length)} />
      </div>

      {needsSend.length ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium">Needs send</h2>
          <div className="overflow-hidden rounded-cb-card border border-cb-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
                <tr className="h-12 border-b border-cb-line">
                  <th className="px-4 font-medium">Brand</th>
                  <th className="px-4 font-medium">Score</th>
                  <th className="px-4 font-medium">Period</th>
                </tr>
              </thead>
              <tbody>
                {needsSend.map((row) => (
                  <tr key={row.brand.id} className="h-12 border-b border-cb-line last:border-0">
                    <td className="px-4">
                      <Link href={`/app/brands/${row.brand.id}`} className="text-cb-accent">
                        {row.brand.name}
                      </Link>
                    </td>
                    <td className="px-4 font-mono tabular-nums">
                      {row.latestReport?.scoreMentioned ?? "-"}/{row.latestReport?.scoreTotal ?? 20}
                    </td>
                    <td className="px-4 text-cb-muted">{row.latestRun?.periodStart ?? "This week"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-medium">This week</h2>
        <div className="grid gap-3">
          {rows.map((row) => (
            <Link
              key={row.brand.id}
              href={`/app/brands/${row.brand.id}`}
              className="flex h-16 items-center justify-between rounded-cb-card border border-cb-line bg-cb-surface px-4"
            >
              <div>
                <p className="text-sm font-medium">{row.brand.name}</p>
                <p className="font-mono text-xs tabular-nums text-cb-muted">
                  {row.latestReport
                    ? `${row.latestReport.scoreMentioned ?? "-"}/${row.latestReport.scoreTotal ?? 20}`
                    : "No score yet"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill
                  status={
                    row.latestRun?.status === "complete"
                      ? "complete"
                      : row.latestRun?.status === "running"
                        ? "running"
                        : "queued"
                  }
                >
                  {row.latestRun?.status === "complete"
                    ? "Complete"
                    : row.latestRun?.status === "running"
                      ? "Running"
                      : "Idle"}
                </StatusPill>
                <span className="text-xs text-cb-muted">Next Friday {friday}</span>
              </div>
            </Link>
          ))}
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
