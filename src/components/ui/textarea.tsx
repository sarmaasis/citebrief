import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-cb-control border border-cb-line bg-cb-surface px-3 py-2 text-sm text-cb-text placeholder:text-cb-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cb-ring)]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
