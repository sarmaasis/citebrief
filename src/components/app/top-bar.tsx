"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { UserMenu } from "@/components/app/user-menu";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

export function AppTopBar({
  userLabel,
  roleLabel,
  brands,
  signedIn = true,
}: {
  userLabel: string;
  roleLabel?: string | null;
  brands: Array<{ id: string; name: string }>;
  signedIn?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showRunUpgrade, setShowRunUpgrade] = useState(false);
  const current = brands.find((brand) => pathname.startsWith(`/app/brands/${brand.id}`)) ?? brands[0];
  const hasBrand = Boolean(current);

  async function runNow() {
    if (!current) {
      router.push("/app/onboarding");
      return;
    }
    setError(null);
    setShowRunUpgrade(false);
    setPending(true);
    try {
      const response = await fetch(`/api/brands/${current.id}/runs`, { method: "POST" });
      const data = (await response.json()) as { runId?: string; error?: string; extraRun?: boolean };
      if (!response.ok || !data.runId) {
        setError(data.error ?? "Could not queue the run.");
        if (response.status === 402) setShowRunUpgrade(true);
        return;
      }
      router.push(`/app/brands/${current.id}/runs/${data.runId}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="relative flex h-14 items-center justify-between border-b border-cb-line bg-cb-bg px-6">
      <div className="flex min-w-0 items-center gap-3 text-sm">
        {brands.length ? (
          <label className="flex min-w-0 items-center gap-2 text-cb-muted">
            <span className="sr-only">Switch brand</span>
            <NativeSelect
              className="h-9 w-[220px]"
              value={current?.id}
              onChange={(event) => router.push(`/app/brands/${event.target.value}`)}
            >
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        {error ? <span className="truncate text-xs text-cb-danger">{error}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        {hasBrand ? (
          <Button type="button" onClick={() => void runNow()} disabled={pending}>
            {pending ? "Queuing…" : "Run now"}
          </Button>
        ) : null}
        {signedIn ? (
          <UserMenu userLabel={userLabel} roleLabel={roleLabel} />
        ) : (
          <Link href="/login" className="text-sm text-cb-muted">
            Sign in
          </Link>
        )}
      </div>
      {showRunUpgrade ? (
        <div className="absolute left-1/2 top-16 z-30 w-[min(32rem,calc(100%-3rem))] -translate-x-1/2">
          <UpgradePrompt
            title={UPGRADE_COPY.extraRun.title}
            body={UPGRADE_COPY.extraRun.body}
            cta={UPGRADE_COPY.extraRun.cta}
            onDismiss={() => setShowRunUpgrade(false)}
          />
        </div>
      ) : null}
    </header>
  );
}
