"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
}) {
  const [toast, setToast] = useState<string | null>(null);

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

  async function ccClient() {
    const email = window.prompt("Send this report to your client");
    if (!email) {
      return;
    }
    const response = await fetch(`/api/reports/${reportId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ccClient: email }),
    });
    if (!response.ok) {
      setToast("Could not send. Try again.");
    } else {
      setToast("Report queued to client (Resend stub if keys missing).");
    }
    window.setTimeout(() => setToast(null), 3000);
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
          <Button type="button" variant="outline" size="sm" onClick={() => void ccClient()}>
            CC client
          </Button>
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

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-cb-control border border-cb-line bg-cb-surface px-4 py-2 text-sm shadow-cb-menu">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
