import { notFound } from "next/navigation";
import { BillingPanel } from "@/components/billing/billing-panel";
import { formatShortDate } from "@/lib/friday";
import { canManageBilling } from "@/lib/permissions";
import { getAppContext } from "@/lib/session";
import { getUsageSnapshot } from "@/lib/usage";

export default async function BillingSettingsPage() {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }

  const snapshot = await getUsageSnapshot(ctx.db, ctx.workspace.id);
  const canManage = canManageBilling(ctx.role) || Boolean(ctx.impersonating);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-3 text-sm text-cb-muted">
        Plan, included usage, and expansion. Agency is the usual pick for weekly Friday reports. Invoices and
        cards live in the billing portal.
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
