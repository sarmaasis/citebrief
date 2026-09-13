import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="font-serif text-4xl tracking-tight">Page not found</h1>
        <p className="mt-4 text-sm text-cb-muted">That URL is not a CiteBrief page.</p>
        <p className="mt-8 text-sm">
          <Link href="/" className="text-cb-accent hover:underline">
            Back to home
          </Link>
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
