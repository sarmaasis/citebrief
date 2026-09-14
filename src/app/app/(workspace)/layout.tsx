import { and, eq } from "drizzle-orm";
import { WorkspaceChrome } from "@/components/app/workspace-chrome";
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
    <WorkspaceChrome
      workspaceName={ctx?.workspace.name ?? "Your workspace"}
      userLabel={ctx?.user.name ?? "Sign in"}
      roleLabel={ctx ? role : null}
      impersonating={Boolean(ctx?.impersonating)}
      signedIn={Boolean(ctx)}
      brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
    >
      {children}
    </WorkspaceChrome>
  );
}
