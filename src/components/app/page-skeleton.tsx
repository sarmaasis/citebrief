export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-7 w-40 animate-pulse rounded-cb-control bg-cb-muted-bg" />
      <div className="h-4 w-72 animate-pulse rounded-cb-control bg-cb-muted-bg" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-cb-card bg-cb-muted-bg" />
        <div className="h-20 animate-pulse rounded-cb-card bg-cb-muted-bg" />
        <div className="h-20 animate-pulse rounded-cb-card bg-cb-muted-bg" />
      </div>
      <div className="h-64 animate-pulse rounded-cb-card bg-cb-muted-bg" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
