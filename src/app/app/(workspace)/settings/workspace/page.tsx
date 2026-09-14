import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { DataPrivacyCard } from "@/components/settings/data-privacy-card";
import { workspaces } from "@/db/schema";
import { workspaceEntitlements } from "@/lib/entitlements";
import { defaultEngineStringForPlan, validateDefaultEngines } from "@/lib/plan-engines";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";

export default async function WorkspaceSettingsPage() {
  const ctx = await getAppContext();
  if (!ctx) notFound();
  const [workspace] = await ctx.db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspace.id))
    .limit(1);
  if (!workspace) notFound();
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const engineGate = { paid: ent.paid, allowsStudioEngines: ent.allowsStudioEngines };
  const engines = validateDefaultEngines(workspace.defaultEngines, engineGate);
  const defaultEngines = engines.ok
    ? engines.normalized
    : defaultEngineStringForPlan(engineGate);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Workspace</h1>
      <p className="mt-3 text-sm text-cb-muted">
        Timezone drives the Friday 06:00 cron. Default engines apply to weekly runs. Email sender and
        domain live under Domains.
      </p>
      <div className="mt-8">
        <WorkspaceForm
          slackAllowed={ent.allowsSlack}
          customSenderAllowed={ent.allowsCustomSender}
          studioEnginesAllowed={ent.allowsStudioEngines}
          paid={ent.paid}
          showRoiMinutes={ent.allowsCommandCenter}
          riskNotifyAllowed={ent.allowsPortfolioRollups && ent.allowsEmailSend}
          initial={{
            name: workspace.name,
            timezone: workspace.timezone,
            defaultEngines,
            slackWebhookUrl: workspace.slackWebhookUrl || "",
            minutesSavedPerReport: workspace.minutesSavedPerReport ?? 60,
            notifyHighRisks: Boolean(workspace.notifyHighRisks),
            highRiskLastNotifiedAt: workspace.highRiskLastNotifiedAt
              ? new Date(workspace.highRiskLastNotifiedAt).toISOString()
              : null,
          }}
        />
      </div>
      <DataPrivacyCard canManage={ctx.impersonating || ctx.role === "owner"} />
    </div>
  );
}
