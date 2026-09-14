import Link from "next/link";

/** Marks Studio-only capability inline without inventing a new aesthetic. */
export function StudioBadge({ className }: { className?: string }) {
  return (
    <span
      className={
        className ??
        "inline-flex items-center rounded-cb-control border border-cb-line bg-cb-muted-bg px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cb-muted"
      }
    >
      Studio
    </span>
  );
}

/** Compact locked teaser pointing at Studio upgrades (scoring, cited pages, Grok, etc.). */
export function StudioUpgradeHint({
  title,
  body,
  href = "/app/settings/billing",
}: {
  title: string;
  body: string;
  href?: string;
}) {
  return (
    <div className="rounded-cb-card border border-dashed border-cb-line bg-cb-surface px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <StudioBadge />
        <p className="text-sm font-medium text-cb-text">{title}</p>
      </div>
      <p className="mt-1 text-sm text-cb-muted">{body}</p>
      <Link href={href} className="mt-2 inline-block text-sm text-cb-accent">
        Upgrade to Studio
      </Link>
    </div>
  );
}
