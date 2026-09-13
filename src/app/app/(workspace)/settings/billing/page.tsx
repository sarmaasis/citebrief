import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillingPanel } from "@/components/billing/billing-panel";
import { billingPageIntro, resolveSelectedPlan } from "@/lib/billing";
import { formatShortDate } from "@/lib/friday";
import { canManageBilling } from "@/lib/permissions";
import { getAppContext } from "@/lib/session";
import { getUsageSnapshot } from "@/lib/usage";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingSettingsPage() {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }

  const snapshot = await getUsageSnapshot(ctx.db, ctx.workspace.id);
  const canManage = canManageBilling(ctx.role) || Boolean(ctx.impersonating);
  const selectedPlan = resolveSelectedPlan(snapshot.plan);

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
    </div>
  );
}
