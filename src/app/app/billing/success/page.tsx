import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PLANS, parsePlanId } from "@/lib/billing";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";

export const dynamic = "force-dynamic";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; stub?: string }>;
}) {
  const params = await searchParams;
  const requested = parsePlanId(params.plan) ?? "agency";
  const isTest = Boolean(params.stub);

  const ctx = await getAppContext();
  const sub = ctx ? await getWorkspaceSubscription(ctx.db, ctx.workspace.id) : null;
  const ent = workspaceEntitlements(sub);
  const name = PLANS[ent.paid ? ent.plan : requested].name;

  if (isTest && !ent.paid) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
        <h1 className="text-xl font-semibold tracking-tight">Checkout did not activate {PLANS[requested].name}</h1>
        <p className="mt-3 text-sm text-cb-muted">
          This workspace is still on a trial. Return to Billing and choose a plan again. Test checkout must write a
          paid subscription before this page can confirm success.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/app/settings/billing">View billing</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {isTest ? `${name} is ready for this workspace` : `${name} is active`}
      </h1>
      <p className="mt-3 text-sm text-cb-muted">
        {isTest
          ? `Test checkout activated ${name}. Included brands, seats, and extras now follow the paid plan. Live cards and invoices open from Billing.`
          : `Your ${name} plan is ready. Check included brands, seats, and extra usage on Billing before the next charge.`}
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/app">Go to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app/settings/billing">View billing</Link>
        </Button>
      </div>
    </main>
  );
}
