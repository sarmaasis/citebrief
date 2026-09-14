"use client";

import { useState } from "react";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { EnginePicker } from "@/components/settings/engine-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormNoticeText, type FormNotice } from "@/components/ui/form-notice";
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
  paid,
  showRoiMinutes,
  riskNotifyAllowed,
}: {
  initial: {
    name: string;
    timezone: string;
    senderName: string;
    senderDomain: string;
    defaultEngines: string;
    slackWebhookUrl: string;
    minutesSavedPerReport: number;
    notifyHighRisks: boolean;
    highRiskLastNotifiedAt: string | null;
  };
  slackAllowed: boolean;
  customSenderAllowed: boolean;
  studioEnginesAllowed: boolean;
  paid: boolean;
  showRoiMinutes?: boolean;
  riskNotifyAllowed?: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [senderName, setSenderName] = useState(initial.senderName);
  const [senderDomain, setSenderDomain] = useState(initial.senderDomain);
  const [defaultEngines, setDefaultEngines] = useState(initial.defaultEngines);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(initial.slackWebhookUrl);
  const [minutesSavedPerReport, setMinutesSavedPerReport] = useState(String(initial.minutesSavedPerReport));
  const [notifyHighRisks, setNotifyHighRisks] = useState(initial.notifyHighRisks);
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSenderUpgrade, setShowSenderUpgrade] = useState(false);
  const timezoneOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/settings/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          timezone,
          senderName,
          senderDomain,
          defaultEngines,
          slackWebhookUrl,
          minutesSavedPerReport: Number(minutesSavedPerReport),
          notifyHighRisks,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice({ type: "error", text: data.error ?? "Could not save workspace." });
        if (data.error?.toLowerCase().includes("sender")) {
          setShowSenderUpgrade(true);
        }
        return;
      }
      setNotice({ type: "success", text: "Workspace saved. Friday cron uses this timezone at 06:00." });
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
          paid={paid}
          studioAllowed={studioEnginesAllowed}
        />
        {showRoiMinutes ? (
          <div className="space-y-2">
            <Label htmlFor="minutesSavedPerReport">Minutes saved per report</Label>
            <Input
              id="minutesSavedPerReport"
              type="number"
              min={45}
              max={90}
              value={minutesSavedPerReport}
              onChange={(e) => setMinutesSavedPerReport(e.target.value)}
            />
            <p className="text-xs text-cb-muted">
              Command Center hours-saved uses 45–90 minutes per generated report. Default is 60.
            </p>
          </div>
        ) : null}
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
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-cb-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={notifyHighRisks}
              disabled={!riskNotifyAllowed}
              onChange={(e) => setNotifyHighRisks(e.target.checked)}
            />
            <span>
              <span className="font-medium">Email me when clients are At risk</span>
              <span className="mt-1 block text-xs text-cb-muted">
                {riskNotifyAllowed
                  ? `Friday digest of At-risk brands via Cloudflare Email.${
                      initial.highRiskLastNotifiedAt
                        ? ` Last sent ${new Date(initial.highRiskLastNotifiedAt).toLocaleDateString()}.`
                        : " Not sent yet."
                    }`
                  : "Agency+ with email send unlocks high-risk Friday digests."}
              </span>
            </span>
          </label>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save workspace"}
        </Button>
        <FormNoticeText notice={notice} />
      </form>
    </div>
  );
}
