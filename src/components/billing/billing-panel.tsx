"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/billing";

export function BillingPanel({
  currentPlan,
  status,
  brandsUsed,
  runsUsed,
  brandLimit,
  trialEndsAt,
}: {
  currentPlan: string;
  status: string;
  brandsUsed: number;
  runsUsed: number;
  brandLimit: number;
  trialEndsAt: string | null;
}) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function checkout(plan: PlanId) {
    setBusy(plan);
    setMessage(null);
    try {
      const response = await fetch(`/api/checkout?plan=${plan}&redirect=0`);
      const data = (await response.json()) as { url?: string; message?: string; error?: string; mode?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Checkout failed.");
        return;
      }
      if (data.message) {
        setMessage(data.message);
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setBusy(null);
    }
  }

  function openPortal() {
    setMessage("Dodo customer portal is stubbed until live keys and customer id exist.");
  }

  return (
    <div className="space-y-8">
      <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <p className="text-xs text-cb-muted">Current plan</p>
        <p className="mt-2 text-lg font-semibold capitalize">{currentPlan}</p>
        <p className="mt-1 text-sm text-cb-muted">Status: {status}</p>
        {trialEndsAt ? <p className="mt-1 text-sm text-cb-muted">Trial ends {trialEndsAt}</p> : null}
        <p className="mt-4 text-sm text-cb-text">
          Usage: {brandsUsed}/{brandLimit} brands · {runsUsed} runs this period
        </p>
        <div className="mt-4">
          <Button type="button" variant="outline" onClick={openPortal}>
            Open billing portal
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((planId) => {
          const plan = PLANS[planId];
          const recommended = planId === "agency";
          return (
            <div
              key={planId}
              className={`rounded-cb-card border bg-cb-surface p-5 ${
                recommended ? "border-cb-accent" : "border-cb-line"
              }`}
            >
              <p className="text-sm font-medium">{plan.name}</p>
              <p className="mt-2 font-mono text-2xl tabular-nums text-cb-accent">${plan.amountUsd}</p>
              <p className="mt-1 text-xs text-cb-muted">per month · {plan.brands} brands · {plan.cadence}</p>
              <Button
                className="mt-4 w-full"
                variant={recommended ? "default" : "outline"}
                disabled={busy !== null}
                onClick={() => void checkout(planId)}
              >
                {busy === planId ? "Starting…" : currentPlan === planId ? "Current plan" : "Choose plan"}
              </Button>
            </div>
          );
        })}
      </div>
      {message ? <p className="text-sm text-cb-muted">{message}</p> : null}
    </div>
  );
}
