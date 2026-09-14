"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { CORE_ENGINES, ENGINES, softFailMinCore, type EngineState } from "@/lib/engines";

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
    async function tick() {
      const response = await fetch(`/api/runs/${runId}`);
      const data = (await response.json()) as {
        status?: string;
        engines?: Record<string, EngineState>;
        reportId?: string | null;
        scoreMentioned?: number | null;
        error?: string;
      };
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setError(data.error ?? "Could not load run status.");
        return;
      }
      if (data.status) {
        setStatus(data.status);
      }
      if (data.engines) {
        setEngines(data.engines);
      }
      if (data.reportId) {
        setReportId(data.reportId);
      }
      if (typeof data.scoreMentioned === "number") {
        setScoreMentioned(data.scoreMentioned);
      }
      if (data.status !== "complete" && data.status !== "partial" && data.status !== "failed") {
        window.setTimeout(() => void tick(), 800);
      }
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
  const visible = ENGINES.filter((engine) => {
    const state = engines[engine.id];
    return state && state !== "skipped";
  });
  const list = visible.length > 0 ? visible : [...CORE_ENGINES];
  const scheduled = list.length;
  const coreComplete = list.filter((engine) => engines[engine.id] === "complete").length;
  const failedEngines = list.filter((engine) => engines[engine.id] === "failed");
  const minShip = softFailMinCore(scheduled);
  const canShip = done || coreComplete >= minShip;

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold tracking-tight">
        {status === "failed"
          ? "This week’s report did not ship."
          : done
            ? "This week’s report is ready."
            : "Running this week's report"}
      </h1>
      {focusPromptText ? (
        <div className="mt-4 rounded-cb-card border border-cb-accent bg-cb-surface px-4 py-3">
          <p className="text-xs text-cb-muted">Recheck focus</p>
          <p className="mt-1 text-sm text-cb-text">{focusPromptText}</p>
        </div>
      ) : null}
      {canShip && status !== "failed" ? (
        <p className="mt-3 text-sm text-cb-text">
          {status === "partial" || coreComplete === 3
            ? "The PDF still ships. One source did not return."
            : scoreMentioned != null
              ? `Named in ${scoreMentioned} buyer questions.`
              : "The PDF can ship from the sources that returned."}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-cb-muted">
        Retrying a failed source does not use another weekly run. The Friday report is included; extra full re-runs this week are $9.
      </p>
      <div className="mt-6 space-y-3" aria-live="polite">
        {list.map((engine) => {
          const state = engines[engine.id] ?? "queued";
          const pill =
            state === "complete"
              ? "complete"
              : state === "failed"
                ? "failed"
                : state === "running"
                  ? "running"
                  : "queued";
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
        <div className="mt-8 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/app/brands/${brandId}/reports/${reportId}`}>Open report</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/app/brands/${brandId}`}>Brand home</Link>
          </Button>
        </div>
      ) : null}
      {done && !reportId ? (
        <p className="mt-8 text-sm text-cb-muted">Report is still writing. Refresh in a moment.</p>
      ) : null}
      {status === "failed" ? (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-cb-danger">
            Fewer than {minShip} source{minShip === 1 ? "" : "s"} returned, so this PDF did not ship. Retry a
            failed source, or run again when ready.
          </p>
          {failedEngines.length ? (
            <p className="text-xs text-cb-muted">
              Failed: {failedEngines.map((engine) => engine.label).join(", ")}. Retry does not meter a new run.
            </p>
          ) : null}
          <Button asChild variant="outline">
            <Link href={`/app/brands/${brandId}`}>Run again from brand</Link>
          </Button>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-cb-danger">{error}</p> : null}
    </div>
  );
}
