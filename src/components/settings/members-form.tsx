"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MembersForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
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
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json()) as { error?: string; link?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Invite failed.");
        return;
      }
      setMessage(data.link ? `Invite stubbed. Link: ${data.link}` : "Invite sent.");
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
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          className="flex h-10 w-full rounded-cb-control border border-cb-line bg-cb-surface px-3 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Inviting…" : "Send invite"}
      </Button>
      {message ? <p className="text-sm text-cb-muted break-all">{message}</p> : null}
    </form>
  );
}
