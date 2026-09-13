"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EXTRA_BRAND_USD, EXTRA_RUN_USD, PLANS, SEAT_OVERAGE_USD } from "@/lib/billing";

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
  thirdBrand: {
    title: "Need a third client brand?",
    body: `Starter includes ${PLANS.starter.brands} brands. Agency includes ${PLANS.agency.brands} client brands and weekly Friday reports so every retainer gets a finished artifact.`,
    cta: "Upgrade to Agency",
  },
  fourthBrand: {
    title: "Need a third client brand?",
    body: `Starter includes ${PLANS.starter.brands} brands. Agency includes ${PLANS.agency.brands} client brands and weekly Friday reports so every retainer gets a finished artifact.`,
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
  sendStarter: {
    title: "Email sending is on Agency",
    body: "Starter can download the PDF and copy a client link. Agency emails the Friday report and can CC the client.",
    cta: "Upgrade to Agency",
  },
  fourthSeatAgency: {
    title: "You hit the Agency seat cap",
    body: `Add a seat for $${SEAT_OVERAGE_USD}/mo, or upgrade to Studio for ${PLANS.studio.seats} seats so larger account teams can share Friday reports.`,
    cta: "See billing",
  },
  extraSeat: {
    title: "You hit the seat cap",
    body: `Add a seat for $${SEAT_OVERAGE_USD}/mo. Studio includes ${PLANS.studio.seats} seats if the account team is growing.`,
    cta: "See billing",
  },
  customSender: {
    title: "Custom sender needs Studio",
    body: "Studio unlocks custom sender name and domain so reports leave from your agency address.",
    cta: "Upgrade to Studio",
  },
  membersStarter: {
    title: "Invites start on Agency",
    body: `Starter is ${PLANS.starter.seats} owner seat. Agency includes ${PLANS.agency.seats} seats so an account manager can send Friday reports.`,
    cta: "Upgrade to Agency",
  },
  extraBrandAgency: {
    title: "You hit the Agency brand cap",
    body: `Add an extra brand for $${EXTRA_BRAND_USD.agency}/mo, or move to Studio for ${PLANS.studio.brands} brands and custom sender.`,
    cta: "See billing",
  },
  extraRun: {
    title: "This run is outside the included cap",
    body: `Agency includes ${PLANS.agency.manualRerunsPerBrandPerWeek} manual re-runs per brand per week. Extra runs are $${EXTRA_RUN_USD.agency} so Friday delivery is never blocked by a re-check.`,
    cta: "See usage",
  },
} as const;
