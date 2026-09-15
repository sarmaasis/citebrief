import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillingPanel } from "@/components/billing/billing-panel";
import { billingPageIntro, resolveSelectedPlan } from "@/lib/billing";
import { agencyRoi, opportunityFromRow } from "@/lib/command-center";
import { formatShortDate } from "@/lib/friday";
import { canManageBilling } from "@/lib/permissions";
import { getAppContext } from "@/lib/session";
import { getUsageSnapshot } from "@/lib/usage";
import { loadCommandRows } from "@/server/command-center-data";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingSettingsPage() {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }

  const snapshot = await getUsageSnapshot(ctx.db, ctx.workspace.id);
  const canManage = canManageBilling(ctx.role) || Boolean(ctx.impersonating);
  const selectedPlan = resolveSelectedPlan(snapshot.plan);
  const command = snapshot.paid
    ? await loadCommandRows(ctx, snapshot.allowsWeeklyCadence)
    : null;
  const roi = command
    ? agencyRoi({
        brands: command.rows.length,
        reportsGenerated: command.rows.filter((row) => Boolean(row.latestReport)).length,
        reportsSent: command.rows.filter((row) => Boolean(row.latestReport?.sentAt)).length,
        opportunities: command.rows.filter((row) => opportunityFromRow(row)).length,
        minutesPerReport: command.minutesSavedPerReport,
      })
    : null;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-3 text-sm text-cb-muted">
        {billingPageIntro({
          trialing: snapshot.trialing,
          paid: snapshot.paid,
          plan: selectedPlan,
        })}
      </p>
      <div className="mt-8">
        <BillingPanel
          canManage={canManage}
          usage={{
            plan: snapshot.plan,
            status: snapshot.status,
            paid: snapshot.paid,
            trialing: snapshot.trialing,
            billingInterval: snapshot.billingInterval,
            brandsUsed: snapshot.brandsUsed,
            brandLimit: snapshot.brandLimit,
            brandsIncluded: snapshot.brandsIncluded,
            extraBrands: snapshot.extraBrands,
            extraBrandBillable: snapshot.extraBrandBillable,
            seatsUsed: snapshot.seatsUsed,
            seatCap: snapshot.seatCap,
            seatsIncluded: snapshot.seatsIncluded,
            extraSeats: snapshot.extraSeats,
            runsUsed: snapshot.runsUsed,
            extraRuns: snapshot.extraRuns,
            extraRunCredits: snapshot.extraRunCredits,
            monthlyRecheckCredits: snapshot.monthlyRecheckCredits,
            monthlyRechecksUsed: snapshot.monthlyRechecksUsed,
            monthlyRechecksRemaining: snapshot.monthlyRechecksRemaining,
            trialEndsAt: snapshot.trialEndsAt ? formatShortDate(new Date(snapshot.trialEndsAt)) : null,
            currentPeriodEnd: snapshot.currentPeriodEnd
              ? formatShortDate(new Date(snapshot.currentPeriodEnd))
              : null,
            cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
            allowsExtraBrands: snapshot.allowsExtraBrands,
            allowsMembers: snapshot.allowsMembers,
            allowsWeeklyCadence: snapshot.allowsWeeklyCadence,
            allowsCustomSender: snapshot.allowsCustomSender,
            allowsClientCc: snapshot.allowsClientCc,
          }}
        />
      </div>
      {roi ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium">Your impact</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Brands monitored", roi.brands],
              ["Reports generated", roi.reportsGenerated],
              ["Reports sent", roi.reportsSent],
              ["Opportunities", roi.opportunities],
              ["Est. hours saved", roi.hoursSaved],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-cb-card border border-cb-line bg-cb-surface px-4 py-3">
                <p className="text-xs text-cb-muted">{label}</p>
                <p className="mt-1 font-mono text-xl tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-cb-muted">
            Hours saved uses {roi.minutesPerReport} minutes per generated report (set in workspace settings).
          </p>
        </section>
      ) : null}
    </div>
  );
}
