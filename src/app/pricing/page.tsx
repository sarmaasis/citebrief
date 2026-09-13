import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PricingView } from "@/components/marketing/pricing-view";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { JsonLd } from "@/components/seo/json-ld";
import { parseBillingInterval, type PublicPlanId } from "@/lib/billing";
import { dodoAnnualProductId } from "@/lib/dodo";
import { getMarketingAuth } from "@/lib/session";
import { metadataPages, pricingJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = metadataPages.pricing;

async function annualProductsLive(): Promise<Record<PublicPlanId, boolean>> {
  const empty = { starter: false, agency: false, studio: false };
  try {
    const { env } = await getCloudflareContext({ async: true });
    return {
      starter: Boolean(dodoAnnualProductId(env, "starter")),
      agency: Boolean(dodoAnnualProductId(env, "agency")),
      studio: Boolean(dodoAnnualProductId(env, "studio")),
    };
  } catch {
    return empty;
  }
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  const params = await searchParams;
  const [auth, annualLive] = await Promise.all([getMarketingAuth(), annualProductsLive()]);

  return (
    <div className="min-h-screen">
      <JsonLd json={pricingJsonLd()} />
      <MarketingHeader />
      <PricingView
        signedIn={auth.signedIn}
        annualProductsLive={annualLive}
        initialAnnual={parseBillingInterval(params.interval) === "annual"}
      />
      <MarketingFooter />
    </div>
  );
}
