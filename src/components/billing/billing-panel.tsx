"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EXTRA_BRAND_USD, EXTRA_RUN_USD, PLANS, type PlanId } from "@/lib/billing";

export function BillingPanel({
  currentPlan,
  status,
  brandsUsed,
  runsUsed,
  brandLimit,
  trialEndsAt,
  cancelAtPeriodEnd,
  extraBrands,
  extraRuns,
  currentPeriodEnd,
  seatsUsed,
  seatCap,
}: {
  currentPlan: string;
  status: string;
  brandsUsed: number;
  runsUsed: number;
  brandLimit: number;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  extraBrands: number;
  extraRuns: number;
  currentPeriodEnd: string | null;
  seatsUsed: number;
  seatCap: number;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const planId = (currentPlan in PLANS ? currentPlan : "agency") as PlanId;

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
      if (data.message) setMessage(data.message);
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setMessage(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; message?: string; error?: string; mode?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not open portal.");
        return;
      }
      if (data.message) setMessage(data.message);
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  async function toggleCancel(cancel: boolean) {
    setBusy("cancel");
    setMessage(null);
    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not update cancellation.");
        return;
      }
      setMessage(data.message ?? "Updated.");
      window.location.reload();
    } finally {
      setBusy(null);
    }
  }

  async function buyAddon(addon: "extra_brand" | "extra_run") {
    setBusy(addon);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addon }),
      });
      const data = (await response.json()) as { url?: string; message?: string; error?: string; mode?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Addon checkout failed.");
        return;
      }
      if (data.message) setMessage(data.message);
      if (data.mode === "stub") {
        setMessage(
          addon === "extra_brand"
            ? "Extra brand recorded locally (Dodo product id placeholder)."
            : "Extra run checkout stubbed. Usage still meters on overage runs.",
        );
        if (addon === "extra_brand") window.location.reload();
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <p className="text-xs text-cb-muted">Current plan</p>
        <p className="mt-2 text-lg font-semibold capitalize">{currentPlan}</p>
        <p className="mt-1 text-sm text-cb-muted">Status: {status}</p>
        {trialEndsAt ? <p className="mt-1 text-sm text-cb-muted">Trial ends {trialEndsAt}</p> : null}
        {cancelAtPeriodEnd ? (
          <p className="mt-1 text-sm text-cb-pending">
            Cancels at period end{currentPeriodEnd ? ` (${currentPeriodEnd})` : ""}. PDFs stay 90 days.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-cb-text">
          Usage: {brandsUsed}/{brandLimit} brands · {seatsUsed}/{seatCap} seats · {runsUsed} runs this period ·{" "}
          {extraBrands} extra brands · {extraRuns} metered extra runs
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void openPortal()}>
            {busy === "portal" ? "Opening…" : "Open billing portal"}
          </Button>
          {cancelAtPeriodEnd ? (
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void toggleCancel(false)}>
              Keep subscription
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void toggleCancel(true)}>
              Cancel at period end
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <p className="text-sm font-medium">Add-ons</p>
        <p className="mt-1 text-xs text-cb-muted">
          Extra brand ${EXTRA_BRAND_USD[planId]}/mo · Extra run ${EXTRA_RUN_USD[planId]} (meter or one-time). Set
          DODO_PRODUCT_EXTRA_BRAND / DODO_PRODUCT_EXTRA_RUN when live.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void buyAddon("extra_brand")}>
            {busy === "extra_brand" ? "Starting…" : "Buy extra brand"}
          </Button>
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void buyAddon("extra_run")}>
            {busy === "extra_run" ? "Starting…" : "Buy extra run pack"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const plan = PLANS[id];
          const recommended = id === "agency";
          return (
            <div
              key={id}
              className={`rounded-cb-card border bg-cb-surface p-5 ${
                recommended ? "border-cb-accent" : "border-cb-line"
              }`}
            >
              <p className="text-sm font-medium">{plan.name}</p>
              <p className="mt-2 font-mono text-2xl tabular-nums text-cb-accent">${plan.amountUsd}</p>
              <p className="mt-1 text-xs text-cb-muted">
                per month · {plan.brands} brands · {plan.seats} seats · {plan.cadence}
              </p>
              <Button
                className="mt-4 w-full"
                variant={recommended ? "default" : "outline"}
                disabled={busy !== null}
                onClick={() => void checkout(id)}
              >
                {busy === id ? "Starting…" : currentPlan === id ? "Current plan" : "Choose plan"}
              </Button>
            </div>
          );
        })}
      </div>
      {message ? <p className="text-sm text-cb-muted">{message}</p> : null}
    </div>
  );
}
