export function PdfPreview({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-cb-panel border border-cb-line bg-cb-surface p-3 sm:p-5 ${className}`.trim()}>
      <div
        className="aspect-[8.5/11] w-full max-w-[440px] border border-cb-line bg-cb-bg"
        style={{ padding: "7%" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium tracking-tight text-cb-text">Northline Agency</p>
          <p className="text-[10px] text-cb-muted">Weekly citation brief</p>
        </div>
        <div className="mt-8 border-b border-cb-line pb-4">
          <p className="text-xs text-cb-muted">Northstar · Week of 8 Sep 2026</p>
          <p className="mt-4 font-mono text-[40px] leading-none tabular-nums text-cb-accent">12/20</p>
          <p className="mt-3 text-sm text-cb-text">Named in 12 of 20 buyer questions this week.</p>
        </div>
        <div className="mt-4 space-y-0 text-[11px] leading-5 text-cb-text">
          <div className="border-b border-cb-line py-2">
            <p>Asana alternatives for agencies 2026</p>
            <p className="text-cb-muted">Missing · ClickUp</p>
          </div>
          <div className="border-b border-cb-line py-2">
            <p>Northstar vs ClickUp for client work</p>
            <p className="text-cb-muted">Named · Northstar</p>
          </div>
          <div className="border-b border-cb-line py-2">
            <p>best project management for agencies 2026</p>
            <p className="text-cb-muted">Missing · Monday.com</p>
          </div>
          <div className="border-b border-cb-line py-2">
            <p>tools for 12-person marketing agencies</p>
            <p className="text-cb-muted">Named · Northstar</p>
          </div>
        </div>
        <p className="mt-8 text-[10px] text-cb-muted">Prepared by Northline Agency · 12 Sep 2026</p>
      </div>
    </div>
  );
}
