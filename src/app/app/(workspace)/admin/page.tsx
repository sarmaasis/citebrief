"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InternalAdminPage() {
  const [secret, setSecret] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [runId, setRunId] = useState("");
  const [eventId, setEventId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [cogs, setCogs] = useState<string | null>(null);

  function authHeaders() {
    return {
      Authorization: `Bearer ${secret || "dev-admin"}`,
      "Content-Type": "application/json",
    };
  }

  async function impersonate() {
    setMessage(null);
    const response = await fetch("/api/internal/admin/impersonate", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ workspaceId }),
    });
    const data = await response.json();
    setMessage(JSON.stringify(data));
  }

  async function clearImpersonate() {
    const response = await fetch("/api/internal/admin/impersonate", {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await response.json();
    setMessage(JSON.stringify(data));
  }

  async function loadCogs() {
    setCogs(null);
    const response = await fetch(`/api/internal/admin/cogs/${runId}`, {
      headers: authHeaders(),
    });
    const data = await response.json();
    setCogs(JSON.stringify(data, null, 2));
  }

  async function replayWebhook() {
    const response = await fetch("/api/internal/admin/webhooks/replay", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ eventId }),
    });
    const data = await response.json();
    setMessage(JSON.stringify(data));
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Internal admin</h1>
        <p className="mt-3 text-sm text-cb-muted">
          Protected by Bearer INTERNAL_ADMIN_SECRET (use dev-admin only in local development).
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="secret">Admin secret</Label>
        <Input id="secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
      </div>
      <div className="space-y-3 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <p className="text-sm font-medium">Impersonate workspace</p>
        <Input placeholder="workspace id" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
        <div className="flex gap-2">
          <Button type="button" onClick={() => void impersonate()}>
            Act as workspace
          </Button>
          <Button type="button" variant="outline" onClick={() => void clearImpersonate()}>
            Clear
          </Button>
        </div>
      </div>
      <div className="space-y-3 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <p className="text-sm font-medium">COGS per run</p>
        <Input placeholder="run id" value={runId} onChange={(e) => setRunId(e.target.value)} />
        <Button type="button" onClick={() => void loadCogs()}>
          Estimate
        </Button>
        {cogs ? <pre className="overflow-auto rounded-cb-control bg-cb-bg p-3 text-xs">{cogs}</pre> : null}
      </div>
      <div className="space-y-3 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <p className="text-sm font-medium">Replay webhook</p>
        <Input placeholder="event id" value={eventId} onChange={(e) => setEventId(e.target.value)} />
        <Button type="button" onClick={() => void replayWebhook()}>
          Replay
        </Button>
      </div>
      {message ? <p className="break-all text-sm text-cb-muted">{message}</p> : null}
    </div>
  );
}
