import Link from "next/link";
import { CiteBriefMark } from "@/components/brand/mark";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  muted = false,
  className,
}: {
  href?: string;
  muted?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="CiteBrief"
      className={cn("inline-flex items-center gap-2", className)}
    >
      <CiteBriefMark className={cn("h-6 w-6", muted && "opacity-70")} />
      <span className={cn("text-sm font-semibold tracking-tight", muted ? "text-cb-muted" : "text-cb-text")}>
        CiteBrief
      </span>
    </Link>
  );
}
