"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ForwardablePrompt } from "@/components/reports/forwardable-prompt";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { CORE_ENGINES, ENGINES, softFailMinCore, type EngineState } from "@/lib/engines";

function isTerminal(status: string) {
  return status === "complete" || status === "partial" || status === "failed";
}

function isInFlight(status: string) {
  return status === "queued" || status === "running" || !status;
}

export function RunStatus({
  brandId,
  runId,
  initialStatus,
  initialEngines,
  focusPromptText = null,
}: {
  brandId: string;
  runId: string;
  initialStatus: string;
  initialEngines: Record<string, EngineState>;
  focusPromptText?: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [engines, setEngines] = useState(initialEngines);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoreMentioned, setScoreMentioned] = useState<number | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [pollTick, setPollTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    async function tick() {
      try {
        const response = await fetch(`/api/runs/${runId}`);
        const data = (await response.json()) as {
          status?: string;
          engines?: Record<string, EngineState>;
          reportId?: string | null;
          scoreMentioned?: number | null;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          // Stay calm — queue may still be working; don't flip to failed.
          attempt += 1;
          window.setTimeout(() => void tick(), Math.min(15_000, 2000 + attempt * 1000));
          return;
        }
        if (data.status) setStatus(data.status);
        if (data.engines) setEngines(data.engines);
        if (data.reportId) setReportId(data.reportId);
        if (typeof data.scoreMentioned === "number") setScoreMentioned(data.scoreMentioned);
        if (isTerminal(data.status ?? "")) return;
      } catch {
        if (cancelled) return;
      }
      attempt += 1;
      const delay = Math.min(12_000, 1500 + attempt * 500);
      window.setTimeout(() => void tick(), delay);
    }
    void tick();
    return () => {
      cancelled = true;
    };
  }, [runId, pollTick]);

  async function retryEngine(engine: string) {
    setRetrying(engine);
    setError(null);
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
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not retry that source.");
        return;
      }
      if (data.status) setStatus(data.status);
      if (data.engines) setEngines(data.engines);
      if (data.reportId) setReportId(data.reportId);
      if (typeof data.scoreMentioned === "number") setScoreMentioned(data.scoreMentioned);
      setPollTick((tick) => tick + 1);
    } finally {
      setRetrying(null);
    }
  }

  const done = status === "complete" || status === "partial";
  const waiting = isInFlight(status);
  const visible = ENGINES.filter((engine) => {
    const state = engines[engine.id];
    return state && state !== "skipped";
  });
  const list = visible.length > 0 ? visible : [...CORE_ENGINES];
  const scheduled = list.length;
  const coreComplete = list.filter((engine) => engines[engine.id] === "complete").length;
  const failedEngines = list.filter((engine) => engines[engine.id] === "failed");
  const minShip = softFailMinCore(scheduled);

  if (waiting) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold tracking-tight">Building this week’s report</h1>
        {focusPromptText ? (
          <div className="mt-4 rounded-cb-card border border-cb-accent bg-cb-surface px-4 py-3">
            <p className="text-xs text-cb-muted">Recheck focus</p>
            <p className="mt-1 text-sm text-cb-text">{focusPromptText}</p>
          </div>
        ) : null}
        <p className="mt-4 text-sm text-cb-text">
          Sources are running in the background. You can leave this page — we’ll email you when the report is
          ready.
        </p>
        <p className="mt-2 text-xs text-cb-muted">This page updates when the final result lands. No action needed.</p>
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href={`/app/brands/${brandId}`}>Back to brand</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold tracking-tight">
        {status === "failed" ? "This week’s report did not ship." : "This week’s report is ready."}
      </h1>
      {focusPromptText ? (
        <div className="mt-4 rounded-cb-card border border-cb-accent bg-cb-surface px-4 py-3">
          <p className="text-xs text-cb-muted">Recheck focus</p>
          <p className="mt-1 text-sm text-cb-text">{focusPromptText}</p>
        </div>
      ) : null}
      {done ? (
        <p className="mt-3 text-sm text-cb-text">
          {status === "partial" || coreComplete < scheduled
            ? failedEngines.length
              ? "The PDF still ships. Use Retry on a failed source — it does not use a recheck."
              : "The PDF still ships. One source did not return."
            : scoreMentioned != null
              ? `Named in ${scoreMentioned} buyer questions.`
              : "Open the report when you’re ready."}
        </p>
      ) : null}
      {status === "failed" || failedEngines.length ? (
        <p className="mt-2 text-xs text-cb-muted">
          Retry a failed source (free). Run now / recheck meters a new run.
        </p>
      ) : null}
      <div className="mt-6 space-y-3" aria-live="polite">
        {list.map((engine) => {
          const state = engines[engine.id] ?? "queued";
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
                <StatusPill status={pill}>{state[0]!.toUpperCase() + state.slice(1)}</StatusPill>
              </div>
            </div>
          );
        })}
      </div>
      {done && reportId ? (
        <>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/app/brands/${brandId}/reports/${reportId}`}>Open report</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/app/brands/${brandId}`}>Brand home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/api/brands/${brandId}/runs/${runId}/export?format=csv`}>CSV</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/api/brands/${brandId}/runs/${runId}/export`}>JSON</Link>
            </Button>
          </div>
          <div className="mt-6">
            <ForwardablePrompt runId={runId} />
          </div>
        </>
      ) : null}
      {done && !reportId ? (
        <p className="mt-8 text-sm text-cb-muted">Report is still writing. Refresh in a moment.</p>
      ) : null}
      {status === "failed" ? (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-cb-danger">
            Fewer than {minShip} source{minShip === 1 ? "" : "s"} returned, so this PDF did not ship. Retry a
            failed source first (free).
          </p>
          <Button asChild variant="outline">
            <Link href={`/app/brands/${brandId}`}>Brand home</Link>
          </Button>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-cb-danger">{error}</p> : null}
    </div>
  );
}
