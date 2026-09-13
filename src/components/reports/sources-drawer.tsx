"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

export type AuditEngineRow = {
  promptId: string;
  promptText: string;
  engine: string;
  mentioned: boolean | null;
  createdAt: string | null;
  citedUrls: string[];
  rawAnswer: string | null;
  confidence: string | null;
  gatewayRequestId: string | null;
  status: string | null;
};

export function SourcesDrawer({
  rows,
  open,
  onOpenChange,
}: {
  rows: AuditEngineRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rawId, setRawId] = useState<string | null>(null);
  const grouped = new Map<string, AuditEngineRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.promptId) || [];
    list.push(row);
    grouped.set(row.promptId, list);
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/10 transition-opacity duration-150",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden={!open}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-cb-line bg-cb-surface shadow-[var(--cb-shadow-menu)] transition-transform duration-150 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="flex h-14 items-center justify-between border-b border-cb-line px-4">
          <div>
            <p className="text-sm font-medium text-cb-text">Sources / Audit</p>
            <p className="text-xs text-cb-muted">Per prompt × engine. Closed by default.</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {rows.length === 0 ? (
            <p className="text-sm text-cb-muted">No engine rows for this report yet.</p>
          ) : (
            <div className="space-y-6">
              {[...grouped.entries()].map(([promptId, engineRows]) => (
                <section key={promptId} className="space-y-3">
                  <p className="text-sm font-medium text-cb-text">{engineRows[0]?.promptText}</p>
                  {engineRows.map((row) => {
                    const key = `${row.promptId}:${row.engine}`;
                    const namedLabel =
                      row.mentioned == null ? "Pending" : row.mentioned ? "Named" : "Missing";
                    const namedStatus =
                      row.mentioned == null ? "running" : row.mentioned ? "named" : "missing";
                    return (
                      <div key={key} className="rounded-cb-control border border-cb-line bg-cb-bg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-cb-muted">
                            {row.engine}
                          </p>
                          <StatusPill status={namedStatus}>{namedLabel}</StatusPill>
                        </div>
                        {row.createdAt ? (
                          <p className="mt-1 font-mono text-[11px] tabular-nums text-cb-muted">
                            {row.createdAt}
                          </p>
                        ) : null}
                        {row.citedUrls.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {row.citedUrls.map((url) => (
                              <li key={url} className="truncate text-xs text-cb-accent">
                                <a href={url} target="_blank" rel="noreferrer">
                                  {url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-cb-muted">No source URLs captured.</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setRawId(rawId === key ? null : key)}
                          >
                            {rawId === key ? "Hide raw" : "View raw"}
                          </Button>
                          {row.confidence ? (
                            <span className="text-[11px] text-cb-muted">Confidence: {row.confidence}</span>
                          ) : null}
                          {row.gatewayRequestId ? (
                            <span className="font-mono text-[11px] text-cb-muted">
                              Gateway: {row.gatewayRequestId}
                            </span>
                          ) : null}
                        </div>
                        {rawId === key && row.rawAnswer ? (
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-cb-control border border-cb-line bg-cb-surface p-2 text-[11px] text-cb-muted">
                            {row.rawAnswer}
                          </pre>
                        ) : null}
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
