"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BrandKitForm({
  initial,
}: {
  initial: {
    logoUrl: string;
    accentColor: string;
    footerText: string;
    preparedBy: string;
  };
}) {
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [accentColor, setAccentColor] = useState(initial.accentColor);
  const [footerText, setFooterText] = useState(initial.footerText);
  const [preparedBy, setPreparedBy] = useState(initial.preparedBy);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/brand-kit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl, accentColor, footerText, preparedBy }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not save brand kit.");
        return;
      }
      setMessage("Brand kit saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="logoUrl">Logo URL</Label>
        <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="accentColor">Accent color</Label>
        <Input id="accentColor" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder="#0B3D2E" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="preparedBy">Prepared by</Label>
        <Input id="preparedBy" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="Northline Agency" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="footerText">Footer</Label>
        <Input id="footerText" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Confidential for client review" />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save brand kit"}
      </Button>
      {message ? <p className="text-sm text-cb-muted">{message}</p> : null}
    </form>
  );
}
