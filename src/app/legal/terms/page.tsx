import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export const metadata: Metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cb-bg">
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Terms</h1>
        <div className="mt-8 space-y-4 text-sm leading-6 text-cb-muted">
          <p>By using CiteBrief you agree to use the product for lawful client reporting.</p><p>Reports reflect answers from third-party AI search engines and may be incomplete. CiteBrief is a report layer, not a guarantee of rankings or citations.</p><p>Billing is monthly unless noted. Cancel at period end. This page will expand before public launch.</p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
