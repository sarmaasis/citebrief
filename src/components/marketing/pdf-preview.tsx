export function PdfPreview() {
  return (
    <div
      id="sample"
      className="rounded-cb-panel border border-cb-line bg-cb-surface p-4 sm:p-6"
    >
      <div className="aspect-[8.5/11] w-full max-w-[420px] border border-cb-line bg-cb-bg p-8">
        <p className="text-xs text-cb-muted">Northline Agency</p>
        <p className="mt-6 text-sm text-cb-text">Northstar · Week of 8 Sep 2026</p>
        <p className="mt-8 font-mono text-[28px] tabular-nums text-cb-accent">12/20</p>
        <p className="mt-2 text-sm text-cb-text">Named in 12 of 20 buyer questions this week.</p>
        <p className="mt-6 max-w-sm text-sm leading-6 text-cb-muted">
          ClickUp still wins agency shortlists. The hole is comparison pages, not another homepage
          rewrite.
        </p>
        <div className="mt-10 space-y-3 border-t border-cb-line pt-4 text-xs text-cb-muted">
          <p>Asana alternatives for agencies 2026 · Missing · ClickUp</p>
          <p>Northstar vs ClickUp · Named · Northstar</p>
          <p>best project management for agencies 2026 · Missing · Monday.com</p>
        </div>
        <p className="mt-10 text-xs text-cb-muted">Prepared by Northline Agency · 12 Sep 2026</p>
      </div>
    </div>
  );
}
