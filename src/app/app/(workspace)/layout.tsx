import { and, eq } from "drizzle-orm";
import { AppSidebar } from "@/components/app/sidebar";
import { AppTopBar } from "@/components/app/top-bar";
import { workspaceMembers } from "@/db/schema";
import { getAppContext } from "@/lib/session";
import { listWorkspaceBrands } from "@/server/workspace-data";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const brands = ctx ? await listWorkspaceBrands(ctx) : [];
  let role = "member";
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

  return (
    <div className="flex min-h-screen bg-cb-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-cb-control focus:bg-cb-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <AppSidebar
        workspaceName={ctx?.workspace.name ?? "Your workspace"}
        userLabel={ctx?.user.name ?? "Sign in"}
        roleLabel={ctx ? role : null}
        impersonating={Boolean(ctx?.impersonating)}
      />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <AppTopBar
          userLabel={ctx?.user.name ?? "Sign in"}
          roleLabel={ctx ? role : null}
          signedIn={Boolean(ctx)}
          brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
        />
        <main id="main" className="flex-1 px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
