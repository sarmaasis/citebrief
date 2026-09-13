import Link from "next/link";
import { PIPELINE_LABEL, type PipelineStage } from "@/lib/command-center";
import { cn } from "@/lib/utils";

const PIPELINE_ORDER: PipelineStage[] = [
  "not_configured",
  "ready_to_run",
  "running",
  "needs_review",
  "ready_to_send",
  "sent",
];

export function reportsStageHref(stage: PipelineStage, keep?: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  if (keep) {
    for (const key of ["owner", "risk", "brandId", "brand", "sent"] as const) {
      const value = keep[key];
      if (value) next.set(key === "brand" ? "brandId" : key, value);
    }
  }
  next.set("stage", stage);
  return `/app/reports?${next.toString()}`;
}

export function reportsQueueHref(keep?: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  if (keep) {
    for (const key of ["owner", "risk", "brandId", "brand", "sent"] as const) {
      const value = keep[key];
      if (value) next.set(key === "brand" ? "brandId" : key, value);
    }
  }
  const qs = next.toString();
  return qs ? `/app/reports?${qs}` : "/app/reports";
}

export function PipelineStrip({
  pipeline,
  active,
  keep,
}: {
  pipeline: Record<PipelineStage, number>;
  active?: string | null;
  keep?: Record<string, string | undefined>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {PIPELINE_ORDER.map((stage) => {
        const selected = active === stage;
        return (
          <Link
            key={stage}
            href={selected ? reportsQueueHref(keep) : reportsStageHref(stage, keep)}
            className={cn(
              "rounded-cb-card border bg-cb-surface px-4 py-3 hover:border-cb-accent",
              selected ? "border-cb-accent" : "border-cb-line",
            )}
          >
            <p className="text-xs text-cb-muted">{PIPELINE_LABEL[stage]}</p>
            <p className="mt-1 font-mono text-xl tabular-nums">{pipeline[stage]}</p>
          </Link>
        );
      })}
    </div>
  );
}
