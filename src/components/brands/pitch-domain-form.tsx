"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PitchDomainForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/pitches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, competitors }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        runId?: string;
      };
      if (!response.ok || !data.id) {
        setError(data.error ?? "Could not start the pitch.");
        return;
      }
      router.push(data.runId ? `/app/brands/${data.id}/runs/${data.runId}` : `/app/brands/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className={compact ? "space-y-3" : "max-w-md space-y-4"}>
      <div className="space-y-2">
        <Label htmlFor="pitch-domain">Pitch this domain</Label>
        <Input
          id="pitch-domain"
          placeholder="acme.com"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          required
        />
      </div>
      {compact ? null : (
        <div className="space-y-2">
          <Label htmlFor="pitch-competitors">Competitors (optional)</Label>
          <Input
            id="pitch-competitors"
            placeholder="ClickUp, Asana"
            value={competitors}
            onChange={(event) => setCompetitors(event.target.value)}
          />
        </div>
      )}
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Starting…" : "Pitch this domain"}
      </Button>
      {error ? <p className="text-xs text-cb-danger">{error}</p> : null}
      <p className="text-xs text-cb-muted">48-hour PDF. Does not use a client brand slot.</p>
    </form>
  );
}
