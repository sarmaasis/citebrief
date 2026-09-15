import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { PLANS } from "@/lib/billing";

const links = [
  { href: "/app/settings/workspace", title: "Workspace", body: "Name, timezone, default engines, Slack." },
  {
    href: "/app/settings/domains",
    title: "Domains",
    body: `CiteBrief getcitebrief.com sender status and ${PLANS.studio.name} custom domain DNS checklist.`,
  },
  { href: "/app/settings/brand-kit", title: "Brand kit", body: "Logo, color, footer, Prepared by — used on PDFs and client links." },
  { href: "/app/settings/members", title: "Members", body: `Invite account managers (${PLANS.agency.name}+). Owners invite; members join.` },
  { href: "/app/settings/billing", title: "Billing", body: "Plan, included vs extra usage, invoices in the portal." },
  { href: "/app/activity", title: "Activity", body: "Workspace audit log." },
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Workspace preferences for Friday reports." />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-cb-card border border-cb-line bg-cb-surface p-5 transition-colors hover:border-cb-accent"
          >
            <p className="text-sm font-medium text-cb-text">{link.title}</p>
            <p className="mt-2 text-sm text-cb-muted">{link.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
