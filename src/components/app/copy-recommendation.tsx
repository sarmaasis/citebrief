"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyRecommendation({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy.");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
        {copied ? "Copied" : "Copy recommendation"}
      </Button>
      {error ? <span className="text-xs text-cb-danger">{error}</span> : null}
    </span>
  );
}
