import { SAMPLE_REPORT } from "@/components/marketing/sample-report-data";

export function DashboardPreview({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-cb-panel border border-cb-line bg-cb-surface p-4 sm:p-5 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-cb-muted">Overview</p>
          <p className="mt-1 text-sm font-medium">This week’s letters</p>
        </div>
        <span className="rounded-cb-control bg-cb-accent px-2.5 py-1 text-xs text-cb-on-accent">
          Approve & send
        </span>
      </div>
      <p className="mt-4 font-mono text-3xl tabular-nums text-cb-accent">
        {SAMPLE_REPORT.named}/{SAMPLE_REPORT.total}
      </p>
      <p className="mt-1 text-sm text-cb-text">Named this week · ClickUp still winning Asana alternatives</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-cb-control border border-cb-line px-2 py-2">
          <p className="text-cb-muted">Ready</p>
          <p className="mt-1 font-medium">1 letter</p>
        </div>
        <div className="rounded-cb-control border border-cb-line px-2 py-2">
          <p className="text-cb-muted">Who won</p>
          <p className="mt-1 font-medium">ClickUp</p>
        </div>
        <div className="rounded-cb-control border border-cb-line px-2 py-2">
          <p className="text-cb-muted">Next</p>
          <p className="mt-1 font-medium">Comparison page</p>
        </div>
      </div>
    </div>
  );
}
