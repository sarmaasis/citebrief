"use client";

import { Button } from "@/components/ui/button";

export function ErrorFallback({
  title = "This screen could not load.",
  body = "Try again. If it keeps failing, open Home and continue from there.",
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-cb-card border border-cb-line bg-cb-surface px-6 py-16 text-center">
      <p className="text-sm font-medium text-cb-text">{title}</p>
      <p className="mt-2 text-sm text-cb-muted">{body}</p>
      {onRetry ? (
        <div className="mt-4">
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
