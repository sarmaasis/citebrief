"use client";

import { useState } from "react";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { EnginePicker } from "@/components/settings/engine-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function WorkspaceForm({
  initial,
  slackAllowed,
  customSenderAllowed,
  studioEnginesAllowed,
}: {
  initial: {
    name: string;
    timezone: string;
    senderName: string;
    senderDomain: string;
    defaultEngines: string;
    slackWebhookUrl: string;
  };
  slackAllowed: boolean;
  customSenderAllowed: boolean;
  studioEnginesAllowed: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [senderName, setSenderName] = useState(initial.senderName);
  const [senderDomain, setSenderDomain] = useState(initial.senderDomain);
  const [defaultEngines, setDefaultEngines] = useState(initial.defaultEngines);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(initial.slackWebhookUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSenderUpgrade, setShowSenderUpgrade] = useState(false);
  const timezoneOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone, senderName, senderDomain, defaultEngines, slackWebhookUrl }),
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
          <NativeSelect id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {timezoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-cb-muted">Friday reports queue at 06:00 in this timezone.</p>
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
          <Label htmlFor="senderDomain">Sender domain</Label>
          <Input
            id="senderDomain"
            value={senderDomain}
            onChange={(e) => {
              setSenderDomain(e.target.value);
              if (!customSenderAllowed && e.target.value.trim()) setShowSenderUpgrade(true);
            }}
            placeholder="mail.agency.com"
            disabled={!customSenderAllowed}
          />
          <p className="text-xs text-cb-muted">
            {customSenderAllowed
              ? "Studio custom domain. DNS is configured after this hostname is saved."
              : "Custom sender domain is Studio."}
          </p>
        </div>
        <EnginePicker
          value={defaultEngines}
          onChange={setDefaultEngines}
          studioAllowed={studioEnginesAllowed}
        />
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
