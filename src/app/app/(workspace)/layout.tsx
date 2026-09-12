import { AppSidebar } from "@/components/app/sidebar";
import { AppTopBar } from "@/components/app/top-bar";
import { getAppContext } from "@/lib/session";
import { listWorkspaceBrands } from "@/server/workspace-data";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const brands = ctx ? await listWorkspaceBrands(ctx) : [];

  return (
    <div className="flex min-h-screen bg-cb-bg">
      <AppSidebar
        workspaceName={ctx?.workspace.name ?? "Your workspace"}
        userLabel={ctx?.user.name ?? "Sign in"}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopBar
          userLabel={ctx?.user.name ?? "Sign in"}
          brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
        />
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
