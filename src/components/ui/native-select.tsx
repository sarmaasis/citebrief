import { cn } from "@/lib/utils";

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-cb-control border border-cb-line bg-cb-surface px-3 text-sm text-cb-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cb-ring)]",
        className,
      )}
      {...props}
    />
  );
}
