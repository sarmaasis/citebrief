import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notFound } from "next/navigation";
import { DomainsPanel } from "@/components/settings/domains-panel";
import { workspaces } from "@/db/schema";
import { workspaceEntitlements } from "@/lib/entitlements";
import { buildSenderDomainSnapshot, checksFromWorkspace } from "@/lib/sender-domain";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";

export default async function DomainsSettingsPage() {
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
  const { env } = await getCloudflareContext({ async: true });
  const domain = buildSenderDomainSnapshot({
    allowsCustomSender: ent.allowsCustomSender,
    senderName: workspace.senderName,
    senderDomain: workspace.senderDomain,
    checks: checksFromWorkspace(workspace),
    verifiedAt: workspace.senderDomainVerifiedAt,
    systemFrom: env.CF_EMAIL_FROM,
  });

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Domains</h1>
      <p className="mt-3 text-sm text-cb-muted">
        CiteBrief sends from getcitebrief.com by default. Studio can add a custom sender domain after
        Cloudflare Email DNS is verified (manual checklist — no automatic DNS poll).
      </p>
      <div className="mt-8">
        <DomainsPanel
          canEdit={ctx.impersonating || ctx.role === "owner" || ctx.role === "admin"}
          initial={domain}
        />
      </div>
    </div>
  );
}
