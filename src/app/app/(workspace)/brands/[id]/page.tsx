import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/brands/archive-button";
import { RunNowButton } from "@/components/brands/run-now-button";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { formatShortDate, nextFriday } from "@/lib/friday";
import { getAppContext } from "@/lib/session";
import { getBrandBundle } from "@/server/workspace-data";

export default async function BrandHomePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }
  const { id } = await params;
  const bundle = await getBrandBundle(ctx, id);
  if (!bundle) {
    notFound();
  }

  const { brand, competitors, latestRun, latestReport, prompts } = bundle;
  const friday = formatShortDate(nextFriday());
  const score = latestReport?.scoreMentioned;
  const total = latestReport?.scoreTotal ?? 20;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="h-10 w-10 rounded-cb-control object-contain" />
          ) : null}
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{brand.name}</h1>
            <p className="text-sm text-cb-muted">
              {brand.siteUrl || "No site yet"}
              {brand.vertical || brand.category ? ` · ${brand.vertical || brand.category}` : ""}
            </p>
          </div>
        </div>
        <RunNowButton brandId={brand.id} />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Latest score</p>
          <p className="mt-2 font-mono text-[28px] tabular-nums text-cb-accent">
            {score == null ? "-/20" : `${score}/${total}`}
          </p>
          <p className="mt-2 text-sm text-cb-muted">
            {score == null ? "No report for this period yet." : `Named in ${score} of ${total} buyer questions.`}
          </p>
        </div>
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Last PDF</p>
          <p className="mt-3 text-sm text-cb-text">
            {latestReport
              ? latestReport.scoreMentioned == null
                ? "Report ready."
                : `Named in ${latestReport.scoreMentioned} of ${latestReport.scoreTotal} questions.`
              : "No PDF yet."}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {latestReport ? (
              <Link href={`/app/brands/${brand.id}/reports/${latestReport.id}`} className="text-cb-accent">
                Open report
              </Link>
            ) : null}
            {latestRun ? (
              <Link href={`/app/brands/${brand.id}/runs/${latestRun.id}`} className="text-cb-accent">
                View last run
              </Link>
            ) : null}
          </div>
        </div>
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Next Friday</p>
          <p className="mt-3 text-sm text-cb-text">{friday}</p>
          <p className="mt-2 text-xs text-cb-muted">Friday cron send lands in a later phase.</p>
        </div>
      </div>

      <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Brand</h2>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/brands/${brand.id}/edit`}>Edit</Link>
            </Button>
            <ArchiveButton brandId={brand.id} archived={Boolean(brand.archivedAt)} />
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Competitors" value={competitors.map((row) => row.name).join(", ") || "None yet"} />
          <Item label="Incumbent" value={brand.incumbent || "None yet"} />
          <Item label="Buyer" value={brand.buyer || "None yet"} />
          <Item label="Prompts" value={`${prompts.length} / 20`} />
        </dl>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/app/brands/${brand.id}/prompts`}>
            {prompts.length ? "Edit prompts" : "Generate 20 prompts"}
          </Link>
        </Button>
        {latestRun ? (
          <StatusPill status={latestRun.status === "complete" ? "complete" : "running"}>
            {latestRun.status}
          </StatusPill>
        ) : null}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-cb-muted">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
