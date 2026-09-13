import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { workspaces } from "@/db/schema";
import { planAllowsCustomSender, planAllowsSlack } from "@/lib/billing";
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

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Workspace</h1>
      <p className="mt-3 text-sm text-cb-muted">
        Timezone drives the Friday 06:00 cron. Default engines and sender name apply to weekly sends.
      </p>
      <div className="mt-8">
        <WorkspaceForm
          slackAllowed={planAllowsSlack(sub?.plan || "agency")}
          customSenderAllowed={planAllowsCustomSender(sub?.plan || "agency")}
          initial={{
            name: workspace.name,
            timezone: workspace.timezone,
            senderName: workspace.senderName || "",
            defaultEngines: workspace.defaultEngines || "chatgpt,perplexity,gemini,aio",
            slackWebhookUrl: workspace.slackWebhookUrl || "",
          }}
        />
      </div>
    </div>
  );
}
