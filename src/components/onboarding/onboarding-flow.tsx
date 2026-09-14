"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandFields, emptyBrandFields, type BrandFieldValues } from "@/components/brands/brand-fields";
import { IndustryPacks } from "@/components/prompts/industry-packs";
import { PromptEditor } from "@/components/prompts/prompt-editor";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { CORE_ENGINES, ENGINES, type EngineState } from "@/lib/engines";
import { onboardingStepFromResume, syncOnboardingBrandQuery, type OnboardingResume } from "@/lib/onboarding-resume";
import { generatePromptsCta, promptSetHint, type PromptDraft, validatePromptSet } from "@/lib/prompts";
import { UpgradeDialog, UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { UPGRADE_COPY, brandCapUpgradeFromError } from "@/lib/upgrade-copy";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const steps = ["Brand", "Prompts", "Report"] as const;
const ONBOARDING_SNAP = "citebrief.onboarding.v1";

type OnboardingSnap = {
  step: number;
  fields: BrandFieldValues;
  brandId: string | null;
  runId: string | null;
  reportId: string | null;
  reportReady: boolean;
  runStatus: string | null;
  scoreMentioned: number | null;
  approved: boolean;
  prompts?: PromptDraft[];
  source?: "template" | "llm" | null;
};

function readOnboardingSnap(): OnboardingSnap | null {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_SNAP);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingSnap;
  } catch {
    return null;
  }
}

function writeOnboardingSnap(snap: OnboardingSnap) {
  try {
    sessionStorage.setItem(ONBOARDING_SNAP, JSON.stringify(snap));
  } catch {
    /* ignore quota */
  }
}

function clearOnboardingSnap() {
  try {
    sessionStorage.removeItem(ONBOARDING_SNAP);
  } catch {
    /* ignore */
  }
}

