"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { authClient } from "@/auth/client";

export function UserMenu({
  userLabel,
  roleLabel,
}: {
  userLabel: string;
  roleLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="rounded-cb-control px-2 py-1 text-sm text-cb-muted hover:bg-cb-accent-subtle hover:text-cb-text"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {userLabel}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-40 mt-2 w-52 rounded-cb-card border border-cb-line bg-cb-surface py-1 shadow-[var(--cb-shadow-menu)]"
        >
          {roleLabel ? (
            <p className="px-3 py-2 text-xs capitalize text-cb-muted">{roleLabel}</p>
          ) : null}
          <Link
            role="menuitem"
            href="/app/settings"
            className="block px-3 py-2 text-sm text-cb-text hover:bg-cb-accent-subtle"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <Link
            role="menuitem"
            href="/app/settings/billing"
            className="block px-3 py-2 text-sm text-cb-text hover:bg-cb-accent-subtle"
            onClick={() => setOpen(false)}
          >
            Billing
          </Link>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-cb-text hover:bg-cb-accent-subtle"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
