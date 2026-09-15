"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { UserMenu } from "@/components/app/user-menu";
import { cn } from "@/lib/utils";

function formatRecheckHint(usage: {
  monthlyRechecksRemaining?: number;
  monthlyRecheckCredits?: number;
  extraRunCredits?: number;
}): string | null {
  const remaining = Math.max(0, usage.monthlyRechecksRemaining ?? 0);
  const included = Math.max(0, usage.monthlyRecheckCredits ?? 0);
  const credits = Math.max(0, usage.extraRunCredits ?? 0);
  if (included <= 0 && credits <= 0) return null;
  if (credits > 0) {
    return `${remaining}/${included} rechecks · ${credits} extra credit${credits === 1 ? "" : "s"}`;
  }
  return remaining === 0
    ? `${remaining}/${included} rechecks left · buy extra to re-run past included`
    : `${remaining}/${included} recheck${included === 1 ? "" : "s"} left`;
}

// Survive layout remounts across soft navigations (OpenNext often re-sends the shell).
let recheckHintCache: { value: string | null; at: number } | null = null;
const RECHECK_HINT_TTL_MS = 60_000;

export function AppTopBar({
  userLabel,
  roleLabel,
  brands,
  signedIn = true,
  onOpenNav,
  recheckHint,
  loadRecheckHint = false,
}: {
  userLabel: string;
  roleLabel?: string | null;
  brands: Array<{ id: string; name: string }>;
  signedIn?: boolean;
  onOpenNav?: () => void;
  /** Optional “2 rechecks left” style hint for paid plans. */
  recheckHint?: string | null;
  /** Fetch remaining rechecks once; keeps workspace layout off the usage snapshot path. */
  loadRecheckHint?: boolean;
}) {
  const pathname = usePathname();
  const current = brands.find((brand) => pathname.startsWith(`/app/brands/${brand.id}`)) ?? brands[0];
  const [fetchedHint, setFetchedHint] = useState<string | null>(() => {
    if (
      loadRecheckHint &&
      recheckHintCache &&
      Date.now() - recheckHintCache.at < RECHECK_HINT_TTL_MS
    ) {
      return recheckHintCache.value;
    }
    return null;
  });
  const hint = recheckHint ?? fetchedHint;

  useEffect(() => {
    if (!loadRecheckHint || !signedIn || recheckHint) return;
    if (recheckHintCache && Date.now() - recheckHintCache.at < RECHECK_HINT_TTL_MS) {
      return;
    }
    let cancelled = false;
    void fetch("/api/billing/usage")
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { usage?: Parameters<typeof formatRecheckHint>[0] };
        return data.usage ? formatRecheckHint(data.usage) : null;
      })
      .then((next) => {
        recheckHintCache = { value: next, at: Date.now() };
        if (!cancelled && next) setFetchedHint(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadRecheckHint, signedIn, recheckHint]);

  return (
    <header className="relative z-20 flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-cb-line bg-cb-bg px-4 py-2 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:gap-3">
        {onOpenNav ? (
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-cb-control border border-cb-line text-cb-text lg:hidden"
            aria-label="Open menu"
            onClick={onOpenNav}
          >
            <Menu size={18} strokeWidth={1.5} />
          </button>
        ) : null}
        {brands.length && current ? <BrandSwitcher brands={brands} currentId={current.id} /> : null}
        {hint ? (
          <Link href="/app/settings/billing" className="hidden truncate text-xs text-cb-muted hover:text-cb-accent md:inline">
            {hint}
          </Link>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {signedIn ? (
          <UserMenu userLabel={userLabel} roleLabel={roleLabel} />
        ) : (
          <Link href="/login" className="text-sm text-cb-muted">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function BrandSwitcher({
  brands,
  currentId,
}: {
  brands: Array<{ id: string; name: string }>;
  currentId: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const current = brands.find((brand) => brand.id === currentId);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative min-w-0 max-w-[220px]" ref={rootRef}>
      <button
        type="button"
        className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-cb-control border border-cb-line bg-cb-surface px-3 text-sm text-cb-text"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-label="Switch brand"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{current?.name}</span>
        <ChevronDown className="size-4 shrink-0 text-cb-muted" strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="listbox"
          className="absolute left-0 z-40 mt-2 max-h-80 w-56 overflow-y-auto rounded-cb-card border border-cb-line bg-cb-surface py-1 shadow-[var(--cb-shadow-menu)]"
        >
          {brands.map((brand) => (
            <button
              key={brand.id}
              type="button"
              role="option"
              aria-selected={brand.id === currentId}
              className={cn(
                "block w-full truncate px-3 py-2 text-left text-sm",
                brand.id === currentId
                  ? "bg-cb-accent-subtle text-cb-accent"
                  : "text-cb-text hover:bg-cb-accent-subtle",
              )}
              onClick={() => {
                setOpen(false);
                router.push(`/app/brands/${brand.id}`);
              }}
            >
              {brand.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
