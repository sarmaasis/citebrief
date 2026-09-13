import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BillingPanel } from "@/components/billing/billing-panel";
import { subscriptions, workspaceInvites, workspaceMembers } from "@/db/schema";
import { planBrandLimit, planSeatCap } from "@/lib/billing";
import { formatShortDate } from "@/lib/friday";
import { getAppContext } from "@/lib/session";
import { listWorkspaceBrands } from "@/server/workspace-data";

export default async function BillingSettingsPage() {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }

  const [sub] = await ctx.db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, ctx.workspace.id))
    .limit(1);
  const brands = await listWorkspaceBrands(ctx);
  const plan = sub?.plan || "agency";
  const extraBrands = sub?.extraBrands || 0;
  const members = await ctx.db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, ctx.workspace.id));
  const now = Date.now();
  const activePending = (
    await ctx.db
      .select()
      .from(workspaceInvites)
      .where(
        and(eq(workspaceInvites.workspaceId, ctx.workspace.id), isNull(workspaceInvites.acceptedAt)),
      )
  ).filter((invite) => invite.expiresAt.getTime() >= now);
  const seatsUsed = members.length + activePending.length;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-3 text-sm text-cb-muted">
        CiteBrief uses Dodo Payments (not Stripe). Starter $149 · Agency $249 · Studio $499.
      </p>
      <div className="mt-8">
        <BillingPanel
          currentPlan={plan}
          status={sub?.status || "none"}
          brandsUsed={brands.length}
          runsUsed={sub?.runsUsed || 0}
          brandLimit={planBrandLimit(plan, extraBrands)}
          trialEndsAt={sub?.trialEndsAt ? formatShortDate(new Date(sub.trialEndsAt)) : null}
          cancelAtPeriodEnd={Boolean(sub?.cancelAtPeriodEnd)}
          extraBrands={extraBrands}
          extraRuns={sub?.extraRuns || 0}
          currentPeriodEnd={sub?.currentPeriodEnd ? formatShortDate(new Date(sub.currentPeriodEnd)) : null}
          seatsUsed={seatsUsed}
          seatCap={planSeatCap(plan)}
        />
      </div>
    </div>
  );
}
