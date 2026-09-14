import Link from "next/link";
import { ENGINES } from "@/lib/engines";
import type { EngineBreakdownRow } from "@/lib/dashboard-metrics";

export function EngineBreakdownGrid({ engines }: { engines: EngineBreakdownRow[] }) {
  const labels = Object.fromEntries(ENGINES.map((engine) => [engine.id, engine.label]));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {engines.map((engine) => (
        <article key={engine.engine} className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <p className="text-sm font-medium">{labels[engine.engine] ?? engine.engine}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Mention rate" value={engine.mentionRate == null ? "—" : `${engine.mentionRate}%`} />
            <Row label="Citation rate" value={engine.citationRate == null ? "—" : `${engine.citationRate}%`} />
            <Row
              label="Avg visibility"
              value={engine.averageVisibility == null ? "—" : `${engine.averageVisibility}%`}
            />
            <Row
              label="Reliability"
              value={engine.reliability == null ? "—" : `${engine.reliability}%`}
            />
            <Row
              label="Appearing / missing"
              value={`${engine.promptsAppearing} / ${engine.promptsMissing}`}
            />
            <Row
              label="Top competitors"
              value={engine.topCompetitors.length ? engine.topCompetitors.join(", ") : "—"}
            />
          </dl>
          {engine.topCitedUrls.length ? (
            <div className="mt-4">
              <p className="text-xs text-cb-muted">Top cited URLs</p>
              <ul className="mt-2 space-y-1">
                {engine.topCitedUrls.slice(0, 5).map((url) => (
                  <li key={url} className="truncate text-xs">
                    <a href={url} className="text-cb-accent" target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-xs text-cb-muted">No cited URLs in the latest run.</p>
          )}
          {engine.recentChange != null ? (
            <p className="mt-3 text-xs text-cb-muted">
              Mention change {engine.recentChange > 0 ? "+" : ""}
              {engine.recentChange} pts
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-cb-muted">{label}</dt>
      <dd className="max-w-[60%] truncate text-right font-mono text-xs tabular-nums text-cb-text">{value}</dd>
    </div>
  );
}

export function EngineBreakdownEmpty() {
  return (
    <p className="text-sm text-cb-muted">
      Engine breakdown appears after the first report.{" "}
      <Link href="/app/onboarding" className="text-cb-accent">
        Add a brand
      </Link>{" "}
      or run an existing one.
    </p>
  );
}
