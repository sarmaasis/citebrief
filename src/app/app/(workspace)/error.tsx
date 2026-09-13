"use client";

import { ErrorFallback } from "@/components/app/error-fallback";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback onRetry={reset} />;
}
