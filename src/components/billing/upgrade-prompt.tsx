"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

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

export const UPGRADE_COPY = {
  fourthBrand: {
    title: "Need a 4th brand?",
    body: "Agency includes 8 brands and weekly Friday reports so every retainer gets a finished artifact.",
    cta: "Upgrade to Agency",
  },
  weeklyStarter: {
    title: "Weekly reports are on Agency",
    body: "Starter stays monthly. Agency ships every Friday with white-label and client CC.",
    cta: "Upgrade to Agency",
  },
  ccStarter: {
    title: "Client CC is Agency and Studio",
    body: "Keep CiteBrief for your team on Starter, or upgrade when you want the Friday email to land in the client inbox.",
    cta: "Upgrade to Agency",
  },
  fourthSeatAgency: {
    title: "You hit the Agency seat cap",
    body: "Studio includes 10 seats so larger account teams can share brands and Friday reports.",
    cta: "Upgrade to Studio",
  },
  customSender: {
    title: "Custom sender needs Studio",
    body: "Studio unlocks custom sender name and domain so reports leave from your agency address.",
    cta: "Upgrade to Studio",
  },
} as const;
