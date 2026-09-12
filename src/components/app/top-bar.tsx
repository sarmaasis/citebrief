"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AppTopBar({
  userLabel,
  brands,
}: {
  userLabel: string;
  brands: Array<{ id: string; name: string }>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const current = brands.find((brand) => pathname.startsWith(`/app/brands/${brand.id}`)) ?? brands[0];

  async function runNow() {
    if (!current) {
      router.push("/app/onboarding");
      return;
    }
    setError(null);
    const response = await fetch(`/api/brands/${current.id}/runs`, { method: "POST" });
    const data = (await response.json()) as { runId?: string; error?: string };
    if (!response.ok || !data.runId) {
      setError(data.error ?? "Could not queue the run.");
      return;
    }
    router.push(`/app/brands/${current.id}/runs/${data.runId}`);
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-cb-line bg-cb-bg px-6">
      <div className="flex items-center gap-3 text-sm">
        {brands.length ? (
          <label className="flex items-center gap-2 text-cb-muted">
            <span className="sr-only">Brand switcher</span>
            <select
              className="h-9 rounded-cb-control border border-cb-line bg-cb-surface px-2 text-sm text-cb-text"
              value={current?.id}
              onChange={(event) => router.push(`/app/brands/${event.target.value}`)}
            >
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-cb-muted">Brand switcher</span>
        )}
        {error ? <span className="text-xs text-cb-danger">{error}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => void runNow()}>
          Run now
        </Button>
        <Link href="/login" className="text-sm text-cb-muted">
          {userLabel}
        </Link>
      </div>
    </header>
  );
}
