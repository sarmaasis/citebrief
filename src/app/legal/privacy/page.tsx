import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { JsonLd } from "@/components/seo/json-ld";
import { legalJsonLd, metadataPages } from "@/lib/seo";

export const metadata: Metadata = metadataPages.privacy;

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cb-bg">
      <JsonLd json={legalJsonLd("privacy")} />
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <div className="mt-8 space-y-4 text-sm leading-6 text-cb-muted">
          <p>
            CiteBrief (getcitebrief.com) stores workspace, brand, prompt, run, and report data you
            submit so we can generate client-ready AI-search reports.
          </p>
          <p>
            Reports query third-party AI search surfaces (ChatGPT, Perplexity, Gemini, and Google AI
            Overviews). Those answers may be incomplete or change. We store engine outputs, source
            URLs, and timestamps so your team can inspect a finding. We do not sell personal data.
          </p>
          <p>
            Sign-in uses email and password, magic link, or Google on getcitebrief.com. Payment data
            is handled by Dodo. Transactional email is sent through Resend.
          </p>
          <p>
            Client report links under /r are public token links. They do not require an account.
            Links expire. Anyone with the link can read that report until it expires.
          </p>
          <p>Contact: support@getcitebrief.com</p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
