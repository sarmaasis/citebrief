import { and, eq } from "drizzle-orm";
import { WorkspaceChrome } from "@/components/app/workspace-chrome";
import { workspaceMembers } from "@/db/schema";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getUsageSnapshot, getWorkspaceSubscription } from "@/lib/usage";
import { listWorkspaceBrands } from "@/server/workspace-data";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const brands = ctx ? await listWorkspaceBrands(ctx) : [];
  let role = "member";
  let recheckHint: string | null = null;
  if (ctx?.impersonating) {
    role = "owner";
  } else if (ctx) {
    const [membership] = await ctx.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ctx.workspace.id), eq(workspaceMembers.userId, ctx.user.id)))
      .limit(1);
    role = membership?.role ?? "member";
  }

  if (ctx) {
    const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
    const ent = workspaceEntitlements(sub);
    if (ent.paid) {
      const usage = await getUsageSnapshot(ctx.db, ctx.workspace.id);
      const remaining = Math.max(0, usage.monthlyRechecksRemaining ?? 0);
      const included = Math.max(0, ent.monthlyRecheckCredits);
      const credits = Math.max(0, usage.extraRunCredits ?? ent.extraRunCredits);
      if (included > 0 || credits > 0) {
        recheckHint =
          credits > 0
            ? `${remaining}/${included} rechecks · ${credits} extra credit${credits === 1 ? "" : "s"}`
            : `${remaining}/${included} recheck${included === 1 ? "" : "s"} left`;
      }
    } else if (ent.trialing) {
      recheckHint = `Trial · ${ent.trialRunCap} report · ${ent.trialBrandCap} brand`;
    }
  }

  return (
    <WorkspaceChrome
      workspaceName={ctx?.workspace.name ?? "Your workspace"}
      userLabel={ctx?.user.name ?? "Sign in"}
      roleLabel={ctx ? role : null}
      impersonating={Boolean(ctx?.impersonating)}
      signedIn={Boolean(ctx)}
      brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
      recheckHint={recheckHint}
    >
      {children}
    </WorkspaceChrome>
  );
}
