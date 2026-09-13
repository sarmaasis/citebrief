import Link from "next/link";
import { Button } from "@/components/ui/button";
import { marketingPrimaryCta } from "@/lib/marketing-cta";
import { getMarketingAuth } from "@/lib/session";

export async function MarketingPrimaryCta({
  signedOutLabel,
  size,
}: {
  signedOutLabel: string;
  size?: "default" | "sm" | "lg";
}) {
  const auth = await getMarketingAuth();
  const cta = marketingPrimaryCta({
    signedIn: auth.signedIn,
    appHref: auth.appHref,
    signedOutLabel,
  });
  return (
    <Button asChild size={size}>
      <Link href={cta.href}>{cta.label}</Link>
    </Button>
  );
}
