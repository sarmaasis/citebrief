import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-10 w-full rounded-cb-control border border-cb-line bg-cb-surface px-3 text-sm text-cb-text placeholder:text-cb-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-accent/30",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
