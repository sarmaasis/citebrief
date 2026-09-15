"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogCloseButton } from "@/components/ui/dialog";
import {
  EXTRA_BRAND_USD,
  EXTRA_RUN_USD,
  PLANS,
  PUBLIC_PLAN_IDS,
  planAnnualAmountUsd,
  planCardState,
  resolveSelectedPlan,
  SEAT_OVERAGE_USD,
  TRIAL_DAYS,
  TRIAL_RUN_CAP,
  type PlanId,
} from "@/lib/billing";
import { formatPaidRunsUsageHint } from "@/lib/usage-format";
import { cn } from "@/lib/utils";

const PLAN_VALUE: Record<(typeof PUBLIC_PLAN_IDS)[number], string[]> = {
  starter: [
    `${PLANS.starter.brands} brands`,
    `${PLANS.starter.brands * PLANS.starter.prompts} tracked question capacity`,
    "Monthly cadence",
    "Lighter Home (no command center)",
    "CiteBrief sender",
    "PDF + client link",
    `${PLANS.starter.seats} seat`,
  ],
  agency: [
    `${PLANS.agency.brands} brands or projects`,
    `${PLANS.agency.brands * PLANS.agency.prompts} tracked question capacity`,
    "Weekly Friday reports",
    "Team visibility dashboard",
    "Private report links and email sending",
    "Scorecards, risks, opportunities, pipeline",
    "History and week-over-week movement",
    `${PLANS.agency.seats} seats`,
    "Slack webhook",
    "Cited pages on every report",
    "Prospect pitch audits (48h)",
    "Coming soon: Looker Studio/API exports and deeper source monitoring",
  ],
  studio: [
    `${PLANS.studio.brands} client brands`,
    `${PLANS.studio.brands * PLANS.studio.prompts} tracked question capacity`,
    "Custom sender name and domain",
    "Bulk send and portfolio CSV export",
    "ChatGPT, Gemini, Grok, and AI Overviews",
    `${PLANS.studio.seats} seats`,
    "Cited pages and prospect pitch audits",
    "Coming soon: client portal archive, Looker Studio/API exports, priority processing",
  ],
};

export type BillingUsage = {
  plan: string;
  status: string;
  paid: boolean;
  trialing: boolean;
  billingInterval: "monthly" | "annual";
  brandsUsed: number;
  brandLimit: number;
  brandsIncluded: number;
  extraBrands: number;
  extraBrandBillable: number;
  seatsUsed: number;
  seatCap: number;
  seatsIncluded: number;
  extraSeats: number;
  runsUsed: number;
  extraRuns: number;
  extraRunCredits: number;
  monthlyRecheckCredits: number;
  monthlyRechecksUsed?: number;
  monthlyRechecksRemaining?: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  allowsExtraBrands: boolean;
  allowsMembers: boolean;
  allowsWeeklyCadence: boolean;
  allowsCustomSender: boolean;
  allowsClientCc: boolean;
};

function UsageMeter({
  label,
  used,
  cap,
  hint,
}: {
  label: string;
  used: number;
  cap: number;
  hint?: string;
}) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-cb-text">{label}</p>
        <p className="font-mono text-xs tabular-nums text-cb-muted">
          {used}/{cap}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cb-muted-bg">
        <div className="h-full bg-cb-accent" style={{ width: `${pct}%` }} />
      </div>
      {hint ? <p className="mt-1 text-xs text-cb-muted">{hint}</p> : null}
    </div>
  );
}

