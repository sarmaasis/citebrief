import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { DataPrivacyCard } from "@/components/settings/data-privacy-card";
import { workspaces } from "@/db/schema";
import { workspaceEntitlements } from "@/lib/entitlements";
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

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Workspace</h1>
      <p className="mt-3 text-sm text-cb-muted">
        Timezone drives the Friday 06:00 cron. Default engines and sender name apply to weekly sends.
      </p>
      <div className="mt-8">
        <WorkspaceForm
          slackAllowed={ent.allowsSlack}
          customSenderAllowed={ent.allowsCustomSender}
          studioEnginesAllowed={ent.allowsStudioEngines}
          initial={{
            name: workspace.name,
            timezone: workspace.timezone,
            senderName: workspace.senderName || "",
            senderDomain: workspace.senderDomain || "",
            defaultEngines: workspace.defaultEngines || "chatgpt,perplexity,gemini,aio",
            slackWebhookUrl: workspace.slackWebhookUrl || "",
          }}
        />
      </div>
      <DataPrivacyCard canManage={ctx.impersonating || ctx.role === "owner"} />
    </div>
  );
}
