import Link from "next/link";
import type { AgencySavedView } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";

const VIEWS: Array<{ id: AgencySavedView; label: string }> = [
  { id: "all", label: "All clients" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "reports_due", label: "Reports due" },
  { id: "recent_wins", label: "Recent wins" },
  { id: "competitor_threats", label: "Competitor threats" },
];

export function AgencySavedViews({
  active,
  basePath,
  keep = {},
  paramKey = "saved",
}: {
  active: AgencySavedView;
  basePath: string;
  keep?: Record<string, string | undefined>;
  /** Query param for the saved view. Brands uses `saved`; Overview may use `view`. */
  paramKey?: "saved" | "view";
}) {
  return (
    <div className="flex flex-wrap gap-2" role="navigation" aria-label="Saved views">
      {VIEWS.map((view) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(keep)) {
          if (value) params.set(key, value);
        }
        if (view.id !== "all") params.set(paramKey, view.id);
        else params.delete(paramKey);
        const qs = params.toString();
        const href = qs ? `${basePath}?${qs}` : basePath;
        const selected = active === view.id;
        return (
          <Link
            key={view.id}
            href={href}
            className={cn(
              "rounded-cb-control px-2.5 py-1 text-xs",
              selected
                ? "bg-cb-accent-subtle text-cb-accent"
                : "border border-cb-line text-cb-muted hover:border-cb-accent hover:text-cb-accent",
            )}
          >
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}
