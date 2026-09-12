import Link from "next/link";
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
      className={cn("text-sm font-semibold tracking-tight", muted ? "text-cb-muted" : "text-cb-text", className)}
    >
      CiteBrief
    </Link>
  );
}
