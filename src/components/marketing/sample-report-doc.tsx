import { StatusPill } from "@/components/ui/status-pill";
import { SAMPLE_REPORT } from "@/components/marketing/sample-report-data";

function Paper({ children }: { children: React.ReactNode }) {
  return (
    <article
      className="w-full max-w-[640px] border border-cb-line bg-cb-bg px-[8%] py-10 sm:py-12"
      style={{ minHeight: "820px" }}
    >
      {children}
    </article>
  );
}

export function SampleReportDoc() {
  return (
    <div className="flex flex-col items-center gap-8">
      <Paper>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-tight text-cb-text">{SAMPLE_REPORT.agency}</p>
          <p className="text-[11px] text-cb-muted">Weekly citation brief</p>
        </div>
        <p className="mt-10 text-sm text-cb-muted">
          {SAMPLE_REPORT.brand} · {SAMPLE_REPORT.period}
        </p>
        <p className="mt-6 font-mono text-6xl leading-none tabular-nums text-cb-accent">
          {SAMPLE_REPORT.named}/{SAMPLE_REPORT.total}
        </p>
        <p className="mt-4 text-lg text-cb-text">
          Named in {SAMPLE_REPORT.named} of {SAMPLE_REPORT.total} buyer questions this week.
        </p>
        <p className="mt-1 text-sm text-cb-muted">
          Recommended in {SAMPLE_REPORT.recommended} of {SAMPLE_REPORT.total}.
        </p>
        <p className="mt-8 max-w-xl text-sm leading-6 text-cb-text">{SAMPLE_REPORT.summary}</p>
        <p className="mt-16 text-[11px] text-cb-muted">{SAMPLE_REPORT.prepared}</p>
      </Paper>

      <Paper>
        <p className="text-xs font-medium tracking-tight text-cb-text">Buyer questions</p>
        <p className="mt-1 text-sm text-cb-muted">Named or missing, who won, one next action.</p>
        <div className="mt-8">
          {SAMPLE_REPORT.rows.map((row) => (
            <div key={row.prompt} className="border-t border-cb-line py-4 first:border-t-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm text-cb-text">{row.prompt}</p>
                <StatusPill status={row.named ? "named" : "missing"}>
                  {row.named ? "Named" : "Missing"}
                </StatusPill>
              </div>
              <p className="mt-2 text-xs text-cb-muted">Who won: {row.winner}</p>
              <p className="mt-1 text-xs text-cb-text">Next action: {row.action}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[11px] text-cb-muted">{SAMPLE_REPORT.prepared}</p>
      </Paper>

      <Paper>
        <p className="text-xs font-medium tracking-tight text-cb-text">Three priorities for the next 10 days</p>
        <p className="mt-1 text-sm text-cb-muted">Ranked by commercial urgency, not vanity mentions.</p>
        <div className="mt-8 space-y-8">
          {SAMPLE_REPORT.priorities.map((item) => (
            <div key={item.rank} className="border-t border-cb-line pt-6 first:border-t-0 first:pt-0">
              <p className="font-mono text-xs tabular-nums text-cb-accent">{item.rank}</p>
              <p className="mt-2 text-sm font-medium text-cb-text">{item.question}</p>
              <p className="mt-2 text-sm leading-6 text-cb-muted">{item.why}</p>
              <p className="mt-2 text-sm text-cb-text">{item.action}</p>
              <p className="mt-1 text-xs text-cb-muted">Owner: {item.owner}</p>
            </div>
          ))}
        </div>
        <p className="mt-16 text-[11px] text-cb-muted">{SAMPLE_REPORT.prepared}</p>
      </Paper>
    </div>
  );
}
