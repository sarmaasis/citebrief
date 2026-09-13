import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PLANS, parsePlanId } from "@/lib/billing";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; stub?: string }>;
}) {
  const params = await searchParams;
  const plan = parsePlanId(params.plan) ?? "agency";
  const name = PLANS[plan].name;
  const isTest = Boolean(params.stub);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {isTest ? `${name} is ready for this workspace` : `${name} is active`}
      </h1>
      <p className="mt-3 text-sm text-cb-muted">
        {isTest
          ? `Checkout ran in test mode for ${name}. You can keep adding brands and sending reports. Live cards and invoices open from Billing.`
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
