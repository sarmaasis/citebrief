"use client";

import Link from "next/link";
import { useState } from "react";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { SourcesDrawer, type AuditEngineRow } from "@/components/reports/sources-drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogCloseButton } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReportViewer({
  brandId,
  brandName,
  reportId,
  period,
  scoreMentioned,
  scoreTotal,
  summary,
  html,
  shareToken,
  partial,
  auditRows = [],
  allowClientCc = true,
  showSources = true,
}: {
  brandId: string;
  brandName: string;
  reportId: string;
  period: string | null;
  scoreMentioned: number | null;
  scoreTotal: number;
  summary: string | null;
  html: string | null;
  shareToken: string | null;
  partial: boolean;
  auditRows?: AuditEngineRow[];
  allowClientCc?: boolean;
  showSources?: boolean;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [ccOpen, setCcOpen] = useState(false);
  const [ccEmail, setCcEmail] = useState("");
  const [ccBusy, setCcBusy] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [ccUpgrade, setCcUpgrade] = useState(false);

  async function copyLink() {
    if (!shareToken) {
      setToast("Share link is not ready yet.");
      return;
    }
    const url = `${window.location.origin}/r/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setToast("Client link copied");
    window.setTimeout(() => setToast(null), 3000);
  }

  async function sendCcClient(event: React.FormEvent) {
    event.preventDefault();
    if (!allowClientCc) {
      setCcUpgrade(true);
      setCcOpen(false);
      return;
    }
    const email = ccEmail.trim();
    if (!email) {
      setToast("Enter a client email.");
      return;
    }
    setCcBusy(true);
    try {
      const response = await fetch(`/api/reports/${reportId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ccClient: email }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (response.status === 402 || response.status === 403) {
          setCcUpgrade(true);
          setCcOpen(false);
        } else {
          setToast(data.error ?? "Could not send. Try again.");
        }
      } else {
        setToast("Report queued to client. Resend uses a stub if keys are missing.");
        setCcOpen(false);
        setCcEmail("");
      }
    } finally {
      setCcBusy(false);
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div className="-mx-8 -mt-8 min-h-[calc(100vh-3.5rem)] bg-cb-bg">
      <div className="flex h-14 items-center justify-between border-b border-cb-line bg-cb-surface px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-cb-text">
            {brandName}
            {period ? ` · Week of ${period}` : ""}
          </p>
          <p className="font-mono text-xs tabular-nums text-cb-accent">
            {scoreMentioned == null ? "-/20" : `${scoreMentioned}/${scoreTotal}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/reports/${reportId}/download?format=pdf`}>Download PDF</a>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
            Copy client link
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (!allowClientCc) {
                setCcUpgrade(true);
                return;
              }
              setCcOpen(true);
            }}
          >
            CC client
          </Button>
          {showSources ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSourcesOpen(true)}>
              Sources
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href={`/app/brands/${brandId}`}>Back</Link>
          </Button>
        </div>
      </div>

      {partial ? (
        <div className="border-b border-cb-line bg-cb-pending-subtle px-6 py-3 text-sm text-cb-pending">
          3 of 4 engines returned. Numbers reflect available engines.
        </div>
      ) : null}

      {ccUpgrade ? (
        <div className="border-b border-cb-line px-6 py-4">
          <UpgradePrompt
            title={UPGRADE_COPY.ccStarter.title}
            body={UPGRADE_COPY.ccStarter.body}
            cta={UPGRADE_COPY.ccStarter.cta}
            onDismiss={() => setCcUpgrade(false)}
          />
        </div>
      ) : null}

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-cb-card border border-cb-line bg-cb-surface">
          {html ? (
            <iframe title="Report" className="min-h-[80vh] w-full rounded-cb-card" srcDoc={html} />
          ) : (
            <div className="p-8">
              <p className="font-mono text-[28px] tabular-nums text-cb-accent">
                {scoreMentioned == null ? "-/20" : `${scoreMentioned}/${scoreTotal}`}
              </p>
              <p className="mt-3 text-sm text-cb-text">
                {summary || "Named in buyer questions this week."}
              </p>
              <p className="mt-6 text-sm text-cb-muted">Report HTML is not available yet.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={ccOpen}
        onOpenChange={setCcOpen}
        title="CC this report to your client"
        description="We email the summary and a read-only client link. Use their work address."
      >
        <form onSubmit={(event) => void sendCcClient(event)} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cc-client-email">Client email</Label>
            <Input
              id="cc-client-email"
              type="email"
              autoComplete="email"
              placeholder="client@company.com"
              value={ccEmail}
              onChange={(event) => setCcEmail(event.target.value)}
              required
            />
          </div>
          <DialogActions>
            <DialogCloseButton onClick={() => setCcOpen(false)} />
            <Button type="submit" size="sm" disabled={ccBusy}>
              {ccBusy ? "Sending…" : "Send to client"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-cb-control border border-cb-line bg-cb-surface px-4 py-2 text-sm text-cb-text shadow-[var(--cb-shadow-menu)]">
          {toast}
        </div>
      ) : null}

      {showSources ? (
        <SourcesDrawer rows={auditRows} open={sourcesOpen} onOpenChange={setSourcesOpen} />
      ) : null}
    </div>
  );
}
