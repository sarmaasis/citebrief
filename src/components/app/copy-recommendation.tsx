"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyRecommendation({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
      {copied ? "Copied" : "Copy recommendation"}
    </Button>
  );
}
