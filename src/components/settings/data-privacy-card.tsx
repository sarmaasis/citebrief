"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DataPrivacyCard({ canManage }: { canManage: boolean }) {
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);

  async function exportData() {
    setBusy("export");
    setMessage(null);
    try {
      const response = await fetch("/api/settings/export");
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(data.error ?? "Could not export workspace data.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "citebrief-export.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Export downloaded. PDFs are not included; download those from each report.");
    } finally {
      setBusy(null);
    }
  }

  async function requestDelete() {
    setBusy("delete");
    setMessage(null);
    try {
      const response = await fetch("/api/settings/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not send the deletion request.");
        return;
      }
      setMessage(data.message ?? "Deletion request sent.");
      setConfirm("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-10 max-w-xl rounded-cb-card border border-cb-line bg-cb-surface p-5">
      <h2 className="text-sm font-medium text-cb-text">Data and account</h2>
      <p className="mt-2 text-sm leading-6 text-cb-muted">
        Export workspace brands, prompts, and report summaries. Deletion is a request: we confirm by email
        before removing the workspace.         See the{" "}
        <Link className="underline" href="/legal/privacy">
          privacy policy
        </Link>
        .
      </p>
      {canManage ? (
        <div className="mt-4 space-y-4">
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void exportData()}>
            {busy === "export" ? "Exporting…" : "Export workspace data"}
          </Button>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Request deletion</Label>
            <Input
              id="delete-confirm"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Type delete"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => void requestDelete()}
            >
              {busy === "delete" ? "Sending…" : "Request account deletion"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-cb-muted">Ask a workspace owner to export or delete this account.</p>
      )}
      {message ? <p className="mt-3 text-sm text-cb-muted">{message}</p> : null}
    </section>
  );
}
