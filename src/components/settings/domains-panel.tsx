"use client";

import { useState } from "react";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { Button } from "@/components/ui/button";
import { FormNoticeText, type FormNotice } from "@/components/ui/form-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { PLANS } from "@/lib/billing";
import {
  CUSTOM_DOMAIN_DNS_STEPS,
  SYSTEM_DOMAIN_OPS_STEPS,
  SYSTEM_SENDER_DOMAIN,
  type SenderDomainChecks,
  type SenderDomainStatus,
} from "@/lib/sender-domain";

type DomainState = {
  systemDomain: string;
  systemFrom: string;
  allowsCustomSender: boolean;
  senderName: string | null;
  senderDomain: string | null;
  checks: SenderDomainChecks;
  status: SenderDomainStatus;
  verifiedAt: string | null;
  customFromActive: boolean;
  previewFrom: string;
};

function statusLabel(status: SenderDomainStatus): string {
  switch (status) {
    case "system":
      return "CiteBrief sender";
    case "none":
      return "Not configured";
    case "pending":
      return "Pending DNS";
    case "verified":
      return "Verified";
    default:
      return status;
  }
}

function StatusPill({ status }: { status: SenderDomainStatus }) {
  const tone =
    status === "verified"
      ? "border-cb-accent/40 bg-cb-accent/10 text-cb-accent"
      : status === "pending"
        ? "border-cb-line bg-cb-bg text-cb-text"
        : "border-cb-line bg-cb-surface text-cb-muted";
  return (
    <span className={`inline-flex rounded-cb-control border px-2 py-0.5 text-xs ${tone}`}>
      {statusLabel(status)}
    </span>
  );
}

