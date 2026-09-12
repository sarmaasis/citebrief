"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WorkspaceForm({
  initial,
}: {
  initial: {
    name: string;
    timezone: string;
    senderName: string;
    defaultEngines: string;
  };
}) {
  const [name, setName] = useState(initial.name);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [senderName, setSenderName] = useState(initial.senderName);
  const [defaultEngines, setDefaultEngines] = useState(initial.defaultEngines);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone, senderName, defaultEngines }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not save workspace.");
        return;
      }
      setMessage("Workspace saved. Friday cron uses this timezone at 06:00.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="senderName">Email sender name</Label>
        <Input id="senderName" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="CiteBrief" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultEngines">Default engines</Label>
        <Input
          id="defaultEngines"
          value={defaultEngines}
          onChange={(e) => setDefaultEngines(e.target.value)}
          placeholder="chatgpt,perplexity,gemini,aio"
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save workspace"}
      </Button>
      {message ? <p className="text-sm text-cb-muted">{message}</p> : null}
    </form>
  );
}
