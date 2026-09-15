"use client";

import { useState } from "react";
import { EnginePicker } from "@/components/settings/engine-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormNoticeText, type FormNotice } from "@/components/ui/form-notice";
import { NativeSelect } from "@/components/ui/native-select";
import { PLANS } from "@/lib/billing";

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
  const [defaultEngines, setDefaultEngines] = useState(initial.defaultEngines);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(initial.slackWebhookUrl);
  const [minutesSavedPerReport, setMinutesSavedPerReport] = useState(String(initial.minutesSavedPerReport));
  const [notifyHighRisks, setNotifyHighRisks] = useState(initial.notifyHighRisks);
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [busy, setBusy] = useState(false);
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
          defaultEngines,
          slackWebhookUrl,
          minutesSavedPerReport: Number(minutesSavedPerReport),
          notifyHighRisks,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice({ type: "error", text: data.error ?? "Could not save workspace." });
        return;
      }
      setNotice({ type: "success", text: "Workspace saved. Friday cron uses this timezone at 06:00." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
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
        <div className="rounded-cb-control border border-cb-line bg-cb-bg px-3 py-3 text-sm text-cb-muted">
          Email sender and custom domain are managed under{" "}
          <a href="/app/settings/domains" className="text-cb-accent underline-offset-2 hover:underline">
            Domains
          </a>
          .{" "}
          {customSenderAllowed
            ? `${PLANS.studio.name} can verify a custom reports@ domain there.`
            : `Trial and ${PLANS.agency.name} use CiteBrief on getcitebrief.com; ${PLANS.studio.name} unlocks a custom sender.`}
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
          <Label htmlFor="slackWebhookUrl">Slack incoming webhook ({PLANS.agency.name}+)</Label>
          <Input
            id="slackWebhookUrl"
            value={slackWebhookUrl}
            onChange={(e) => setSlackWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            disabled={!slackAllowed}
          />
          {!slackAllowed ? (
            <p className="text-xs text-cb-muted">Upgrade to {PLANS.agency.name} or {PLANS.studio.name} to post report-ready notices to Slack.</p>
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
                  : `${PLANS.agency.name}+ with email send unlocks high-risk Friday digests.`}
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
