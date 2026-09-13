"use client";

import { useState } from "react";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WorkspaceForm({
  initial,
  slackAllowed,
  customSenderAllowed,
}: {
  initial: {
    name: string;
    timezone: string;
    senderName: string;
    defaultEngines: string;
    slackWebhookUrl: string;
  };
  slackAllowed: boolean;
  customSenderAllowed: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [senderName, setSenderName] = useState(initial.senderName);
  const [defaultEngines, setDefaultEngines] = useState(initial.defaultEngines);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(initial.slackWebhookUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSenderUpgrade, setShowSenderUpgrade] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone, senderName, defaultEngines, slackWebhookUrl }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not save workspace.");
        if (data.error?.toLowerCase().includes("sender")) {
          setShowSenderUpgrade(true);
        }
        return;
      }
      setMessage("Workspace saved. Friday cron uses this timezone at 06:00.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {showSenderUpgrade ? (
        <UpgradePrompt
          title={UPGRADE_COPY.customSender.title}
          body={UPGRADE_COPY.customSender.body}
          cta={UPGRADE_COPY.customSender.cta}
          onDismiss={() => setShowSenderUpgrade(false)}
        />
      ) : null}
      <form onSubmit={onSubmit} className="max-w-lg space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Workspace name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senderName">Email sender name</Label>
          <Input
            id="senderName"
            value={senderName}
            onChange={(e) => {
              setSenderName(e.target.value);
              if (!customSenderAllowed && e.target.value.trim() && e.target.value.trim() !== "CiteBrief") {
                setShowSenderUpgrade(true);
              }
            }}
            placeholder="CiteBrief"
            disabled={!customSenderAllowed && Boolean(initial.senderName) === false ? false : false}
          />
          {!customSenderAllowed ? (
            <p className="text-xs text-cb-muted">
              Starter and Agency use the CiteBrief sender. Custom sender name and domain are Studio.
            </p>
          ) : (
            <p className="text-xs text-cb-muted">Studio custom sender name. Domain setup is handled in DNS.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultEngines">Default engines</Label>
          <Input
            id="defaultEngines"
            value={defaultEngines}
            onChange={(e) => setDefaultEngines(e.target.value)}
            placeholder="chatgpt,perplexity,gemini,aio"
          />
          <p className="text-xs text-cb-muted">Studio can add claude,grok when AI Gateway and plan allow.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="slackWebhookUrl">Slack incoming webhook (Agency+)</Label>
          <Input
            id="slackWebhookUrl"
            value={slackWebhookUrl}
            onChange={(e) => setSlackWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            disabled={!slackAllowed}
          />
          {!slackAllowed ? (
            <p className="text-xs text-cb-muted">Upgrade to Agency or Studio to post report-ready notices to Slack.</p>
          ) : (
            <p className="text-xs text-cb-muted">Posts a short message when a report is ready or Friday send runs.</p>
          )}
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save workspace"}
        </Button>
        {message ? <p className="text-sm text-cb-muted">{message}</p> : null}
      </form>
    </div>
  );
}
