import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  line,
  cta,
  href,
  steps,
  secondaryCta,
  secondaryHref,
}: {
  title?: string;
  line: string;
  cta: string;
  href: string;
  /** Optional short next-step bullets for first-run clarity. */
  steps?: string[];
  secondaryCta?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="rounded-cb-card border border-cb-line bg-cb-surface px-6 py-14 text-center sm:px-10">
      {title ? <p className="text-base font-medium tracking-tight text-cb-text">{title}</p> : null}
      <p className={title ? "mx-auto mt-2 max-w-md text-sm text-cb-muted" : "mx-auto max-w-md text-sm text-cb-text"}>
        {line}
      </p>
      {steps && steps.length > 0 ? (
        <ol className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-cb-muted">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="font-mono tabular-nums text-cb-text">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href={href}>{cta}</Link>
        </Button>
        {secondaryCta && secondaryHref ? (
          <Button asChild variant="outline">
            <Link href={secondaryHref}>{secondaryCta}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
