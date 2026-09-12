"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { ENGINES, type EngineState } from "@/lib/engines";

export function RunStatus({
  brandId,
  runId,
  initialStatus,
  initialEngines,
}: {
  brandId: string;
  runId: string;
  initialStatus: string;
  initialEngines: Record<string, EngineState>;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [engines, setEngines] = useState(initialEngines);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const response = await fetch(`/api/runs/${runId}`);
      const data = (await response.json()) as {
        status?: string;
        engines?: Record<string, EngineState>;
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
      if (data.status !== "complete" && data.status !== "failed") {
        window.setTimeout(() => void tick(), 1200);
      }
    }
    if (initialStatus !== "complete" && initialStatus !== "failed") {
      void tick();
    }
    return () => {
      cancelled = true;
    };
  }, [runId, initialStatus]);

  const complete = status === "complete";
  const completeCount = ENGINES.filter((engine) => engines[engine.id] === "complete").length;

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold tracking-tight">
        {complete ? "CiteBrief finished the first PDF." : "Running this week's report"}
      </h1>
      {completeCount === 3 ? (
        <p className="mt-3 text-sm text-cb-pending">3 of 4 engines returned. PDF still ships.</p>
      ) : null}
      <div className="mt-6 space-y-3">
        {ENGINES.map((engine) => {
          const state = engines[engine.id] ?? "queued";
          const pill =
            state === "complete" ? "complete" : state === "failed" ? "failed" : state === "running" ? "running" : "queued";
          return (
            <div
              key={engine.id}
              className="flex h-12 items-center justify-between rounded-cb-card border border-cb-line bg-cb-surface px-4"
            >
              <span className="text-sm">
                {engine.label} · {state[0].toUpperCase() + state.slice(1)}
              </span>
              <StatusPill status={pill}>{state[0].toUpperCase() + state.slice(1)}</StatusPill>
            </div>
          );
        })}
      </div>
      {complete ? (
        <div className="mt-8 flex gap-2">
          <Button asChild>
            <Link href={`/app/brands/${brandId}`}>Open report</Link>
          </Button>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-cb-danger">{error}</p> : null}
    </div>
  );
}
