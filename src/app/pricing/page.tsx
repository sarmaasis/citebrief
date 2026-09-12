import type { Metadata } from "next";
import { PricingView } from "@/components/marketing/pricing-view";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export const metadata: Metadata = {
  title: "Pricing",
  description: "White-label Friday PDFs. Not a $29 vanity score.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <PricingView />
      <MarketingFooter />
    </div>
  );
}
