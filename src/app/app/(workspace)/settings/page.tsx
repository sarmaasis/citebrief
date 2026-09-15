import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import {
  EXTRA_BRAND_USD,
  EXTRA_RUN_USD,
  MONTHLY_RECHECK_CREDITS,
  PLANS,
  PREMIUM_ENGINE_PACK_USD,
  SEAT_OVERAGE_USD,
} from "@/lib/billing";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";

const links = [
  { href: "/app/settings/workspace", title: "Workspace", body: "Name, timezone, default engines, Slack." },
  {
    href: "/app/settings/domains",
    title: "Domains",
    body: `CiteBrief getcitebrief.com sender status and ${PLANS.studio.name} custom domain DNS checklist.`,
  },
  { href: "/app/settings/brand-kit", title: "Brand kit", body: "Logo, color, footer, Prepared by — used on PDFs and client links." },
  { href: "/app/settings/members", title: "Members", body: `Invite account managers (${PLANS.agency.name}+). Owners invite; members join.` },
  { href: "/app/settings/billing", title: "Plan", body: "Your plan, included checklist, usage caps, and add-ons." },
];

const PLAN_INCLUDED: Record<"starter" | "agency" | "studio", string[]> = {
  starter: [
    `${PLANS.starter.brands} clients`,
    `${PLANS.starter.brands * PLANS.starter.prompts} tracked question capacity`,
    "Monthly report cadence",
    "CiteBrief sender",
    "PDF download and private client link",
    `${MONTHLY_RECHECK_CREDITS.starter} manual re-check credits/mo`,
    `${PLANS.starter.seats} seat`,
  ],
  agency: [
    `${PLANS.agency.brands} clients`,
    `${PLANS.agency.brands * PLANS.agency.prompts} tracked question capacity`,
    "Weekly Friday reports",
    "This week dashboard",
    "Private report links and email sending",
    "Cited pages on every report",
    "Prospect pitch audits (48h)",
    `${MONTHLY_RECHECK_CREDITS.agency} manual re-check credits/mo`,
    `${PLANS.agency.seats} seats`,
    "Coming soon: Looker Studio/API exports and deeper source monitoring",
  ],
  studio: [
    `${PLANS.studio.brands} client brands`,
    `${PLANS.studio.brands * PLANS.studio.prompts} tracked question capacity`,
    `Everything in ${PLANS.agency.name}`,
    "Custom sender name and domain",
    "Bulk approve and send",
    "Portfolio CSV export",
    `${MONTHLY_RECHECK_CREDITS.studio} manual re-check credits/mo`,
    `${PLANS.studio.seats} seats`,
    "Coming soon: client portal archive, Looker Studio/API exports, priority processing",
  ],
};

export default async function SettingsPage() {
  const ctx = await getAppContext();
  const sub = ctx ? await getWorkspaceSubscription(ctx.db, ctx.workspace.id) : null;
  const ent = workspaceEntitlements(sub);
  const planKey = ent.plan === "enterprise" ? "studio" : ent.plan === "starter" ? "starter" : ent.plan === "studio" ? "studio" : "agency";
  const included = PLAN_INCLUDED[planKey];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Workspace preferences for Friday briefs." />

      <section className="mt-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-cb-muted">Your plan</p>
            <h2 className="mt-1 text-sm font-medium">{PLANS[ent.plan].name}</h2>
            <p className="mt-1 text-sm text-cb-muted">
              {ent.trialing ? "Trial" : ent.paid ? "Active" : "Unpaid"} · {ent.brandLimit} client cap ·{" "}
              {ent.monthlyRecheckCredits} rechecks/mo
            </p>
          </div>
          <Link href="/app/settings/billing" className="text-sm text-cb-accent">
            Manage billing →
          </Link>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-cb-muted">
          {included.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
        <div className="mt-5 border-t border-cb-line pt-4">
          <p className="text-xs font-medium text-cb-text">Add-ons</p>
          <ul className="mt-2 space-y-1 text-sm text-cb-muted">
            <li>${EXTRA_BRAND_USD.agency}/mo extra client (Teams+)</li>
            <li>${SEAT_OVERAGE_USD}/mo extra seat</li>
            <li>${EXTRA_RUN_USD.agency} extra run</li>
            <li>${PREMIUM_ENGINE_PACK_USD}/mo engine pack</li>
          </ul>
        </div>
      </section>

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
