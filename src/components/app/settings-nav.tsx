"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app/settings", label: "Overview", match: (path: string) => path === "/app/settings" },
  {
    href: "/app/settings/workspace",
    label: "Workspace",
    match: (path: string) => path.startsWith("/app/settings/workspace"),
  },
  {
    href: "/app/settings/domains",
    label: "Domains",
    match: (path: string) => path.startsWith("/app/settings/domains"),
  },
  {
    href: "/app/settings/brand-kit",
    label: "Brand kit",
    match: (path: string) => path.startsWith("/app/settings/brand-kit"),
  },
  {
    href: "/app/settings/members",
    label: "Members",
    match: (path: string) => path.startsWith("/app/settings/members"),
  },
  {
    href: "/app/settings/billing",
    label: "Billing",
    match: (path: string) => path.startsWith("/app/settings/billing"),
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings" className="mb-8 flex flex-wrap gap-1 border-b border-cb-line pb-px">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b px-3 py-2 text-sm",
              active
                ? "border-cb-accent text-cb-accent"
                : "border-transparent text-cb-muted hover:text-cb-text",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
