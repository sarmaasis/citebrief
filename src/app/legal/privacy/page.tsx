import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cb-bg">
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <div className="mt-8 space-y-4 text-sm leading-6 text-cb-muted">
          <p>CiteBrief (getcitebrief.com) stores workspace, brand, and report data you submit so we can run weekly citation briefs.</p><p>We use email and auth providers to sign you in. Payment data is handled by Dodo. We do not sell personal data.</p><p>Contact: support at getcitebrief.com. This page will expand before public launch.</p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