export function DomainsPanel({
  initial,
  canEdit,
}: {
  initial: DomainState;
  canEdit: boolean;
}) {
  const [senderName, setSenderName] = useState(initial.senderName || "");
  const [senderDomain, setSenderDomain] = useState(initial.senderDomain || "");
  const [checks, setChecks] = useState<SenderDomainChecks>(initial.checks);
  const [previewFrom, setPreviewFrom] = useState(initial.previewFrom);
  const [status, setStatus] = useState<SenderDomainStatus>(
    initial.allowsCustomSender ? initial.status : "system",
  );
  const [customFromActive, setCustomFromActive] = useState(initial.customFromActive);
  const [verifiedAt, setVerifiedAt] = useState(initial.verifiedAt);
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function save(nextChecks?: SenderDomainChecks) {
    if (!canEdit) {
      setNotice({ type: "error", text: "Only owners and admins can change domains." });
      return;
    }
    if (!initial.allowsCustomSender) {
      setShowUpgrade(true);
      return;
    }
    setBusy(true);
    setNotice(null);
    const payloadChecks = nextChecks ?? checks;
    try {
      const response = await fetch("/api/settings/domains", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName,
          senderDomain: senderDomain.trim() || null,
          checks: payloadChecks,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        domain?: DomainState;
      };
      if (!response.ok) {
        setNotice({ type: "error", text: data.error ?? "Could not save domain." });
        if (data.error?.toLowerCase().includes("studio")) setShowUpgrade(true);
        return;
      }
      if (data.domain) {
        setChecks(data.domain.checks);
        setPreviewFrom(data.domain.previewFrom);
        setStatus(data.domain.status);
        setCustomFromActive(data.domain.customFromActive);
        setVerifiedAt(data.domain.verifiedAt);
        setSenderDomain(data.domain.senderDomain || "");
        setSenderName(data.domain.senderName || "");
      }
      setNotice({
        type: "success",
        text: data.domain?.customFromActive
          ? "Custom sender verified. Friday reports will use reports@your-domain."
          : "Domain settings saved. Complete the DNS checklist to activate custom From.",
      });
    } finally {
      setBusy(false);
    }
  }

  function toggleCheck(key: keyof SenderDomainChecks) {
    if (!canEdit || !initial.allowsCustomSender || !senderDomain.trim()) return;
    const next = { ...checks, [key]: !checks[key] };
    setChecks(next);
    void save(next);
  }

  return (
    <div className="space-y-8">
      {showUpgrade ? (
        <UpgradePrompt
          title={UPGRADE_COPY.customSender.title}
          body={UPGRADE_COPY.customSender.body}
          cta={UPGRADE_COPY.customSender.cta}
          onDismiss={() => setShowUpgrade(false)}
        />
      ) : null}

      <section className="max-w-2xl space-y-3 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-cb-text">CiteBrief system domain</h2>
          <StatusPill status="system" />
        </div>
        <p className="text-sm text-cb-muted">
          Trial CC, {PLANS.agency.name}, Starter, auth, invites, and all CiteBrief-branded mail send from{" "}
          <span className="font-medium text-cb-text">{SYSTEM_SENDER_DOMAIN}</span>. {PLANS.studio.name} uses this
          until a custom domain is verified.
        </p>
        <p className="font-mono text-sm text-cb-text">{initial.systemFrom}</p>
        <details className="text-sm text-cb-muted">
          <summary className="cursor-pointer text-cb-text">Ops DNS checklist (founders)</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {SYSTEM_DOMAIN_OPS_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      </section>

      <section className="max-w-2xl space-y-4 rounded-cb-card border border-cb-line bg-cb-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-cb-text">{PLANS.studio.name} custom sender</h2>
          <StatusPill status={initial.allowsCustomSender ? status : "system"} />
        </div>
        {!initial.allowsCustomSender ? (
          <div className="space-y-3">
            <p className="text-sm text-cb-muted">
              {PLANS.agency.name} keeps white-label PDF and client links with the CiteBrief send path on{" "}
              {SYSTEM_SENDER_DOMAIN}. Custom sender name and domain unlock on {PLANS.studio.name}.
            </p>
            <Button type="button" variant="outline" onClick={() => setShowUpgrade(true)}>
              See {PLANS.studio.name} upgrade
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-cb-muted">
              After DNS is verified, Friday client mail sends as{" "}
              <span className="font-mono text-cb-text">reports@your-domain</span>. Verification is
              manual — mark each step once Cloudflare Email Sending shows the records as valid.
              Automatic DNS polling is not shipped.
            </p>
            <div className="space-y-2">
              <Label htmlFor="senderName">Sender display name</Label>
              <Input
                id="senderName"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Northline Agency"
                disabled={!canEdit || busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderDomain">Sender domain</Label>
              <Input
                id="senderDomain"
                value={senderDomain}
                onChange={(e) => setSenderDomain(e.target.value)}
                placeholder="reports.agency.com"
                disabled={!canEdit || busy}
              />
              <p className="text-xs text-cb-muted">
                Hostname only — not {SYSTEM_SENDER_DOMAIN}. Changing the domain clears checklist
                progress.
              </p>
            </div>
            <div className="rounded-cb-control border border-cb-line bg-cb-bg px-3 py-2 text-sm">
              <p className="text-xs text-cb-muted">From preview</p>
              <p className="mt-1 font-mono text-cb-text">{previewFrom}</p>
              {customFromActive && verifiedAt ? (
                <p className="mt-1 text-xs text-cb-muted">
                  Verified {new Date(verifiedAt).toLocaleString()}.
                </p>
              ) : null}
            </div>
            <Button type="button" disabled={!canEdit || busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save sender"}
            </Button>

            <div className="space-y-3 border-t border-cb-line pt-4">
              <p className="text-sm font-medium text-cb-text">DNS / Cloudflare checklist</p>
              <ul className="space-y-3">
                {CUSTOM_DOMAIN_DNS_STEPS.map((step) => {
                  const key =
                    step.id === "spf"
                      ? "spfOk"
                      : step.id === "dkim"
                        ? "dkimOk"
                        : step.id === "dmarc"
                          ? "dmarcOk"
                          : "cfOk";
                  const checked = checks[key];
                  return (
                    <li key={step.id}>
                      <label className="flex items-start gap-3 text-sm text-cb-text">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          disabled={!canEdit || busy || !senderDomain.trim()}
                          onChange={() => toggleCheck(key)}
                        />
                        <span>
                          <span className="font-medium">{step.label}</span>
                          <span className="mt-1 block text-xs text-cb-muted">{step.detail}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-cb-muted">
                Docs: Cloudflare Email Service → Domain configuration (SPF/DKIM on{" "}
                <span className="font-mono">cf-bounce</span>, DMARC on{" "}
                <span className="font-mono">_dmarc</span>).
              </p>
            </div>
          </>
        )}
        <FormNoticeText notice={notice} />
      </section>
    </div>
  );
}
