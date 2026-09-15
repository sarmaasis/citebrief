import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PLANS } from "@/lib/billing";

const product = [
  { href: "/pricing", label: "Pricing" },
  { href: "/report", label: "Sample report" },
  { href: "/for-seo-agencies", label: "For SEO agencies" },
  { href: "/for-pr-agencies", label: "For PR agencies" },
];

const legal = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/security", label: "Security" },
  { href: "/legal/dpa", label: "DPA" },
];

function FooterColumn({ title, items }: { title: string; items: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <p className="text-xs font-medium text-cb-text">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-sm text-cb-muted hover:text-cb-text">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-cb-line">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_1fr_1fr] md:items-start">
          <div>
            <Logo muted />
            <p className="mt-3 max-w-xs text-sm leading-6 text-cb-muted">
              The Friday AI-search report agencies send to clients. {PLANS.agency.name} adds the
              command center that explains movement, competitors, and next actions.
            </p>
          </div>
          <FooterColumn title="Product" items={product} />
          <FooterColumn title="Legal" items={legal} />
        </div>
        <p className="mt-10 border-t border-cb-line pt-6 text-xs text-cb-muted">getcitebrief.com</p>
      </div>
    </footer>
  );
}

export function AuthLegalLinks() {
  return (
    <p className="mt-10 text-xs text-cb-muted">
      <Link href="/legal/privacy" className="hover:text-cb-text">
        Privacy
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/legal/terms" className="hover:text-cb-text">
        Terms
      </Link>
    </p>
  );
}
