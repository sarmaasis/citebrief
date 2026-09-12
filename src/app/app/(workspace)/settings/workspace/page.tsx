import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { getAppContext } from "@/lib/session";
import { workspaces } from "@/db/schema";

export default async function WorkspaceSettingsPage() {
  const ctx = await getAppContext();
  if (!ctx) notFound();
  const [workspace] = await ctx.db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspace.id))
    .limit(1);
  if (!workspace) notFound();

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Workspace</h1>
      <p className="mt-3 text-sm text-cb-muted">
        Timezone drives the Friday 06:00 cron. Default engines and sender name apply to weekly sends.
      </p>
      <div className="mt-8">
        <WorkspaceForm
          initial={{
            name: workspace.name,
            timezone: workspace.timezone,
            senderName: workspace.senderName || "",
            defaultEngines: workspace.defaultEngines || "chatgpt,perplexity,gemini,aio",
          }}
        />
      </div>
    </div>
  );
}
