import { cn } from "@/lib/utils";

const styles = {
  named: "bg-cb-accent-subtle text-cb-named",
  missing: "bg-[#f4e7e0] text-cb-missing",
  running: "bg-[#f6ead4] text-cb-pending",
  queued: "bg-cb-accent-subtle text-cb-muted",
  failed: "bg-[#f4e7e0] text-cb-missing",
  complete: "bg-cb-accent-subtle text-cb-named",
  partial: "bg-[#f6ead4] text-cb-pending",
} as const;

export function StatusPill({
  status,
  children,
}: {
  status: keyof typeof styles;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex h-7 items-center rounded-cb-control px-2 text-xs font-medium", styles[status])}>
      {children}
    </span>
  );
}
