"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormNoticeText, type FormNotice } from "@/components/ui/form-notice";
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
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const accent = accentColor || "#0B3D2E";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/settings/brand-kit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl, accentColor, footerText, preparedBy }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice({ type: "error", text: data.error ?? "Could not save brand kit." });
        return;
      }
      setNotice({ type: "success", text: "Brand kit saved. Client links and PDFs use this on the next report." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accentColor">Accent color</Label>
          <div className="flex gap-2">
            <input
              type="color"
              aria-label="Accent color picker"
              className="h-10 w-12 cursor-pointer rounded-cb-control border border-cb-line bg-cb-surface p-1"
              value={/^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : "#0B3D2E"}
              onChange={(e) => setAccentColor(e.target.value)}
            />
            <Input
              id="accentColor"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              placeholder="#0B3D2E"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="preparedBy">Prepared by</Label>
          <Input
            id="preparedBy"
            value={preparedBy}
            onChange={(e) => setPreparedBy(e.target.value)}
            placeholder="Northline Agency"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="footerText">Footer</Label>
          <Input
            id="footerText"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="Confidential for client review"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save brand kit"}
        </Button>
        <FormNoticeText notice={notice} />
      </form>

      <div className="rounded-cb-card border border-cb-line bg-cb-bg p-5">
        <p className="text-xs text-cb-muted">Client link preview</p>
        <div className="mt-4 rounded-cb-card border border-cb-line bg-cb-surface p-5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="mb-3 h-6 object-contain" />
          ) : null}
          <p className="text-sm font-medium" style={{ color: accent }}>
            {preparedBy || "Your agency"}
          </p>
          <p className="mt-1 text-xs text-cb-muted">Client brand · Week of this Friday</p>
          <p className="mt-6 font-mono text-[28px] tabular-nums" style={{ color: accent }}>
            12/20
          </p>
          <p className="mt-2 text-sm text-cb-text">Named in 12 of 20 buyer questions this week.</p>
          {footerText ? <p className="mt-8 text-xs text-cb-muted">{footerText}</p> : null}
          <p className="mt-2 text-xs text-cb-muted">Prepared by {preparedBy || "your agency"}</p>
        </div>
      </div>
    </div>
  );
}
