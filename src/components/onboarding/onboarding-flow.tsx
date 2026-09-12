"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandFields, emptyBrandFields, type BrandFieldValues } from "@/components/brands/brand-fields";
import { PromptEditor } from "@/components/prompts/prompt-editor";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { ENGINES, type EngineState } from "@/lib/engines";
import { type PromptDraft, validatePromptSet } from "@/lib/prompts";
import { Logo } from "@/components/brand/logo";

const steps = ["Brand", "Prompts", "Report"] as const;

export function OnboardingFlow() {
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

  async function saveBrand() {
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setStatus(data.error ?? "Could not save the brand.");
        return;
      }
      setBrandId(data.id);
      setStep(2);
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
    const check = validatePromptSet(prompts, fields.name);
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
      const data = (await response.json()) as { error?: string };
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
    const data = (await response.json()) as { runId?: string; error?: string };
    if (!response.ok || !data.runId) {
      setStatus(data.error ?? "Could not queue the run.");
      return;
    }
    setRunId(data.runId);
    poll(data.runId);
  }

  async function poll(id: string) {
    const response = await fetch(`/api/runs/${id}`);
    const data = (await response.json()) as {
      status?: string;
      engines?: Record<string, EngineState>;
      error?: string;
    };
    if (!response.ok) {
      setStatus(data.error ?? "Could not load run status.");
      return;
    }
    setRunStatus(data.status ?? "queued");
    setEngines(data.engines ?? null);
    if (data.status === "complete") {
      setReportReady(true);
      return;
    }
    window.setTimeout(() => void poll(id), 1200);
  }

  return (
    <div className="mx-auto min-h-screen max-w-[560px] px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo href="/app" />
        <Link href="/login" className="text-sm text-cb-muted">
          Sign out
        </Link>
      </div>
      <p className="mt-10 text-xs text-cb-muted">
        {steps.map((label, index) => (
          <span key={label}>
            {index + 1} {label}
            {index < steps.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>
      <p className="mt-2 text-xs text-cb-accent">Step {step} of 3</p>

      {step === 1 ? (
        <>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Add the brand</h1>
          <p className="mt-2 text-sm text-cb-muted">
            Buyer questions only. No vanity &quot;does ChatGPT mention us&quot; prompts.
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
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Confirm twenty buyer questions</h1>
          <p className="mt-2 text-sm text-cb-muted">
            {source === "llm"
              ? "Generated from the writer. Edit before you run."
              : "Template pack from the 4+4+4+4+4 mix. Edit before you run."}
          </p>
          <div className="mt-6 flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" variant="outline" onClick={() => void generate()} disabled={pending}>
              {prompts.length ? "Regenerate 20 prompts" : "Generate 20 prompts"}
            </Button>
          </div>
          <div className="mt-6">
            {prompts.length === 0 ? (
              <p className="text-sm text-cb-muted">Generate twenty buyer questions for this brand.</p>
            ) : (
              <PromptEditor prompts={prompts} brandName={fields.name} onChange={setPrompts} />
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
            {reportReady ? "CiteBrief finished the first PDF." : "Running this week's report"}
          </h1>
          <div className="mt-8 space-y-3">
            {ENGINES.map((engine) => {
              const state = engines?.[engine.id] ?? "queued";
              const pill =
                state === "complete" ? "complete" : state === "failed" ? "failed" : state === "running" ? "running" : "queued";
              return (
                <div
                  key={engine.id}
                  className="flex h-12 items-center justify-between rounded-cb-card border border-cb-line bg-cb-surface px-4"
                >
                  <span className="text-sm">{engine.label}</span>
                  <StatusPill status={pill}>{state[0].toUpperCase() + state.slice(1)}</StatusPill>
                </div>
              );
            })}
          </div>
          {reportReady && brandId ? (
            <div className="mt-8 flex gap-2">
              <Button asChild>
                <Link href={`/app/brands/${brandId}`}>Brand home</Link>
              </Button>
            </div>
          ) : (
            <p className="mt-6 text-sm text-cb-muted">
              {runStatus === "queued" ? "Queued. Engines start in a moment." : "Live status per engine."}
              {runId ? ` Run ${runId.slice(0, 8)}.` : ""}
            </p>
          )}
        </>
      ) : null}

      {status ? <p className="mt-4 text-sm text-cb-danger">{status}</p> : null}
    </div>
  );
}
