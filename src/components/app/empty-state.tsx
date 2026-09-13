import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  line,
  cta,
  href,
}: {
  title?: string;
  line: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-cb-card border border-cb-line bg-cb-surface px-6 py-16 text-center">
      {title ? <p className="text-sm font-medium text-cb-text">{title}</p> : null}
      <p className={title ? "mt-2 text-sm text-cb-muted" : "text-sm text-cb-text"}>{line}</p>
      <div className="mt-4">
        <Button asChild>
          <Link href={href}>{cta}</Link>
        </Button>
      </div>
    </div>
  );
}