export function BillingPanel({
  usage,
  canManage = true,
}: {
  usage: BillingUsage;
  canManage?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [annual, setAnnual] = useState(usage.billingInterval === "annual");
  const selectedPlan = resolveSelectedPlan(usage.plan);
  const isPaid = usage.paid;
  const isTrialing = usage.trialing && !isPaid;
  const paymentFailed = usage.status === "failed" || usage.status === "past_due";
  const extraBrandPrice = EXTRA_BRAND_USD[selectedPlan];
  const canBuyAddons = isPaid;
  const canBuyExtraBrand = isPaid && usage.allowsExtraBrands;
  const canBuyExtraSeat = isPaid && usage.allowsMembers;
  const showUpgradeToAgency = isPaid && selectedPlan === "starter";
  const selectedName = PLANS[selectedPlan].name;

  async function checkout(plan: PlanId, intervalOverride?: "monthly" | "annual") {
    if (!canManage) return;
    setBusy(plan);
    setMessage(null);
    try {
      const interval = intervalOverride ?? (annual ? "annual" : "monthly");
      const response = await fetch(`/api/checkout?plan=${plan}&interval=${interval}&redirect=0`);
      const data = (await response.json()) as {
        url?: string;
        message?: string;
        error?: string;
        mode?: string;
        paid?: boolean;
      };
      if (!response.ok) {
        setMessage(data.error ?? "Checkout failed.");
        return;
      }
      if (data.mode === "stub") {
        setMessage(
          data.paid
            ? `Test checkout activated ${PLANS[plan].name}${interval === "annual" ? " annual" : ""}.`
            : "Test checkout did not activate a paid plan. Try Billing again.",
        );
        if (data.paid) {
          window.location.reload();
          return;
        }
      } else if (data.message) {
        setMessage(data.message);
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    if (!canManage) return;
    setBusy("portal");
    setMessage(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; message?: string; error?: string; mode?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not open the billing portal.");
        return;
      }
      if (data.mode === "stub") {
        setMessage("The portal opens once billing is live. Invoices and card updates will live there.");
      }
      if (data.message && data.mode !== "stub") setMessage(data.message);
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  async function toggleCancel(cancel: boolean) {
    if (!canManage) return;
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
      setCancelOpen(false);
      setMessage(
        cancel
          ? "Cancels at period end. PDFs stay available for 90 days."
          : "Subscription stays active.",
      );
      window.location.reload();
    } finally {
      setBusy(null);
    }
  }

  async function buyAddon(addon: "extra_brand" | "extra_run" | "extra_seat") {
    if (!canManage) return;
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
        setMessage(data.error ?? "Could not start that add-on.");
        return;
      }
      if (data.mode === "stub") {
        setMessage(
          addon === "extra_brand"
            ? "Extra brand added to this workspace. Live billing will invoice it on the next cycle."
            : addon === "extra_seat"
              ? "Extra seat added. Invite the account manager from Members."
              : "Extra run credit recorded. Over-cap runs use credits, then $9.",
        );
        window.location.reload();
        return;
      }
      if (data.message) setMessage(data.message);
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {paymentFailed ? (
        <div className="rounded-cb-card border border-cb-line bg-cb-pending-subtle p-4">
          <p className="text-sm font-medium text-cb-pending">Payment failed</p>
          <p className="mt-1 text-sm text-cb-muted">
            Update the card in the billing portal so Friday reports keep sending.
          </p>
          {canManage ? (
            <Button type="button" size="sm" className="mt-3" disabled={busy !== null} onClick={() => void openPortal()}>
              Update payment
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <p className="text-xs text-cb-muted">Current plan</p>
        <p className="mt-2 text-lg font-semibold">
          {isTrialing ? `${TRIAL_DAYS}-day trial` : isPaid ? selectedName : "No paid plan yet"}
        </p>
        <p className="mt-1 text-sm text-cb-muted">
          {isTrialing
            ? `Continues as ${selectedName} after trial${usage.trialEndsAt ? ` · ends ${usage.trialEndsAt}` : ""}`
            : isPaid
              ? `${usage.status} · ${usage.billingInterval}`
              : `${selectedName} selected`}
        </p>
        {usage.cancelAtPeriodEnd ? (
          <p className="mt-2 text-sm text-cb-pending">
            Cancels at period end{usage.currentPeriodEnd ? ` (${usage.currentPeriodEnd})` : ""}. PDFs stay 90 days.
          </p>
        ) : isPaid && usage.currentPeriodEnd ? (
          <p className="mt-2 text-sm text-cb-muted">Current period ends {usage.currentPeriodEnd}.</p>
        ) : null}

        <div className="mt-6 grid gap-5 sm:grid-cols-4">
          <UsageMeter
            label="Brands"
            used={usage.brandsUsed}
            cap={usage.brandLimit}
            hint={
              isTrialing
                ? "Trial includes 1 brand"
                : !isPaid
                  ? "1 brand until you subscribe"
              : `${usage.brandsIncluded} included${usage.extraBrandBillable ? ` · ${usage.extraBrandBillable} extra billed` : ""}`
            }
          />
          <UsageMeter
            label="Tracked questions"
            used={Math.min(
              usage.brandsUsed * PLANS[selectedPlan].prompts,
              usage.brandLimit * PLANS[selectedPlan].prompts,
            )}
            cap={usage.brandLimit * PLANS[selectedPlan].prompts}
            hint={`${PLANS[selectedPlan].prompts} buyer questions per brand on ${selectedName}`}
          />
          <UsageMeter
            label="Seats"
            used={usage.seatsUsed}
            cap={usage.seatCap}
            hint={
              isTrialing
                ? "Trial includes 1 seat"
                : !isPaid
                  ? "1 seat until you subscribe"
                  : `${usage.seatsIncluded} included${usage.extraSeats ? ` · ${usage.extraSeats} extra at $${SEAT_OVERAGE_USD}/mo` : ""}`
            }
          />
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-cb-text">{isPaid ? "Runs this period" : isTrialing ? "Trial reports" : "Reports"}</p>
              <p className="font-mono text-xs tabular-nums text-cb-muted">
                {!isPaid ? `${usage.runsUsed}/${TRIAL_RUN_CAP}` : usage.runsUsed}
              </p>
            </div>
            <p className="mt-3 text-xs text-cb-muted">
              {!isPaid
                ? `Trial includes ${TRIAL_RUN_CAP} full report. Extra runs start on a paid plan.`
                : formatPaidRunsUsageHint({
                    plan: selectedPlan,
                    billableExtrasThisPeriod: usage.extraRuns,
                    monthlyRecheckCredits: usage.monthlyRecheckCredits,
                    monthlyRechecksRemaining:
                      usage.monthlyRechecksRemaining ?? usage.monthlyRecheckCredits,
                    extraRunCredits: usage.extraRunCredits,
                  })}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-cb-card border border-cb-line bg-cb-bg px-4 py-3">
          <p className="text-xs font-medium text-cb-text">Coming soon after launch feedback</p>
          <p className="mt-1 text-xs leading-5 text-cb-muted">
            Visibility alerts, prompt research, multi-country tracking, and export connectors stay later.
            Cited pages and prospect pitch audits ship on {PLANS.agency.name} and {PLANS.studio.name}.
          </p>
        </div>

        <p className="mt-5 text-xs text-cb-muted">
          {isPaid
            ? "Included usage is on the plan. Extra brands, seats, and runs show as billable before they charge. Invoices live in the billing portal."
            : `These meters are trial limits, not ${selectedName} entitlements. Subscribe below to unlock ${selectedName}.`}
        </p>

        {canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {isPaid ? (
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void openPortal()}>
                {busy === "portal" ? "Opening…" : "Open billing portal"}
              </Button>
            ) : null}
            {usage.cancelAtPeriodEnd ? (
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void toggleCancel(false)}>
                Keep subscription
              </Button>
            ) : isPaid ? (
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setCancelOpen(true)}>
                Cancel at period end
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-cb-muted">Only a workspace owner can change billing.</p>
        )}
      </div>

      {canBuyAddons ? (
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-sm font-medium">Add-ons</p>
          <p className="mt-1 text-sm text-cb-muted">
            Extra brand ${extraBrandPrice}/mo on {PLANS.agency.name} and {PLANS.studio.name} only (not Starter). Extra seat $
            {SEAT_OVERAGE_USD}/mo after the seat cap. Extra run ${EXTRA_RUN_USD[selectedPlan]} after
            monthly re-check credits.
          </p>
          {canManage ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {canBuyExtraBrand ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void buyAddon("extra_brand")}
                >
                  {busy === "extra_brand" ? "Starting…" : `Add extra brand · $${extraBrandPrice}/mo`}
                </Button>
              ) : showUpgradeToAgency ? (
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void checkout("agency")}>
                  Need more brands? Upgrade to {PLANS.agency.name}
                </Button>
              ) : null}
              {canBuyExtraSeat ? (
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void buyAddon("extra_seat")}>
                  {busy === "extra_seat" ? "Starting…" : `Add extra seat · $${SEAT_OVERAGE_USD}/mo`}
                </Button>
              ) : null}
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void buyAddon("extra_run")}>
                {busy === "extra_run" ? "Starting…" : `Buy extra run · $${EXTRA_RUN_USD[selectedPlan]}`}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">Plans</p>
          <div className="inline-flex rounded-cb-control border border-cb-line p-0.5" role="group" aria-label="Billing interval">
            <button
              type="button"
              className={cn(
                "h-8 rounded-[7px] px-3 text-xs",
                !annual ? "bg-cb-accent text-cb-on-accent" : "text-cb-muted",
              )}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              className={cn(
                "h-8 rounded-[7px] px-3 text-xs",
                annual ? "bg-cb-accent text-cb-on-accent" : "text-cb-muted",
              )}
              onClick={() => setAnnual(true)}
            >
              Annual · 2 months free
            </button>
          </div>
        </div>

        {canManage && (!isPaid || usage.billingInterval !== "annual" || selectedPlan !== "agency") ? (
          <div className="mb-4 rounded-cb-card border border-cb-accent bg-cb-surface px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-cb-text">{PLANS.agency.name} annual · ${planAnnualAmountUsd("agency").toLocaleString("en-US")}/year</p>
                <p className="mt-1 text-xs text-cb-muted">
                  10 months prepaid (2 months free). Same {PLANS.agency.name} features — weekly Friday reports, email sending, command center.
                </p>
              </div>
              <Button
                type="button"
                disabled={busy !== null || (isPaid && selectedPlan === "agency" && usage.billingInterval === "annual")}
                onClick={() => {
                  setAnnual(true);
                  void checkout("agency", "annual");
                }}
              >
                {busy === "agency" && annual ? "Starting…" : `Get ${PLANS.agency.name} annual · $${planAnnualAmountUsd("agency").toLocaleString("en-US")}`}
              </Button>
            </div>
          </div>
        ) : null}

        <p className="mb-4 text-xs text-cb-muted">
          {isTrialing
            ? `Annual is 10 months prepaid. Subscribe to continue as ${selectedName} after the trial. Trial limits stay until payment succeeds.`
            : "Annual is 10 months prepaid. Choosing a plan starts checkout for the interval selected above."}
        </p>
        <div className="grid items-stretch gap-4 md:grid-cols-3">
          {PUBLIC_PLAN_IDS.map((id) => {
            const plan = PLANS[id];
            const card = planCardState({
              id,
              selectedPlan,
              isPaid,
              isTrialing,
              currentInterval: usage.billingInterval,
              viewingAnnual: annual,
            });
            const monthly = plan.amountUsd;
            const display = annual ? Math.round((monthly * 10) / 12) : monthly;
            return (
              <div
                key={id}
                className={`flex h-full flex-col rounded-cb-card border bg-cb-surface p-5 ${
                  card.highlighted ? "border-cb-accent" : "border-cb-line"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{plan.name}</p>
                  {card.badge ? <span className="text-xs text-cb-accent">{card.badge}</span> : null}
                </div>
                <p
                  className={`mt-2 font-mono text-2xl tabular-nums ${
                    card.highlighted ? "text-cb-accent" : "text-cb-text"
                  }`}
                >
                  ${display}
                </p>
                <p className="mt-1 text-xs text-cb-muted">{annual ? "per month, billed annually" : "per month"}</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-xs text-cb-muted">
                  {PLAN_VALUE[id].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="mt-auto pt-4">
                  <Button
                    className="w-full"
                    variant={card.highlighted ? "default" : "outline"}
                    disabled={busy !== null || card.isCurrentInterval || !canManage}
                    onClick={() => void checkout(id)}
                  >
                    {busy === id ? "Starting…" : card.cta}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-cb-card border border-cb-line bg-cb-surface px-5 py-4">
          <p className="text-sm text-cb-text">
            Enterprise from ${PLANS.enterprise.amountUsd.toLocaleString("en-US")}
            {isPaid && selectedPlan === "enterprise" ? " · Current plan" : ""}
          </p>
          <p className="mt-1 text-sm text-cb-muted">
            Contract for custom limits, SSO, and onboarding. No self-serve checkout.{" "}
            <a href="mailto:support@getcitebrief.com" className="text-cb-accent">
              Talk to us
            </a>
            .
          </p>
        </div>
      </div>

      {message ? <p className="text-sm text-cb-muted">{message}</p> : null}

      <Dialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel at period end?"
        description="You keep the workspace until the period ends. PDFs stay downloadable for 90 days."
      >
        <DialogActions>
          <DialogCloseButton onClick={() => setCancelOpen(false)} />
          <Button type="button" size="sm" disabled={busy !== null} onClick={() => void toggleCancel(true)}>
            {busy === "cancel" ? "Saving…" : "Confirm cancel"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
