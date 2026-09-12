import Link from "next/link";

const links = [
  { href: "/app/settings/billing", title: "Billing", body: "Plan, usage, and Dodo portal." },
  { href: "/app/settings/brand-kit", title: "Brand kit", body: "Logo, color, footer, Prepared by." },
  { href: "/app/settings/members", title: "Members", body: "Invite account managers (Agency+)." },
];

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-3 text-sm text-cb-muted">Workspace preferences for Friday reports.</p>
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
