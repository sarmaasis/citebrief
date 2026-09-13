"use client";

import { useState } from "react";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { Button } from "@/components/ui/button";

export function CadenceCard({
  friday,
  allowsWeekly,
}: {
  friday: string;
  allowsWeekly: boolean;
}) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (allowsWeekly) {
    return (
      <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <p className="text-xs text-cb-muted">Next Friday</p>
        <p className="mt-3 text-sm text-cb-text">{friday}</p>
        <p className="mt-2 text-xs text-cb-muted">Friday cron send lands in a later phase.</p>
      </div>
    );
  }

  return (
    <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
      <p className="text-xs text-cb-muted">Report cadence</p>
      <p className="mt-3 text-sm text-cb-text">Monthly on Starter</p>
      <p className="mt-2 text-xs text-cb-muted">Weekly Friday reports ship on Agency.</p>
      <div className="mt-3">
        <Button type="button" size="sm" variant="outline" onClick={() => setShowUpgrade(true)}>
          Want weekly?
        </Button>
      </div>
      {showUpgrade ? (
        <div className="mt-4">
          <UpgradePrompt
            title={UPGRADE_COPY.weeklyStarter.title}
            body={UPGRADE_COPY.weeklyStarter.body}
            cta={UPGRADE_COPY.weeklyStarter.cta}
            onDismiss={() => setShowUpgrade(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
