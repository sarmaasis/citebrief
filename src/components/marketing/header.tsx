import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { marketingHeaderAuthLink, marketingPrimaryCta } from "@/lib/marketing-cta";
import { getMarketingAuth } from "@/lib/session";

const productNav = [
  { href: "/pricing", label: "Pricing" },
  { href: "/report", label: "Sample report" },
];

export async function MarketingHeader() {
  const auth = await getMarketingAuth();
  const account = marketingHeaderAuthLink(auth.signedIn);
  const primary = marketingPrimaryCta({
    signedIn: auth.signedIn,
    appHref: auth.appHref,
    signedOutLabel: "Send a Friday report",
  });

  return (
    <header className="sticky top-0 z-20 border-b border-cb-line bg-cb-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-cb-control focus:bg-cb-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-cb-muted md:flex">
          {productNav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-cb-text">
              {item.label}
            </Link>
          ))}
          <Link href={account.href} className="hover:text-cb-text">
            {account.label}
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href={account.href} className="text-sm text-cb-muted hover:text-cb-text md:hidden">
            {account.label}
          </Link>
          <Button asChild className="max-sm:h-9 max-sm:px-3 max-sm:text-xs">
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
        </div>
      </div>
      <nav className="flex gap-4 border-t border-cb-line px-4 py-2 text-sm text-cb-muted sm:px-6 md:hidden">
        <Link href="/pricing" className="hover:text-cb-text">
          Pricing
        </Link>
        <Link href="/report" className="hover:text-cb-text">
          Sample report
        </Link>
      </nav>
    </header>
  );
}
