import Link from "next/link";
import type { CompetitorLeaderboardEntry } from "@/lib/dashboard-metrics";
import { PLANS } from "@/lib/billing";

export function CompetitorDossier({
  entry,
  showCitedPages,
  closeHref,
}: {
  entry: CompetitorLeaderboardEntry;
  showCitedPages: boolean;
  closeHref: string;
}) {
  const movement =
    entry.movementSinceLastRun == null
      ? "No prior run to compare"
      : entry.movementSinceLastRun > 0
        ? `Up ${entry.movementSinceLastRun} top-choice win${entry.movementSinceLastRun === 1 ? "" : "s"} vs last run`
        : entry.movementSinceLastRun < 0
          ? `Down ${Math.abs(entry.movementSinceLastRun)} vs last run`
          : "Flat vs last run";

  return (
    <aside className="mb-10 rounded-cb-card border border-cb-line bg-cb-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-cb-muted">Competitor dossier</p>
          <h2 className="mt-1 text-lg font-medium tracking-tight text-cb-text">{entry.name}</h2>
          <p className="mt-1 text-sm text-cb-muted">
            Beating{" "}
            <Link href={`/app/brands/${entry.brandId}`} className="text-cb-accent">
              {entry.brandName}
            </Link>{" "}
            on stored Friday answers — not a live crawl.
          </p>
        </div>
        <Link href={closeHref} className="text-sm text-cb-muted hover:text-cb-text">
          Close
        </Link>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-cb-muted">Top-choice wins</dt>
          <dd className="mt-1 font-mono text-xl tabular-nums text-cb-text">{entry.topChoiceCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-cb-muted">Mentions as winner</dt>
          <dd className="mt-1 font-mono text-xl tabular-nums text-cb-text">{entry.mentionCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-cb-muted">Cited answers</dt>
          <dd className="mt-1 font-mono text-xl tabular-nums text-cb-text">{entry.citationCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-cb-muted">Movement</dt>
          <dd className="mt-1 text-sm text-cb-text">{movement}</dd>
        </div>
      </dl>

      <section className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Why they are winning</h3>
        <p className="mt-2 text-sm text-cb-text">{entry.whyWinning || "Winning buyer questions in the latest run."}</p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Engines favoring them</h3>
          {entry.engines.length ? (
            <ul className="mt-2 space-y-1 font-mono text-sm text-cb-text">
              {entry.engines.map((engine) => (
                <li key={engine}>{engine}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-cb-muted">No engine breakdown yet.</p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Prompts they win</h3>
          {entry.promptsWon.length ? (
            <ul className="mt-2 space-y-1 text-sm text-cb-text">
              {entry.promptsWon.slice(0, 6).map((prompt) => (
                <li key={prompt} className="line-clamp-2">
                  {prompt}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-cb-muted">No prompt text stored for these wins.</p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wide text-cb-muted">Cited pages</h3>
        {showCitedPages && entry.citedUrls.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {entry.citedUrls.slice(0, 8).map((url) => (
              <li key={url} className="truncate">
                <a href={url} target="_blank" rel="noreferrer" className="text-cb-accent">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        ) : showCitedPages ? (
          <p className="mt-2 text-sm text-cb-muted">No competitor URLs were cited in the latest answers.</p>
        ) : (
          <p className="mt-2 text-sm text-cb-muted">
            {PLANS.agency.name} surfaces the competitor URLs AI is citing so you can counter specific pages — not just
            names on a leaderboard.{" "}
            <Link href="/app/settings/billing" className="text-cb-accent">
              Upgrade to {PLANS.agency.name}
            </Link>
          </p>
        )}
      </section>
    </aside>
  );
}
