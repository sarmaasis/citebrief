import { Suspense } from "react";
import { WorkspaceChrome } from "@/components/app/workspace-chrome";
import { PageSkeleton } from "@/components/app/page-skeleton";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { countReportsReady, listWorkspaceBrandNav } from "@/server/workspace-data";

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
        loadRecheckHint={false}
      >
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </WorkspaceChrome>
    );
  }

  const role = ctx.impersonating ? "owner" : ctx.role;
  // Keep layout thin: brands for switcher + sub for trial/paid flag only.
  // Recheck remaining counts hit several D1 queries — TopBar loads those client-side.
  const [brands, sub, briefsReady] = await Promise.all([
    listWorkspaceBrandNav(ctx),
    getWorkspaceSubscription(ctx.db, ctx.workspace.id),
    countReportsReady(ctx),
  ]);
  const ent = workspaceEntitlements(sub);
  const loadRecheckHint = ent.paid || ent.trialing;
  const trialHint = ent.trialing
    ? `Trial · ${ent.trialRunCap} report · ${ent.trialBrandCap} brand`
    : null;

  return (
    <WorkspaceChrome
      workspaceName={ctx.workspace.name}
      userLabel={ctx.user.name}
      roleLabel={role}
      impersonating={Boolean(ctx.impersonating)}
      signedIn
      brands={brands}
      recheckHint={trialHint}
      loadRecheckHint={loadRecheckHint && !trialHint}
      briefsReady={briefsReady}
    >
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </WorkspaceChrome>
  );
}
