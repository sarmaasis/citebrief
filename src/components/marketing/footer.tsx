import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-cb-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-cb-muted sm:flex-row sm:items-center sm:justify-between">
        <Logo muted />
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/pricing" className="hover:text-cb-text">
            Pricing
          </Link>
          <Link href="/legal/privacy" className="hover:text-cb-text">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-cb-text">
            Terms
          </Link>
          <span>Status</span>
          <span>getcitebrief.com</span>
        </div>
      </div>
    </footer>
  );
}
