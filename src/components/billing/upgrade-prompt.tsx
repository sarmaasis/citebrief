"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export { UPGRADE_COPY } from "@/lib/upgrade-copy";

export function UpgradePrompt({
  title,
  body,
  cta,
  href = "/app/settings/billing",
  onDismiss,
}: {
  title: string;
  body: string;
  cta: string;
  href?: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="rounded-cb-card border border-cb-line bg-cb-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cb-text">{title}</p>
          <p className="mt-1 text-sm text-cb-muted">{body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={href}>{cta}</Link>
            </Button>
            {onDismiss ? (
              <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
                Dismiss
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
