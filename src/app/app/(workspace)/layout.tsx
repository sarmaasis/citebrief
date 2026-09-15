import { WorkspaceChrome } from "@/components/app/workspace-chrome";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getUsageSnapshot, getWorkspaceSubscription } from "@/lib/usage";
import { listWorkspaceBrands } from "@/server/workspace-data";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  if (!ctx) {
    return (
      <WorkspaceChrome
        workspaceName="Your workspace"
        userLabel="Sign in"
        roleLabel={null}
        impersonating={false}
        signedIn={false}
        brands={[]}
        recheckHint={null}
      >
        {children}
      </WorkspaceChrome>
    );
  }

  const role = ctx.impersonating ? "owner" : ctx.role;
  const [brands, sub] = await Promise.all([
    listWorkspaceBrands(ctx),
    getWorkspaceSubscription(ctx.db, ctx.workspace.id),
  ]);

  let recheckHint: string | null = null;
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
          : remaining === 0
            ? `${remaining}/${included} rechecks left · buy extra to re-run past included`
            : `${remaining}/${included} recheck${included === 1 ? "" : "s"} left`;
    }
  } else if (ent.trialing) {
    recheckHint = `Trial · ${ent.trialRunCap} report · ${ent.trialBrandCap} brand`;
  }

  return (
    <WorkspaceChrome
      workspaceName={ctx.workspace.name}
      userLabel={ctx.user.name}
      roleLabel={role}
      impersonating={Boolean(ctx.impersonating)}
      signedIn
      brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
      recheckHint={recheckHint}
    >
      {children}
    </WorkspaceChrome>
  );
}
