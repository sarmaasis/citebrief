import { headers } from "next/headers";
import { AppSidebar } from "@/components/app/sidebar";
import { AppTopBar } from "@/components/app/top-bar";
import { initAuth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let workspaceName = "Your workspace";
  let userLabel = "Sign in";

  try {
    const auth = await initAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (session?.user) {
      userLabel = session.user.name || session.user.email;
      workspaceName = session.user.name ? `${session.user.name} workspace` : "Workspace";
    }
  } catch {
    // Bindings may be unset during first local boot. Shell still renders.
  }

  return (
    <div className="flex min-h-screen bg-cb-bg">
      <AppSidebar workspaceName={workspaceName} userLabel={userLabel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopBar userLabel={userLabel} />
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
