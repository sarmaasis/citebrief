"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LEAD_KEY = "citebrief.lead.v1";

export type LeadDraft = {
  email: string;
  domain: string;
  competitors: string;
  market: string;
};

export function readLeadDraft(): LeadDraft | null {
  try {
    const raw = sessionStorage.getItem(LEAD_KEY);
    return raw ? (JSON.parse(raw) as LeadDraft) : null;
  } catch {
    return null;
  }
}

export function clearLeadDraft() {
  sessionStorage.removeItem(LEAD_KEY);
}

/** Hero form: work email + client domain + competitors + market → signup / onboarding. */
export function DomainLeadForm({ signedIn = false }: { signedIn?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [market, setMarket] = useState("US");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/leads/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, domain, competitors, market }),
      });
      const data = (await response.json()) as {
        error?: string;
        href?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not start the brief.");
        return;
      }
      const draft: LeadDraft = { email, domain, competitors, market };
      sessionStorage.setItem(LEAD_KEY, JSON.stringify(draft));
      router.push(data.href ?? "/signup?plan=agency");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-md space-y-3 rounded-cb-card border border-cb-line bg-cb-surface p-4">
      <p className="text-sm font-medium text-cb-text">Send a client domain</p>
      {!signedIn ? (
        <div className="space-y-1">
          <Label htmlFor="lead-email">Work email</Label>
          <Input
            id="lead-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="lead-domain">Client domain</Label>
        <Input
          id="lead-domain"
          required
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="northstar.app"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-competitors">Competitors (1–3)</Label>
        <Input
          id="lead-competitors"
          required
          value={competitors}
          onChange={(e) => setCompetitors(e.target.value)}
          placeholder="ClickUp, Asana, Monday.com"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-market">Market</Label>
        <Input id="lead-market" value={market} onChange={(e) => setMarket(e.target.value)} placeholder="US" />
      </div>
      {error ? <p className="text-sm text-cb-missing">{error}</p> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Starting…" : "Send a client domain"}
      </Button>
      <p className="text-xs text-cb-muted">You’ll get a brief. We email this address.</p>
    </form>
  );
}
