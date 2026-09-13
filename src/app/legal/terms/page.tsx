import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { JsonLd } from "@/components/seo/json-ld";
import { legalJsonLd, metadataPages } from "@/lib/seo";

export const metadata: Metadata = metadataPages.terms;

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cb-bg">
      <JsonLd json={legalJsonLd("terms")} />
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Terms</h1>
        <div className="mt-8 space-y-4 text-sm leading-6 text-cb-muted">
          <p>By using CiteBrief you agree to use the product for lawful client reporting.</p>
          <p>
            Reports reflect answers from third-party AI search engines and may be incomplete.
            CiteBrief is a report layer, not a guarantee of rankings, citations, or demand. It is
            not a GEO optimizer, keyword tracker, or content generator.
          </p>
          <p>
            Plans are Starter ($149/mo), Agency ($249/mo), and Studio ($499/mo). Annual billing is
            10 months prepaid. Trial is 14 days, 1 brand, and 1 full report. Cancel at period end.
            Generated PDFs remain available for 90 days after cancel.
          </p>
          <p>
            Client report links do not require login and expire. Optional domains redirect to
            getcitebrief.com and do not share sign-in sessions.
          </p>
          <p>Contact: support@getcitebrief.com</p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
