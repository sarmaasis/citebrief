"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";

export function MembersForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seatCap, setSeatCap] = useState<number | null>(null);
  const [seatsUsed, setSeatsUsed] = useState<number | null>(null);
  const [showSeatUpgrade, setShowSeatUpgrade] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/settings/members");
      if (!response.ok) return;
      const data = (await response.json()) as {
        seatCap?: number;
        seatsUsed?: number;
        members?: unknown[];
      };
      if (typeof data.seatCap === "number") setSeatCap(data.seatCap);
      if (typeof data.seatsUsed === "number") setSeatsUsed(data.seatsUsed);
      else if (Array.isArray(data.members)) setSeatsUsed(data.members.length);
    })();
  }, []);

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
      const data = (await response.json()) as {
        error?: string;
        link?: string;
        seatCap?: number;
        seatsUsed?: number;
      };
      if (!response.ok) {
        setMessage(data.error ?? "Invite failed.");
        if (response.status === 403 && data.error?.toLowerCase().includes("seat")) {
          setShowSeatUpgrade(true);
        }
        return;
      }
      setMessage(data.link ? `Invite sent. Accept link: ${data.link}` : "Invite sent.");
      if (typeof data.seatCap === "number") setSeatCap(data.seatCap);
      if (typeof data.seatsUsed === "number") setSeatsUsed(data.seatsUsed);
      setEmail("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {seatCap != null && seatsUsed != null ? (
        <p className="text-sm text-cb-muted">
          Seats: {seatsUsed}/{seatCap}
        </p>
      ) : null}
      {showSeatUpgrade ? (
        <UpgradePrompt
          title="You hit the Agency seat cap"
          body="Studio includes 10 seats so larger account teams can share brands and Friday reports."
          cta="Upgrade to Studio"
          href="/app/settings/billing"
          onDismiss={() => setShowSeatUpgrade(false)}
        />
      ) : null}
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
    </div>
  );
}
