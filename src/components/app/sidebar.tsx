"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListChecks, Settings, Tag } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app", label: "Home", icon: Home, match: (path: string) => path === "/app" },
  { href: "/app/brands", label: "Clients", icon: Tag, match: (path: string) => path.startsWith("/app/brands") },
  {
    href: "/app/reports",
    label: "Briefs",
    icon: ListChecks,
    match: (path: string) => path === "/app/reports" || path.startsWith("/app/reports"),
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: Settings,
    match: (path: string) => path.startsWith("/app/settings"),
  },
] as const;

export function AppSidebar({
  workspaceName,
  userLabel,
  roleLabel,
  impersonating = false,
  briefsReady = 0,
}: {
  workspaceName: string;
  userLabel: string;
  roleLabel?: string | null;
  impersonating?: boolean;
  briefsReady?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[var(--cb-sidebar-width)] max-w-[85vw] shrink-0 flex-col border-r border-cb-line bg-cb-surface">
      <div className="flex h-14 items-center px-5">
        <Logo href="/app" />
      </div>
      <nav aria-label="Workspace" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          const showBadge = item.label === "Briefs" && briefsReady > 0;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-2 rounded-cb-control px-2 text-sm",
                active ? "bg-cb-accent-subtle text-cb-accent" : "text-cb-text hover:bg-cb-accent-subtle",
              )}
            >
              <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {showBadge ? (
                <span className="rounded-cb-control bg-cb-pending-subtle px-1.5 font-mono text-[11px] tabular-nums text-cb-pending">
                  {briefsReady}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-cb-line px-4 py-4">
        {impersonating ? (
          <p className="mb-2 text-xs text-cb-pending">Support view</p>
        ) : null}
        <p className="text-sm font-medium text-cb-text">
          {workspaceName.trim().toLowerCase() === "citebrief" ? "Your workspace" : workspaceName}
        </p>
        <p className="mt-1 text-xs text-cb-muted">{userLabel}</p>
        {roleLabel ? <p className="mt-1 text-xs capitalize text-cb-muted">{roleLabel}</p> : null}
      </div>
    </aside>
  );
}
