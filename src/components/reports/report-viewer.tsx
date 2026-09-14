"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
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
  scoreRecommended,
  scoreTotal,
  summary,
  html,
  shareToken,
  shareExpiresAt,
  shareRevokedAt,
  partial,
  sentAt,
  shareOpenCount,
  auditRows = [],
  allowClientCc = false,
  allowSend = false,
  allowApproval = false,
  approvalState = "needs_review",
  showSources = true,
  suggestedEmailSubject = "",
  suggestedEmailBody = "",
  reviewActions = [],
  upsellNote = null,
}: {
  brandId: string;
  brandName: string;
  reportId: string;
  period: string | null;
  scoreMentioned: number | null;
  scoreRecommended?: number | null;
  scoreTotal: number;
  summary: string | null;
  html: string | null;
  shareToken: string | null;
  shareExpiresAt?: string | null;
  shareRevokedAt?: string | null;
  partial: boolean;
  sentAt?: string | null;
  shareOpenCount?: number | null;
  auditRows?: AuditEngineRow[];
  allowClientCc?: boolean;
  allowSend?: boolean;
  allowApproval?: boolean;
  approvalState?: string;
  showSources?: boolean;
  suggestedEmailSubject?: string;
  suggestedEmailBody?: string;
  reviewActions?: string[];
  upsellNote?: string | null;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [ccOpen, setCcOpen] = useState(false);
  const [ccEmail, setCcEmail] = useState("");
  const [ccBusy, setCcBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [ccUpgrade, setCcUpgrade] = useState(false);
  const [sendUpgrade, setSendUpgrade] = useState(false);
  const [liveToken, setLiveToken] = useState(shareToken);
  const [liveExpires, setLiveExpires] = useState(shareExpiresAt ?? null);
  const [revoked, setRevoked] = useState(Boolean(shareRevokedAt));
  const [statusOverride, setStatusOverride] = useState<{ reportId: string; approved: boolean; sent: boolean } | null>(
    null,
  );
  const [approveBusy, setApproveBusy] = useState(false);
  const [emailState, setEmailState] = useState({
    reportId,
    subject: suggestedEmailSubject,
    body: suggestedEmailBody,
    error: null as string | null,
  });
  const [draftBusy, setDraftBusy] = useState(false);
  const lastSaved = useRef({ reportId, subject: suggestedEmailSubject, body: suggestedEmailBody });
  const baseApproved = approvalState === "approved" || Boolean(sentAt);
  const baseSent = Boolean(sentAt);
  const approved = statusOverride?.reportId === reportId ? statusOverride.approved : baseApproved;
  const sent = statusOverride?.reportId === reportId ? statusOverride.sent : baseSent;
  const emailSubject = emailState.reportId === reportId ? emailState.subject : suggestedEmailSubject;
  const emailDraft = emailState.reportId === reportId ? emailState.body : suggestedEmailBody;
  const draftError = emailState.reportId === reportId ? emailState.error : null;
  const needsApprove = allowApproval && !approved && !sent;
  const canSend = allowSend && !needsApprove;

  function updateEmailState(next: Partial<{ subject: string; body: string; error: string | null }>) {
    setEmailState((current) => {
      const base =
        current.reportId === reportId
          ? current
          : { reportId, subject: suggestedEmailSubject, body: suggestedEmailBody, error: null };
      return { ...base, ...next };
    });
  }

  function flash(next: string) {
    setToast(next);
    window.setTimeout(() => setToast(null), 3000);
  }

  function handleSendDenied(status: number, error?: string) {
    if (error?.toLowerCase().includes("approve")) {
      flash(error);
      return;
    }
    if (status === 402 || status === 403) {
      setSendUpgrade(true);
      return;
    }
    flash(error ?? "Could not send. Try again.");
  }

  async function saveDraft(showToast = false) {
    if (!allowSend) return false;
    const subject = emailSubject.trim();
    const body = emailDraft.trim();
    const saved =
      lastSaved.current.reportId === reportId
        ? lastSaved.current
        : { reportId, subject: suggestedEmailSubject, body: suggestedEmailBody };
    if (!subject || !body) {
      const err = "Subject and body are required.";
      updateEmailState({ error: err });
      if (showToast) flash(err);
      return false;
    }
    if (subject === saved.subject && body === saved.body) {
      lastSaved.current = saved;
      updateEmailState({ error: null });
      return true;
    }
    setDraftBusy(true);
    try {
      const response = await fetch(`/api/reports/${reportId}/email-draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        const err = data.error ?? "Could not save the email draft.";
        updateEmailState({ error: err });
        if (showToast) flash(err);
        return false;
      }
      lastSaved.current = { reportId, subject, body };
      updateEmailState({ error: null });
      if (showToast) flash("Suggested email saved");
      return true;
    } finally {
      setDraftBusy(false);
    }
  }

  useEffect(() => {
    if (!allowSend) return;
    const timer = window.setTimeout(() => {
      void saveDraft(false);
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce subject/body only
  }, [emailSubject, emailDraft, allowSend, reportId]);

  async function approveReport() {
    if (!allowApproval) return;
    setApproveBusy(true);
    try {
      await saveDraft(false);
      const response = await fetch(`/api/reports/${reportId}/approve`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string; approvalState?: string };
      if (!response.ok) {
        flash(data.error ?? "Could not approve this report.");
        return;
      }
      setStatusOverride({ reportId, approved: true, sent });
      flash("Report approved. You can send it now.");
    } finally {
      setApproveBusy(false);
    }
  }

  async function copySuggestedEmail() {
    const text = [emailSubject.trim(), emailDraft.trim()].filter(Boolean).join("\n\n");
    if (!text) {
      flash("Write a short client note first.");
      return;
    }
    await navigator.clipboard.writeText(text);
    flash("Suggested email copied");
  }

  async function copyLink() {
    if (revoked || !liveToken) {
      flash(revoked ? "This client link was revoked. Create a new one." : "Share link is not ready yet.");
      return;
    }
    const url = `${window.location.origin}/r/${liveToken}`;
    await navigator.clipboard.writeText(url);
    flash("Client link copied");
  }

  async function manageShare(action: "revoke" | "rotate") {
    setShareBusy(true);
    try {
      const response = await fetch(`/api/reports/${reportId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        shareToken?: string;
        shareExpiresAt?: string | null;
      };
      if (!response.ok) {
        flash(data.error ?? "Could not update the client link.");
        return;
      }
      if (action === "rotate") {
        setLiveToken(data.shareToken ?? null);
        setLiveExpires(data.shareExpiresAt ?? null);
        setRevoked(false);
        flash("New client link created. The previous link no longer works.");
      } else {
        setRevoked(true);
        flash("Client link revoked. Anyone with the URL will see an expired page.");
      }
    } finally {
      setShareBusy(false);
    }
  }

  async function sendTest() {
    if (!allowSend) {
      setSendUpgrade(true);
      return;
    }
    if (needsApprove) {
      flash("Approve this report before sending.");
      return;
    }
    setTestBusy(true);
    try {
      await saveDraft(false);
      const response = await fetch(`/api/reports/${reportId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        handleSendDenied(response.status, data.error);
      } else {
        setStatusOverride({ reportId, approved, sent: true });
        flash("Test send queued to you.");
      }
    } finally {
      setTestBusy(false);
    }
  }

  async function sendCcClient(event: React.FormEvent) {
    event.preventDefault();
    if (!allowClientCc) {
      setCcUpgrade(true);
      setCcOpen(false);
      return;
    }
    if (needsApprove) {
      flash("Approve this report before sending.");
      return;
    }
    const email = ccEmail.trim();
    if (!email) {
      flash("Enter a client email.");
      return;
    }
    setCcBusy(true);
    try {
      await saveDraft(false);
      const response = await fetch(`/api/reports/${reportId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ccClient: email }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (data.error?.toLowerCase().includes("approve")) {
          flash(data.error);
        } else if (response.status === 402 || response.status === 403) {
          setCcUpgrade(true);
          setCcOpen(false);
        } else {
          flash(data.error ?? "Could not send. Try again.");
        }
      } else {
        setStatusOverride({ reportId, approved, sent: true });
        flash("Report queued to the client.");
        setCcOpen(false);
        setCcEmail("");
      }
    } finally {
      setCcBusy(false);
    }
  }

  return (
    <div className="-mx-4 -mt-6 min-h-[calc(100vh-3.5rem)] bg-cb-bg sm:-mx-8 sm:-mt-8">
      <div className="flex flex-col gap-3 border-b border-cb-line bg-cb-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-cb-text">
            {brandName}
            {period ? ` · Week of ${period}` : ""}
          </p>
          <p className="font-mono text-xs tabular-nums text-cb-accent">
            {scoreMentioned == null ? `-/${scoreTotal}` : `${scoreMentioned}/${scoreTotal}`}
            {scoreRecommended != null ? ` · rec ${scoreRecommended}/${scoreTotal}` : ""}
            {allowSend
              ? sent
                ? " · Sent"
                : allowApproval
                  ? approved
                    ? " · Approved"
                    : " · Needs review"
                  : " · Not sent"
              : " · Email on Agency"}
            {shareOpenCount ? ` · ${shareOpenCount} opens` : ""}
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
            disabled={shareBusy || (!liveToken && !revoked)}
            onClick={() => void manageShare(revoked ? "rotate" : "revoke")}
          >
            {shareBusy ? "Updating…" : revoked ? "New client link" : "Revoke link"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copySuggestedEmail()}>
            Copy suggested email
          </Button>
          {allowSend ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testBusy || needsApprove}
              onClick={() => void sendTest()}
            >
              {testBusy ? "Sending…" : "Send test"}
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setSendUpgrade(true)}>
              Email on Agency
            </Button>
          )}
          {allowSend ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={needsApprove}
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
          ) : allowClientCc ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCcOpen(true)}
            >
              CC client (trial)
            </Button>
          ) : null}
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
        <div className="border-b border-cb-line bg-cb-pending-subtle px-4 py-3 text-sm text-cb-pending sm:px-6">
          This PDF still shipped. One source did not return; numbers use what we have.
        </div>
      ) : null}

      {sendUpgrade ? (
        <div className="border-b border-cb-line px-4 py-4 sm:px-6">
          <UpgradePrompt
            title={UPGRADE_COPY.sendStarter.title}
            body={UPGRADE_COPY.sendStarter.body}
            cta={UPGRADE_COPY.sendStarter.cta}
            onDismiss={() => setSendUpgrade(false)}
          />
        </div>
      ) : null}

      {ccUpgrade ? (
        <div className="border-b border-cb-line px-4 py-4 sm:px-6">
          <UpgradePrompt
            title={UPGRADE_COPY.ccStarter.title}
            body={UPGRADE_COPY.ccStarter.body}
            cta={UPGRADE_COPY.ccStarter.cta}
            onDismiss={() => setCcUpgrade(false)}
          />
        </div>
      ) : null}

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Review before you send</h2>
            <p className="text-xs text-cb-muted">
              {sent
                ? "Sent"
                : allowApproval
                  ? approved
                    ? "Approved"
                    : "Needs review"
                  : allowSend
                    ? "Ready to send"
                    : "Download or share"}
            </p>
          </div>
          {summary ? <p className="mt-3 text-sm text-cb-text">{summary}</p> : null}
          {reviewActions.length ? (
            <div className="mt-4">
              <p className="text-xs text-cb-muted">Recommended actions</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-cb-text">
                {reviewActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {upsellNote ? (
            <p className="mt-4 text-sm text-cb-muted">
              <span className="font-medium text-cb-text">Sell next. </span>
              {upsellNote}
            </p>
          ) : null}
          <label className="mt-4 block">
            <span className="text-xs text-cb-muted">Subject</span>
            <Input
              className="mt-2"
              value={emailSubject}
              onChange={(event) => updateEmailState({ subject: event.target.value })}
              disabled={!allowSend}
            />
          </label>
          <label className="mt-4 block">
            <span className="text-xs text-cb-muted">Suggested client email</span>
            <textarea
              className="mt-2 min-h-28 w-full rounded-cb-control border border-cb-line bg-cb-bg px-3 py-2 text-sm text-cb-text disabled:opacity-60"
              value={emailDraft}
              onChange={(event) => updateEmailState({ body: event.target.value })}
              disabled={!allowSend}
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {allowSend ? (
              <Button type="button" variant="outline" size="sm" disabled={draftBusy} onClick={() => void saveDraft(true)}>
                {draftBusy ? "Saving…" : "Save email"}
              </Button>
            ) : null}
            {allowApproval && !sent ? (
              <Button type="button" size="sm" disabled={approveBusy || approved} onClick={() => void approveReport()}>
                {approveBusy ? "Approving…" : approved ? "Approved" : "Approve"}
              </Button>
            ) : null}
            {allowSend ? (
              <Button type="button" size="sm" disabled={!canSend || testBusy} onClick={() => void sendTest()}>
                {testBusy ? "Sending…" : "Send test"}
              </Button>
            ) : null}
          </div>
          {draftError ? <p className="mt-3 text-xs text-cb-danger">{draftError}</p> : null}
          {needsApprove ? (
            <p className="mt-3 text-xs text-cb-muted">Approve this report before Send test or CC client.</p>
          ) : null}
        </div>
        {revoked ? (
          <p className="mb-3 text-xs text-cb-muted">
            The client link is revoked. Create a new one if the account still needs a read-only page.
          </p>
        ) : liveExpires ? (
          <p className="mb-3 text-xs text-cb-muted">
            Client links expire 90 days after they are created and can be revoked from this page.
          </p>
        ) : (
          <p className="mb-3 text-xs text-cb-muted">Client links are read-only, expire after 90 days, and can be revoked.</p>
        )}
        <div className="rounded-cb-card border border-cb-line bg-cb-surface">
          {html ? (
            <iframe title="Report" className="min-h-[80vh] w-full rounded-cb-card" srcDoc={html} />
          ) : (
            <div className="p-8">
              <p className="font-mono text-[28px] tabular-nums text-cb-accent">
                {scoreMentioned == null ? `-/${scoreTotal}` : `${scoreMentioned}/${scoreTotal}`}
              </p>
              <p className="mt-3 text-sm text-cb-text">
                {summary || "Named in buyer questions this week."}
              </p>
              <p className="mt-6 text-sm text-cb-muted">Report HTML is not available yet. Download the PDF if it is ready.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={ccOpen}
        onOpenChange={setCcOpen}
        title="CC this report to your client"
        description={
          allowSend
            ? "We email the summary and a read-only client link. Use their work address."
            : "Trial includes one CiteBrief-branded send to a client. Agency white-label CC starts on a paid plan."
        }
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
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-cb-control border border-cb-line bg-cb-surface px-4 py-2 text-sm text-cb-text shadow-[var(--cb-shadow-menu)]"
        >
          {toast}
        </div>
      ) : null}

      {showSources ? (
        <SourcesDrawer rows={auditRows} open={sourcesOpen} onOpenChange={setSourcesOpen} />
      ) : null}
    </div>
  );
}
