"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app/sidebar";
import { AppTopBar } from "@/components/app/top-bar";

export function WorkspaceChrome({
  children,
  workspaceName,
  userLabel,
  roleLabel,
  impersonating,
  signedIn,
  brands,
  recheckHint,
}: {
  children: React.ReactNode;
  workspaceName: string;
  userLabel: string;
  roleLabel?: string | null;
  impersonating?: boolean;
  signedIn: boolean;
  brands: Array<{ id: string; name: string }>;
  recheckHint?: string | null;
}) {
  const pathname = usePathname();
  const [navState, setNavState] = useState({ open: false, pathname });
  const navOpen = navState.open && navState.pathname === pathname;
  const closeNav = () => setNavState({ open: false, pathname });
  const openNav = () => setNavState({ open: true, pathname });

  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

  return (
    <div className="flex h-svh overflow-hidden bg-cb-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-cb-control focus:bg-cb-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      {navOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-[color:var(--cb-overlay)] lg:hidden"
          onClick={closeNav}
        />
      ) : null}
      <div
        className={
          navOpen
            ? "fixed inset-y-0 left-0 z-50 flex lg:static lg:z-0"
            : "hidden h-full shrink-0 lg:flex"
        }
      >
        <AppSidebar
          workspaceName={workspaceName}
          userLabel={userLabel}
          roleLabel={roleLabel}
          impersonating={impersonating}
        />
      </div>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <AppTopBar
          userLabel={userLabel}
          roleLabel={roleLabel}
          signedIn={signedIn}
          brands={brands}
          onOpenNav={openNav}
          recheckHint={recheckHint}
        />
        <main id="main" className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
