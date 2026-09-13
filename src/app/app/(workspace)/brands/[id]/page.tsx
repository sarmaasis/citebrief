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
  const insights = await getBrandInsights(ctx, id, brand.name);
  const friday = formatShortDate(nextFriday());
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const allowsWeekly = ent.allowsWeeklyCadence;
  const allowsHistory = ent.allowsHistory;
  const score = latestReport?.scoreMentioned;
  const total = latestReport?.scoreTotal ?? 20;
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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="h-10 w-10 rounded-cb-control object-contain" />
          ) : null}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{brand.name}</h1>
              <RiskPill risk={risk} />
            </div>
            <p className="text-sm text-cb-muted">
              {brand.siteUrl || "No site yet"}
              {brand.vertical || brand.category ? ` · ${brand.vertical || brand.category}` : ""}
              {brand.buyer ? ` · Buyer: ${brand.buyer}` : ""}
              {brand.clientOwner ? ` · Owner: ${brand.clientOwner}` : ""}
            </p>
          </div>
        </div>
        <RunNowButton
          brandId={brand.id}
          disabled={Boolean(brand.archivedAt) || prompts.length === 0}
          hint={
            brand.archivedAt
              ? "Restore this brand before you run."
              : prompts.length === 0
                ? "Generate twenty buyer questions before you run."
                : null
          }
        />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Named</p>
          <p className="mt-2 font-mono text-[28px] tabular-nums text-cb-accent">
            {score == null ? "-/20" : `${score}/${total}`}
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
            {recommended == null ? "-/20" : `${recommended}/${insights.recommendedTotal}`}
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
                Generate 20 prompts
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

      {allowsHistory && insights.trend.length > 1 ? (
        <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-xs text-cb-muted">Score trend</p>
          <div className="mt-4">
            <MomChart data={insights.trend} />
          </div>
        </div>
      ) : null}

      <div className="mb-8 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Brand</h2>
          <div className="flex gap-2">
            <DuplicateBrandButton brandId={brand.id} />
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
          <Item label="Client owner" value={brand.clientOwner || "None yet"} />
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline">
          <Link href={`/app/brands/${brand.id}/prompts`}>
            {prompts.length ? "Edit prompts" : "Generate 20 prompts"}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/app/brands/${brand.id}/history`}>History</Link>
        </Button>
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
