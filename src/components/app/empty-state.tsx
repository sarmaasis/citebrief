import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyState({
  line,
  cta,
  href,
}: {
  line: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-cb-card border border-cb-line bg-cb-surface px-6 py-16 text-center">
      <p className="text-sm text-cb-text">{line}</p>
      <div className="mt-4">
        <Button asChild>
          <Link href={href}>{cta}</Link>
        </Button>
      </div>
    </div>
  );
}