export function OnboardingFlow({
  allowSend = false,
  allowApproval = false,
  resume = null,
  startFresh = false,
  promptCap,
}: {
  allowSend?: boolean;
  allowApproval?: boolean;
  resume?: OnboardingResume | null;
  startFresh?: boolean;
  promptCap: number;
}) {
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState<BrandFieldValues>(emptyBrandFields);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<PromptDraft[]>([]);
  const [source, setSource] = useState<"template" | "llm" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [engines, setEngines] = useState<Record<string, EngineState> | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [reportReady, setReportReady] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [scoreMentioned, setScoreMentioned] = useState<number | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [showBrandUpgrade, setShowBrandUpgrade] = useState(false);
  const brandUpgrade = brandCapUpgradeFromError(status);
  const pollRef = useRef<(id: string) => void>(() => undefined);
  const finishedRef = useRef(false);

  function finishOnboarding() {
    finishedRef.current = true;
    clearOnboardingSnap();
  }

  function applyApproval(state?: string | null) {
    if (state === "approved") setApproved(true);
    else if (state === "needs_review") setApproved(false);
  }

  function applyResume(next: OnboardingResume, snap?: OnboardingSnap | null) {
    const sameSnap = snap?.brandId === next.brandId ? snap : null;
    setBrandId(next.brandId);
    setFields(sameSnap?.fields ?? next.fields);
    setPrompts(sameSnap?.prompts?.length ? sameSnap.prompts : next.prompts);
    if (sameSnap?.source) setSource(sameSnap.source);
    setRunId(sameSnap?.runId ?? next.runId);
    setReportId(sameSnap?.reportId ?? next.reportId);
    setReportReady(Boolean(sameSnap?.reportReady ?? next.reportReady));
    setRunStatus(sameSnap?.runStatus ?? next.runStatus);
    setScoreMentioned(sameSnap?.scoreMentioned ?? next.scoreMentioned);
    setApproved(next.approvalState === "approved");
    setEngines(next.engines);
    setStep(sameSnap?.step || onboardingStepFromResume(next));
    const runId = sameSnap?.runId ?? next.runId;
    if (runId) pollRef.current(runId);
    syncOnboardingBrandQuery(next.brandId);
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      if (startFresh) {
        clearOnboardingSnap();
        setRestored(true);
        return;
      }
      const snap = readOnboardingSnap();
      if (resume) {
        applyResume(resume, snap);
        setRestored(true);
        return;
      }
      if (snap?.brandId) {
        const response = await fetch(`/api/brands/${snap.brandId}`);
        if (response.ok) {
          const bundle = (await response.json()) as {
            latestRun?: { id?: string | null };
            latestReport?: { id?: string | null; approvalState?: string | null; scoreMentioned?: number | null };
          };
          const approvalState = bundle.latestReport?.approvalState ?? null;
          setStep(snap.step || 1);
          setFields(snap.fields || emptyBrandFields);
          setBrandId(snap.brandId);
          setRunId(snap.runId ?? bundle.latestRun?.id ?? null);
          setReportId(snap.reportId ?? bundle.latestReport?.id ?? null);
          setReportReady(Boolean(snap.reportReady || bundle.latestReport?.id));
          setRunStatus(snap.runStatus);
          setScoreMentioned(snap.scoreMentioned ?? bundle.latestReport?.scoreMentioned ?? null);
          setApproved(approvalState === "approved");
          if (snap.prompts?.length) setPrompts(snap.prompts);
          if (snap.source) setSource(snap.source);
          const runId = snap.runId ?? bundle.latestRun?.id ?? null;
          if (runId) pollRef.current(runId);
          syncOnboardingBrandQuery(snap.brandId);
          setRestored(true);
          return;
        }
        clearOnboardingSnap();
      }
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from server resume + snap
  }, []);

  useEffect(() => {
    if (!restored || !brandId || finishedRef.current) return;
    writeOnboardingSnap({
      step,
      fields,
      brandId,
      runId,
      reportId,
      reportReady,
      runStatus,
      scoreMentioned,
      approved,
      prompts,
      source,
    });
  }, [restored, step, fields, brandId, runId, reportId, reportReady, runStatus, scoreMentioned, approved, prompts, source]);

  async function saveBrand() {
    setPending(true);
    setStatus(null);
    setShowBrandUpgrade(false);
    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setStatus(data.error ?? "Could not save the brand.");
        if (
          response.status === 402 ||
          response.status === 403 ||
          data.error?.toLowerCase().includes("cap") ||
          data.error?.toLowerCase().includes("trial")
        ) {
          setShowBrandUpgrade(true);
        }
        return;
      }
      setBrandId(data.id);
      setStep(2);
      syncOnboardingBrandQuery(data.id);
    } finally {
      setPending(false);
    }
  }

  async function generate() {
    if (!brandId) {
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/prompts/generate`, { method: "POST" });
      const data = (await response.json()) as {
        prompts?: PromptDraft[];
        source?: "template" | "llm";
        error?: string;
      };
      if (!response.ok || !data.prompts) {
        setStatus(data.error ?? "Could not generate prompts.");
        return;
      }
      setPrompts(data.prompts);
      setSource(data.source ?? "template");
    } finally {
      setPending(false);
    }
  }

  async function savePrompts() {
    if (!brandId) {
      return;
    }
    const check = validatePromptSet(prompts, fields.name, { maxCount: promptCap });
    if (!check.ok) {
      setStatus(check.error);
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/prompts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Could not save prompts.");
        return;
      }
      setStep(3);
      await startRun(brandId);
    } finally {
      setPending(false);
    }
  }

  async function startRun(id: string) {
    const response = await fetch(`/api/brands/${id}/runs`, { method: "POST" });
    const data = (await response.json()) as {
      runId?: string;
      error?: string;
      engines?: Record<string, EngineState>;
    };
    if (!response.ok || !data.runId) {
      setStatus(data.error ?? "Could not queue the run.");
      return;
    }
    setRunId(data.runId);
    if (data.engines) setEngines(data.engines);
    poll(data.runId);
  }

  async function poll(id: string) {
    const response = await fetch(`/api/runs/${id}`);
    const data = (await response.json()) as {
      status?: string;
      engines?: Record<string, EngineState>;
      reportId?: string | null;
      scoreMentioned?: number | null;
      approvalState?: string | null;
      error?: string;
    };
    if (!response.ok) {
      setStatus(data.error ?? "Could not load run status.");
      return;
    }
    setRunStatus(data.status ?? "queued");
    setEngines(data.engines ?? null);
    if (data.reportId) setReportId(data.reportId);
    if (typeof data.scoreMentioned === "number") setScoreMentioned(data.scoreMentioned);
    applyApproval(data.approvalState);
    if (data.status === "complete" || data.status === "partial") {
      setReportReady(true);
      return;
    }
    if (data.status === "failed") {
      return;
    }
    window.setTimeout(() => void poll(id), 1200);
  }
  pollRef.current = poll;

  async function retryEngine(engine: string) {
    if (!runId) return;
    setRetrying(engine);
    setStatus(null);
    try {
      const response = await fetch(`/api/runs/${runId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine }),
      });
      const data = (await response.json()) as {
        status?: string;
        engines?: Record<string, EngineState>;
        reportId?: string | null;
        scoreMentioned?: number | null;
        approvalState?: string | null;
        error?: string;
      };
      if (!response.ok) {
        setStatus(data.error ?? "Could not retry that source.");
        return;
      }
      setRunStatus(data.status ?? "running");
      if (data.engines) setEngines(data.engines);
      if (data.reportId) setReportId(data.reportId);
      if (typeof data.scoreMentioned === "number") setScoreMentioned(data.scoreMentioned);
      applyApproval(data.approvalState);
      setReportReady(data.status === "complete" || data.status === "partial");
      if (data.status !== "complete" && data.status !== "partial" && data.status !== "failed") {
        poll(runId);
      }
    } finally {
      setRetrying(null);
    }
  }

  async function approveReport() {
    if (!allowApproval || !reportId) return false;
    setApproveBusy(true);
    setTestMessage(null);
    try {
      const response = await fetch(`/api/reports/${reportId}/approve`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setTestMessage(data.error ?? "Could not approve this report.");
        return false;
      }
      setApproved(true);
      setTestMessage("Report approved. You can send a test now.");
      return true;
    } finally {
      setApproveBusy(false);
    }
  }

  async function sendTest() {
    if (!allowSend || !reportId) return;
    if (allowApproval && !approved) {
      setTestMessage("Approve this report before sending.");
      return;
    }
    setTestBusy(true);
    setTestMessage(null);
    try {
      const response = await fetch(`/api/reports/${reportId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setTestMessage(data.error ?? "Could not send a test.");
        return;
      }
      setTestMessage("Test send queued to you.");
      finishOnboarding();
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-[560px] px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <Logo href="/app" />
        <div className="flex items-center gap-2">
          <Link href="/app" className="text-sm text-cb-muted" onClick={() => finishOnboarding()}>
            Cancel
          </Link>
          <SignOutButton />
        </div>
      </div>
      <ol className="mt-10 flex flex-wrap gap-3 text-xs text-cb-muted sm:gap-4">
        {steps.map((label, index) => {
          const n = index + 1;
          const current = step === n;
          const done = step > n;
          return (
            <li key={label} className={cn(current ? "text-cb-accent" : done ? "text-cb-text" : "text-cb-muted")}>
              <span className="font-mono tabular-nums">{n}</span> {label}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-cb-accent">Step {step} of 3</p>

      {step === 1 ? (
        <>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Add the brand</h1>
          <p className="mt-2 text-sm text-cb-muted">
            Six fields is enough: brand, site, buyer, incumbent, competitors, constraint. No vanity questions.
          </p>
          <div className="mt-8">
            <BrandFields values={fields} onChange={setFields} />
          </div>
          <div className="mt-8 flex justify-end">
            <Button type="button" onClick={() => void saveBrand()} disabled={pending || !fields.name}>
              Continue
            </Button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Confirm {promptCap} buyer questions</h1>
          <p className="mt-2 text-sm text-cb-muted">
            {source === "llm"
              ? "Generated from the writer. Edit before you run."
              : `Template pack. ${promptSetHint(promptCap)} Edit before you run.`}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" variant="outline" onClick={() => void generate()} disabled={pending}>
              {generatePromptsCta(promptCap, prompts.length > 0)}
            </Button>
          </div>
          <div className="mt-4">
            <IndustryPacks brandName={fields.name} promptCap={promptCap} onApply={setPrompts} />
          </div>
          <div className="mt-6">
            {prompts.length === 0 ? (
              <p className="text-sm text-cb-muted">
                Generate {promptCap} buyer questions, or apply an industry pack.
              </p>
            ) : (
              <PromptEditor
                prompts={prompts}
                brandName={fields.name}
                mixTarget={promptCap < 20 ? 1 : 4}
                onChange={setPrompts}
              />
            )}
          </div>
          <div className="mt-8 flex justify-end">
            <Button type="button" onClick={() => void savePrompts()} disabled={pending || prompts.length === 0}>
              Run
            </Button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            {reportReady
              ? "The first PDF is ready."
              : runStatus === "failed"
                ? "This report did not ship."
                : "Running this week's report"}
          </h1>
          {reportReady && scoreMentioned != null ? (
            <p className="mt-2 font-mono text-sm tabular-nums text-cb-accent">
              Named in {scoreMentioned} of {prompts.length || promptCap}
            </p>
          ) : null}
          {runStatus === "partial" ? (
            <p className="mt-3 text-sm text-cb-pending">The PDF still shipped. One source did not return.</p>
          ) : null}
          <div className="mt-8 space-y-3">
            {(engines && ENGINES.filter((e) => engines[e.id] && engines[e.id] !== "skipped").length
              ? ENGINES.filter((e) => engines![e.id] && engines![e.id] !== "skipped")
              : CORE_ENGINES
            ).map((engine) => {
              const state = engines?.[engine.id] ?? "queued";
              const pill =
                state === "complete" ? "complete" : state === "failed" ? "failed" : state === "running" ? "running" : "queued";
              return (
                <div
                  key={engine.id}
                  className="flex h-12 items-center justify-between gap-3 rounded-cb-card border border-cb-line bg-cb-surface px-4"
                >
                  <span className="text-sm">{engine.label}</span>
                  <div className="flex items-center gap-2">
                    {state === "failed" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={retrying !== null}
                        onClick={() => void retryEngine(engine.id)}
                      >
                        {retrying === engine.id ? "Retrying…" : "Retry"}
                      </Button>
                    ) : null}
                    <StatusPill status={pill}>{state[0].toUpperCase() + state.slice(1)}</StatusPill>
                  </div>
                </div>
              );
            })}
          </div>
          {reportReady && brandId ? (
            <div className="mt-8 flex flex-wrap gap-2">
              {reportId ? (
                <Button asChild>
                  <Link href={`/app/brands/${brandId}/reports/${reportId}`} onClick={() => finishOnboarding()}>
                    Open report
                  </Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href={`/app/brands/${brandId}`} onClick={() => finishOnboarding()}>
                    Brand home
                  </Link>
                </Button>
              )}
              {reportId && allowApproval ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={approveBusy || approved}
                  onClick={() => void approveReport()}
                >
                  {approveBusy ? "Approving…" : approved ? "Approved" : "Approve"}
                </Button>
              ) : null}
              {reportId && allowSend ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={testBusy || (allowApproval && !approved)}
                  onClick={() => void sendTest()}
                >
                  {testBusy ? "Sending…" : "Send test"}
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link href={`/app/brands/${brandId}`} onClick={() => finishOnboarding()}>
                  Brand home
                </Link>
              </Button>
            </div>
          ) : runStatus === "failed" && brandId ? (
            <div className="mt-8">
              <Button asChild>
                <Link href={`/app/brands/${brandId}`} onClick={() => finishOnboarding()}>
                  Back to brand
                </Link>
              </Button>
            </div>
          ) : (
            <p className="mt-6 text-sm text-cb-muted">
              {runStatus === "queued" ? "Queued. Sources start in a moment." : "Live status per source."}
              {runId ? ` Run ${runId.slice(0, 8)}.` : ""}
            </p>
          )}
          {testMessage ? <p className="mt-3 text-sm text-cb-muted">{testMessage}</p> : null}
          {reportReady && !allowSend ? (
            <div className="mt-6">
              <UpgradePrompt
                title={UPGRADE_COPY.sendStarter.title}
                body={UPGRADE_COPY.sendStarter.body}
                cta={UPGRADE_COPY.sendStarter.cta}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {status && !showBrandUpgrade ? <p className="mt-4 text-sm text-cb-danger">{status}</p> : null}
      <UpgradeDialog
        open={showBrandUpgrade}
        onOpenChange={setShowBrandUpgrade}
        title={brandUpgrade.title}
        body={status ?? brandUpgrade.body}
        cta={brandUpgrade.cta}
      />
    </div>
  );
}
