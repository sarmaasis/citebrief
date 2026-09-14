import Link from "next/link";
import { DataTable, Td, Th } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { LockedModule } from "@/components/app/locked-module";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { dashboardModulesForPlan } from "@/lib/dashboard-metrics";
import { workspaceEntitlements } from "@/lib/entitlements";
import { formatShortDate } from "@/lib/friday";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { buildActionHistory } from "@/server/dashboard-data";

export default async function ActivityPage() {
  const ctx = await getAppContext();
  if (!ctx) {
    return <EmptyState line="Sign in to see workspace activity." cta="Sign in" href="/login" />;
  }

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const modules = dashboardModulesForPlan(ent);
  if (!modules.actionHistory) {
    return (
      <LockedModule
        title="Activity"
        line={
          ent.trialing
            ? "Trial keeps a lighter history. Agency unlocks the full action timeline."
            : "Deeper action history is on Agency and above."
        }
        upgradeTitle={UPGRADE_COPY.commandCenter.title}
        upgradeBody={UPGRADE_COPY.commandCenter.body}
        upgradeCta={UPGRADE_COPY.commandCenter.cta}
      />
    );
  }

  const events = await buildActionHistory(ctx);
  if (events.length === 0) {
    return (
      <div>
        <h1 className="mb-8 text-xl font-semibold tracking-tight">Activity</h1>
        <EmptyState
          title="No activity yet"
          line="Runs, reports, and planned opportunities will show up here after the first Friday workflow."
          cta="Add a brand"
          href="/app/onboarding"
          secondaryCta="Go to Overview"
          secondaryHref="/app"
          steps={["Add a brand", "Run a report", "Watch the timeline fill in"]}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-cb-muted">
          Runs completed, reports generated, opportunities, and workspace audit events.
        </p>
      </div>
      <DataTable minWidth="640px">
        <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
          <tr className="h-12 border-b border-cb-line">
            <Th>When</Th>
            <Th>Type</Th>
            <Th>Brand</Th>
            <Th>What happened</Th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="h-12 border-b border-cb-line last:border-0">
              <Td className="whitespace-nowrap font-mono text-xs tabular-nums text-cb-muted">
                {formatShortDate(new Date(event.at))}
              </Td>
              <Td className="text-cb-muted">{event.kind.replaceAll("_", " ")}</Td>
              <Td truncate>
                {event.brandId ? (
                  <Link href={`/app/brands/${event.brandId}`} className="text-cb-accent">
                    {event.brandName || "Brand"}
                  </Link>
                ) : (
                  <span className="text-cb-muted">—</span>
                )}
              </Td>
              <Td truncate className="text-cb-text">
                {event.label}
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
