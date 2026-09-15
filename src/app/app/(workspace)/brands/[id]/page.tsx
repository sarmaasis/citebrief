import Link from "next/link";
import { notFound } from "next/navigation";
import { RiskPill } from "@/components/app/risk-pill";
import { ScoreChange } from "@/components/app/score-change";
import { ArchiveButton } from "@/components/brands/archive-button";
import { CadenceCard } from "@/components/brands/cadence-card";
import { DuplicateBrandButton } from "@/components/brands/duplicate-brand-button";
import { RunNowButton } from "@/components/brands/run-now-button";
import { MomChart } from "@/components/history/mom-chart";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { clientRisk, opportunityFromRow } from "@/lib/command-center";
import { workspaceEntitlements } from "@/lib/entitlements";
import { formatShortDate, nextFriday } from "@/lib/friday";
import { isSendOverdue } from "@/lib/friday-tz";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { getBrandBundle, getBrandInsights } from "@/server/workspace-data";
import { isPitchExpired, isPitchBrand, isSampleBrand } from "@/lib/brand-kind";
import { ConvertPitchButton } from "@/components/brands/convert-pitch-button";
import { cn } from "@/lib/utils";

export default async function BrandHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ recheck?: string; tab?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const bundle = await getBrandBundle(ctx, id);
  if (!bundle) {
    notFound();
  }

  const { brand, competitors, latestRun, latestReport, prompts } = bundle;
  const recheckPrompt = query.recheck ? prompts.find((prompt) => prompt.id === query.recheck) : null;
  const competitorsTab = query.tab === "competitors";
  const insights = await getBrandInsights(ctx, id, brand.name);
  const friday = formatShortDate(nextFriday());
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const allowsWeekly = ent.allowsWeeklyCadence;
  const promptCap = ent.promptCap;
  const score = latestReport?.scoreMentioned;
  const total = latestReport?.scoreTotal ?? promptCap;
  const recommended = latestReport?.scoreRecommended ?? insights.recommendedCount;
  const runStatus = latestRun?.status;
  const commandRow = {
    promptCount: prompts.length,
    mentionedDelta: insights.mentionedDelta,
    competitorLeadShare: insights.competitorLeadShare,
    competitorLeadCount: insights.competitorLeadCount,
    competitorLeader: insights.competitorLeader,
    missingSources: insights.missingSources,
    sendOverdue: isSendOverdue({
      sentAt: latestReport?.sentAt,
      reportCreatedAt: latestReport?.createdAt,
      timezone: ctx.workspace.timezone || "America/New_York",
      weekly: allowsWeekly,
    }),
    latestRun,
    latestReport,
  };
  const risk = clientRisk(commandRow);
  const opportunity = opportunityFromRow({
    ...commandRow,
    brand: { id: brand.id, name: brand.name },
  });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-cb-control object-contain" />
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{brand.name}</h1>
              <RiskPill risk={risk} />
            </div>
            <p className="truncate text-sm text-cb-muted">
              {brand.siteUrl || "No site yet"}
              {brand.vertical || brand.category ? ` · ${brand.vertical || brand.category}` : ""}
              {brand.buyer ? ` · Buyer: ${brand.buyer}` : ""}
              {brand.clientOwner ? ` · Owner: ${brand.clientOwner}` : ""}
            </p>
          </div>
        </div>
        <RunNowButton
          brandId={brand.id}
          promptId={recheckPrompt?.id}
          label={recheckPrompt ? "Recheck" : "Run now"}
          disabled={Boolean(brand.archivedAt) || prompts.length === 0 || isSampleBrand(brand.kind) || (isPitchBrand(brand.kind) && Boolean(latestRun))}
          hint={
            isSampleBrand(brand.kind)
              ? "Sample is read-only. Add your client to run."
              : isPitchBrand(brand.kind) && latestRun
                ? "Pitch audits are one-shot. Convert to keep tracking."
              : brand.archivedAt
                ? "Restore this brand before you run."
                : prompts.length === 0
                  ? `Generate ${promptCap} buyer questions before you run.`
                  : recheckPrompt
                    ? "Runs all buyer questions for this brand; focuses the selected prompt after queueing."
                    : null
          }
        />
      </div>

      {isSampleBrand(brand.kind) ? (
        <div className="mb-8 rounded-cb-card border border-cb-accent bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Sample client</p>
          <p className="mt-2 text-sm font-medium">Last Friday already shipped for Northstar.</p>
          <p className="mt-1 text-sm text-cb-muted">Read-only. Run the same letter for a real retainer.</p>
          <Link href="/app/onboarding?new=1" className="mt-3 inline-block text-sm text-cb-accent">
            Run this for my client →
          </Link>
        </div>
      ) : null}

      {isPitchBrand(brand.kind) ? (
        <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Pitch audit</p>
          <p className="mt-2 text-sm font-medium">
            {isPitchExpired(brand.expiresAt) ? "This pitch expired." : "48-hour prospect PDF. Does not use a client slot."}
          </p>
          {brand.expiresAt && !isPitchExpired(brand.expiresAt) ? (
            <p className="mt-1 text-sm text-cb-muted">
              Expires {formatShortDate(brand.expiresAt instanceof Date ? brand.expiresAt : new Date(brand.expiresAt))}.
            </p>
          ) : null}
          <div className="mt-3">
            <ConvertPitchButton brandId={brand.id} />
          </div>
        </div>
      ) : null}

      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Brand">
        {[
          { href: `/app/brands/${brand.id}`, label: "Overview", active: !competitorsTab },
          { href: `/app/brands/${brand.id}/prompts`, label: "Prompts", active: false },
          { href: `/app/brands/${brand.id}?tab=competitors`, label: "Competitors", active: competitorsTab },
          { href: `/app/brands/${brand.id}/history`, label: "History", active: false },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "rounded-cb-control px-2.5 py-1 text-xs",
              item.active
                ? "bg-cb-accent-subtle text-cb-accent"
                : "border border-cb-line text-cb-muted hover:border-cb-accent hover:text-cb-accent",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {competitorsTab ? (
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <h2 className="text-sm font-medium">Competitors</h2>
          {insights.competitorLeader ? (
            <p className="mt-2 text-sm text-cb-muted">
              {insights.competitorLeader} leads {insights.competitorLeadCount} buyer questions
              {insights.competitorLeadShare != null
                ? ` (${Math.round(insights.competitorLeadShare * 100)}%).`
                : "."}
            </p>
          ) : (
            <p className="mt-2 text-sm text-cb-muted">
              Leader stats appear after the first report.
            </p>
          )}
          {competitors.length === 0 ? (
            <p className="mt-4 text-sm text-cb-muted">
              None yet.{" "}
              <Link href={`/app/brands/${brand.id}/edit`} className="text-cb-accent">
                Add competitors
              </Link>
            </p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {competitors.map((row) => (
                <li key={row.id} className="flex h-12 items-center justify-between border-b border-cb-line last:border-0">
                  <span>{row.name}</span>
                  {insights.competitorLeader &&
                  row.name.toLowerCase() === insights.competitorLeader.toLowerCase() ? (
                    <span className="text-xs text-cb-accent">Leading</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
      {recheckPrompt ? (
        <div className="mb-8 rounded-cb-card border border-cb-accent bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Recheck focus</p>
          <p className="mt-2 text-sm font-medium">{recheckPrompt.text}</p>
          <p className="mt-1 text-sm text-cb-muted">
            Mix: {recheckPrompt.mix || "—"}. Queuing a run refreshes every prompt for this brand and opens the run with
            this question highlighted.
          </p>
          <Link href={`/app/brands/${brand.id}/prompts`} className="mt-3 inline-block text-sm text-cb-accent">
            Edit prompts
          </Link>
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Named</p>
          <p className="mt-2 font-mono text-[28px] tabular-nums text-cb-accent">
            {score == null ? `-/${promptCap}` : `${score}/${total}`}
          </p>
          <p className="mt-2 text-sm text-cb-muted">
            {score == null ? "No report for this period yet." : `Named in ${score} of ${total} buyer questions.`}
          </p>
          <div className="mt-2">
            <ScoreChange delta={insights.mentionedDelta} />
          </div>
        </div>
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Recommended</p>
          <p className="mt-2 font-mono text-[28px] tabular-nums text-cb-accent">
            {recommended == null ? `-/${promptCap}` : `${recommended}/${insights.recommendedTotal}`}
          </p>
          <p className="mt-2 text-sm text-cb-muted">
            {recommended == null
              ? "Recommendation score appears after the first report."
              : `Recommended in ${recommended} of ${insights.recommendedTotal}.`}
          </p>
        </div>
        <CadenceCard friday={friday} allowsWeekly={allowsWeekly} />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Last PDF</h2>
            {latestReport?.sentAt ? (
              <StatusPill status="named">Sent</StatusPill>
            ) : latestReport ? (
              <StatusPill status="queued">Not sent</StatusPill>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-cb-text">
            {latestReport
              ? latestReport.scoreMentioned == null
                ? "Report ready."
                : `Named in ${latestReport.scoreMentioned} of ${latestReport.scoreTotal} questions.`
              : "No PDF yet."}
            {latestReport?.shareOpenCount
              ? ` · ${latestReport.shareOpenCount} client-link open${latestReport.shareOpenCount === 1 ? "" : "s"}`
              : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {latestReport ? (
              <Link href={`/app/brands/${brand.id}/reports/${latestReport.id}`} className="text-cb-accent">
                Open report
              </Link>
            ) : prompts.length === 0 ? (
              <Link href={`/app/brands/${brand.id}/prompts`} className="text-cb-accent">
                Generate {promptCap} prompts
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
          <h2 className="text-sm font-medium">Top missing questions</h2>
          {opportunity ? (
            <p className="mt-2 text-sm text-cb-muted">
              Sell next: {opportunity.service} — {opportunity.reason}
            </p>
          ) : null}
          {insights.missingQuestions.length === 0 ? (
            <p className="mt-3 text-sm text-cb-muted">
              {latestReport
                ? "No missing questions in the latest report."
                : "Missing questions appear after the first report."}
            </p>
          ) : (
            <ol className="mt-3 space-y-2 text-sm">
              {insights.missingQuestions.map((question) => (
                <li key={question} className="border-b border-cb-line pb-2 last:border-0">
                  {question}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {insights.trend.length > 1 ? (
        <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Named vs recommended · 8 weeks</p>
          {insights.competitorLeader ? (
            <p className="mt-1 text-sm text-cb-muted">
              {insights.competitorLeader} leads {insights.competitorLeadCount} buyer questions
              {insights.competitorLeadShare != null ? ` (${Math.round(insights.competitorLeadShare * 100)}%).` : "."}
            </p>
          ) : null}
          <div className="mt-4">
            <MomChart data={insights.trend} />
          </div>
        </div>
      ) : null}

      <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Brand</h2>
          <div className="flex gap-2">
            {isSampleBrand(brand.kind) ? null : <DuplicateBrandButton brandId={brand.id} />}
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
          <Item label="Prompts" value={`${prompts.length} / ${promptCap}`} />
          <Item label="Client owner" value={brand.clientOwner || "None yet"} />
        </dl>
      </div>

      {runStatus ? (
        <StatusPill
          status={
            runStatus === "complete"
              ? "complete"
              : runStatus === "partial"
                ? "partial"
                : runStatus === "failed"
                  ? "failed"
                  : "running"
          }
        >
          {runStatus === "partial" ? "Shipped with gaps" : runStatus}
        </StatusPill>
      ) : null}
        </>
      )}
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
