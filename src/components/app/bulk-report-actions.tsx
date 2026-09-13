"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PIPELINE_LABEL, type PipelineStage } from "@/lib/command-center";
import Link from "next/link";

export type QueueRow = {
  brandId: string;
  brandName: string;
  reportId: string | null;
  pipeline: PipelineStage;
  actionVerb: string;
  actionHref: string;
};

export function ReportsQueue({
  rows,
  allowsBulkSend,
  allowsEmailSend,
}: {
  rows: QueueRow[];
  allowsBulkSend: boolean;
  allowsEmailSend: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<"approve" | "send" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectable = useMemo(
    () => rows.filter((row) => row.reportId && (row.pipeline === "needs_review" || row.pipeline === "ready_to_send")),
    [rows],
  );

  useEffect(() => {
    const valid = new Set(selectable.map((row) => row.reportId as string));
    setSelected((current) => current.filter((id) => valid.has(id)));
  }, [selectable]);

  const selectedSet = new Set(selected);
  const selectedRows = selectable.filter((row) => row.reportId && selectedSet.has(row.reportId));
  const approveIds = selectedRows.filter((row) => row.pipeline === "needs_review").map((row) => row.reportId as string);
  const sendIds = selectedRows.filter((row) => row.pipeline === "ready_to_send").map((row) => row.reportId as string);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    if (selected.length === selectable.length) {
      setSelected([]);
      return;
    }
    setSelected(selectable.map((row) => row.reportId as string));
  }

  async function approve() {
    if (approveIds.length === 0) {
      setMessage("Select reports that still need approval.");
      return;
    }
    setBusy("approve");
    setMessage(null);
    try {
      const response = await fetch("/api/reports/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: approveIds }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; approved?: number };
      if (!response.ok) {
        setMessage(data.error ?? "Could not approve reports.");
        return;
      }
      setSelected((current) => current.filter((id) => !approveIds.includes(id)));
      setMessage(`Approved ${data.approved ?? approveIds.length} report${(data.approved ?? approveIds.length) === 1 ? "" : "s"}.`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (sendIds.length === 0) {
      setMessage(allowsEmailSend ? "Select approved reports to send. Approve first if they are still in review." : "Email send is not on this plan.");
      return;
    }
    setBusy("send");
    setMessage(null);
    try {
      const response = await fetch("/api/reports/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: sendIds }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        sent?: number;
        errors?: { id: string; error: string }[];
      };
      if (!response.ok) {
        setMessage(data.error ?? "Could not send reports.");
        return;
      }
      const failed = data.errors?.length ?? 0;
      setSelected((current) => current.filter((id) => !sendIds.includes(id)));
      setMessage(
        failed
          ? `Sent ${data.sent ?? 0}. ${failed} could not send.`
          : `Sent ${data.sent ?? sendIds.length} report${(data.sent ?? sendIds.length) === 1 ? "" : "s"} to your inbox.`,
      );
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {allowsBulkSend ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy !== null || approveIds.length === 0} onClick={() => void approve()}>
            {busy === "approve" ? "Approving…" : `Approve selected${approveIds.length ? ` (${approveIds.length})` : ""}`}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy !== null || !allowsEmailSend || sendIds.length === 0}
            onClick={() => void send()}
          >
            {busy === "send" ? "Sending…" : `Send selected${sendIds.length ? ` (${sendIds.length})` : ""}`}
          </Button>
          <p className="text-xs text-cb-muted">Studio bulk actions. Send uses the stored draft and goes to your login email.</p>
        </div>
      ) : null}
      {message ? <p className="mb-4 text-sm text-cb-muted">{message}</p> : null}
      <div className="overflow-hidden rounded-cb-card border border-cb-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-cb-surface text-left text-cb-muted">
            <tr className="h-12 border-b border-cb-line">
              {allowsBulkSend ? (
                <th className="w-10 px-4">
                  <input
                    type="checkbox"
                    aria-label="Select all reports"
                    checked={selectable.length > 0 && selected.length === selectable.length}
                    onChange={toggleAll}
                    disabled={selectable.length === 0}
                  />
                </th>
              ) : null}
              <th className="px-4 font-medium">Brand</th>
              <th className="px-4 font-medium">Pipeline</th>
              <th className="px-4 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="h-12">
                <td className="px-4 text-cb-muted" colSpan={allowsBulkSend ? 4 : 3}>
                  No brands in this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const canSelect = Boolean(row.reportId && (row.pipeline === "needs_review" || row.pipeline === "ready_to_send"));
                return (
                  <tr key={row.brandId} className="h-12 border-b border-cb-line last:border-0">
                    {allowsBulkSend ? (
                      <td className="px-4">
                        {canSelect ? (
                          <input
                            type="checkbox"
                            aria-label={`Select ${row.brandName}`}
                            checked={Boolean(row.reportId && selectedSet.has(row.reportId))}
                            onChange={() => row.reportId && toggle(row.reportId)}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="px-4">
                      <Link href={`/app/brands/${row.brandId}`} className="text-cb-accent">
                        {row.brandName}
                      </Link>
                    </td>
                    <td className="px-4 text-cb-muted">{PIPELINE_LABEL[row.pipeline]}</td>
                    <td className="px-4">
                      <Link href={row.actionHref} className="text-cb-accent">
                        {row.actionVerb}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
