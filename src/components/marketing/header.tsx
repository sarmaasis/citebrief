import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-cb-line bg-cb-bg/95 backdrop-blur-none">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-cb-muted md:flex">
          <Link href="/pricing" className="hover:text-cb-text">
            Pricing
          </Link>
          <a href="#sample" className="hover:text-cb-text">
            Sample report
          </a>
          <Link href="/login" className="hover:text-cb-text">
            Sign in
          </Link>
        </nav>
        <Button asChild>
          <Link href="/signup">Send a Friday report</Link>
        </Button>
      </div>
    </header>
  );
}
