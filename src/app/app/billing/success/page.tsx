import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; stub?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-xl font-semibold tracking-tight">Billing updated</h1>
      <p className="mt-3 text-sm text-cb-muted">
        {params.stub
          ? `Stub checkout complete for ${params.plan || "agency"}. Connect Dodo keys for live payments.`
          : `Your ${params.plan || "agency"} plan is ready.`}
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/app/settings/billing">Back to billing</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app">Go to home</Link>
        </Button>
      </div>
    </main>
  );
}
