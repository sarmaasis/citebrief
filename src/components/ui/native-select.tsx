import { cn } from "@/lib/utils";

const CHEVRON = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#737373" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
)}")`;

export function NativeSelect({ className, style, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full appearance-none rounded-cb-control border border-cb-line bg-cb-surface bg-[length:16px_16px] bg-[right_0.75rem_center] bg-no-repeat py-0 pl-3 pr-9 text-sm text-cb-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cb-ring)]",
        className,
      )}
      style={{ backgroundImage: CHEVRON, ...style }}
      {...props}
    />
  );
}
