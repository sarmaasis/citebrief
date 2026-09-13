import { SAMPLE_REPORT } from "@/components/marketing/sample-report-data";

export function PdfPreview({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-cb-panel border border-cb-line bg-cb-surface p-3 sm:p-5 ${className}`.trim()}>
      <div
        className="aspect-[8.5/11] w-full max-w-[440px] border border-cb-line bg-cb-bg"
        style={{ padding: "7%" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium tracking-tight text-cb-text">{SAMPLE_REPORT.agency}</p>
          <p className="text-[10px] text-cb-muted">Weekly citation brief</p>
        </div>
        <div className="mt-8 border-b border-cb-line pb-4">
          <p className="text-xs text-cb-muted">
            {SAMPLE_REPORT.brand} · {SAMPLE_REPORT.period}
          </p>
          <p className="mt-4 font-mono text-[40px] leading-none tabular-nums text-cb-accent">
            {SAMPLE_REPORT.named}/{SAMPLE_REPORT.total}
          </p>
          <p className="mt-3 text-sm text-cb-text">
            Named in {SAMPLE_REPORT.named} of {SAMPLE_REPORT.total} buyer questions this week.
          </p>
          <p className="mt-1 text-xs text-cb-muted">
            Recommended in {SAMPLE_REPORT.recommended} of {SAMPLE_REPORT.total}.
          </p>
        </div>
        <div className="mt-4 space-y-0 text-[11px] leading-5 text-cb-text">
          {SAMPLE_REPORT.rows.slice(0, 4).map((row) => (
            <div key={row.prompt} className="border-b border-cb-line py-2">
              <p>{row.prompt}</p>
              <p className="text-cb-muted">
                {row.named ? "Named" : "Missing"} · {row.winner}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[10px] text-cb-muted">{SAMPLE_REPORT.prepared}</p>
      </div>
    </div>
  );
}
