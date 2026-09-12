"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MembersForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "member" }),
      });
      const data = (await response.json()) as { error?: string; link?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Invite failed.");
        return;
      }
      setMessage(data.link ? `Invite sent. Accept link: ${data.link}` : "Invite sent.");
      setEmail("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <p className="text-sm text-cb-muted">Invites join as member. Only workspace owners can send invites.</p>
      <Button type="submit" disabled={busy}>
        {busy ? "Inviting…" : "Send invite"}
      </Button>
      {message ? <p className="text-sm text-cb-muted break-all">{message}</p> : null}
    </form>
  );
}
