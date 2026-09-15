"use client";

import { useState } from "react";

export function CopyLinkButton({
  href,
  label = "Copy link",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      const url = href.startsWith("http") ? href : `${window.location.origin}${href}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" onClick={() => void copy()} className={className}>
      {copied ? "Copied" : label}
    </button>
  );
}
