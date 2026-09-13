import { cn } from "@/lib/utils";

export function formatScoreChange(delta: number | null | undefined) {
  if (delta == null || Number.isNaN(delta)) return null;
  if (delta === 0) return "No change";
  return delta > 0 ? `+${delta}` : String(delta);
}

export function ScoreChange({
  delta,
  className,
}: {
  delta: number | null | undefined;
  className?: string;
}) {
  const label = formatScoreChange(delta);
  if (!label) {
    return <span className={cn("text-xs text-cb-muted", className)}>First report</span>;
  }
  const tone =
    delta == null || delta === 0 ? "text-cb-muted" : delta > 0 ? "text-cb-named" : "text-cb-missing";
  return <span className={cn("font-mono text-xs tabular-nums", tone, className)}>{label}</span>;
}
