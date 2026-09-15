"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** After first PDF: would the AM forward page 1? */
export function ForwardablePrompt({ runId }: { runId: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function answer(forwardable: boolean) {
    setBusy(true);
    try {
      await fetch(`/api/runs/${runId}/forwardable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forwardable }),
      });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p className="text-sm text-cb-muted">Thanks — that helps us ship a letter AMs actually forward.</p>;
  }

  return (
    <div className="rounded-cb-card border border-cb-line bg-cb-surface p-4">
      <p className="text-sm font-medium text-cb-text">Would you forward page 1?</p>
      <p className="mt-1 text-xs text-cb-muted">One tap. No client sees this.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void answer(true)}>
          Yes
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void answer(false)}>
          Not yet
        </Button>
      </div>
    </div>
  );
}
