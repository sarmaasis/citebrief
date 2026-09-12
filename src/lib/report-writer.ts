import { formatShortDate } from "@/lib/friday";
import type { EngineId } from "@/lib/engines";
import { ENGINES } from "@/lib/engines";

export type PromptAgg = {
  promptId: string;
  promptText: string;
  sortOrder: number;
  byEngine: Partial<
    Record<
      EngineId,
      {
        mentioned: boolean;
        whoWon: string | null;
        sentence: string | null;
        nextAction: string | null;
        citedUrls: string[];
        status: string;
      }
    >
  >;
};

export type WrittenReport = {
  scoreMentioned: number;
  scoreTotal: number;
  summary: string;
  priorities: Array<{ question: string; why: string; action: string; owner: string }>;
  html: string;
  pdfBytes: Uint8Array;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function promptNamed(agg: PromptAgg): boolean {
  return ENGINES.some((engine) => agg.byEngine[engine.id]?.mentioned);
}

function primaryWhoWon(agg: PromptAgg): string {
  for (const engine of ENGINES) {
    const row = agg.byEngine[engine.id];
    if (row?.whoWon) {
      return row.whoWon;
    }
  }
  return "Unknown";
}

function primaryAction(agg: PromptAgg, brand: string): string {
  for (const engine of ENGINES) {
    const row = agg.byEngine[engine.id];
    if (row?.nextAction) {
      return row.nextAction;
    }
  }
  return `Write a comparison page for the incumbent vs ${brand}`;
}

/**
 * Writer (Prompts §F) as a deterministic local implementation.
 * No GEO/AEO jargon in client-facing prose.
 */
export function writeReport(args: {
  agency: string;
  brand: string;
  period: string;
  competitors: string[];
  prompts: PromptAgg[];
  partial: boolean;
  failedEngines: string[];
}): WrittenReport {
  const sorted = [...args.prompts].sort((a, b) => a.sortOrder - b.sortOrder);
  const scoreMentioned = sorted.filter(promptNamed).length;
  const scoreTotal = sorted.length || 20;
  const hole = sorted.find((row) => !promptNamed(row));
  const holeWinner = hole ? primaryWhoWon(hole) : args.competitors[0] || "a rival";
  const summary = hole
    ? `${args.brand} was named in ${scoreMentioned} of ${scoreTotal} buyer questions this week. The biggest hole is "${hole.promptText}", where ${holeWinner} still wins the shortlist.`
    : `${args.brand} was named in ${scoreMentioned} of ${scoreTotal} buyer questions this week. Keep the comparison pages fresh so rivals do not reclaim the shortlist.`;

  const losses = sorted.filter((row) => !promptNamed(row)).slice(0, 3);
  const priorities = (losses.length ? losses : sorted.slice(0, 3)).map((row, index) => ({
    question: row.promptText,
    why: index === 0 ? "shortlist" : index === 1 ? "comparison" : "switch",
    action: primaryAction(row, args.brand),
    owner: index === 2 ? "PR" : index === 1 ? "site" : "content",
  }));

  const dateLabel = formatShortDate(new Date());
  const partialBanner = args.partial
    ? `<p class="banner">3 of 4 engines returned. Numbers reflect available engines.</p>`
    : "";

  const promptBlocks = sorted
    .map((row) => {
      const engines = ENGINES.map((engine) => {
        const cell = row.byEngine[engine.id];
        if (!cell || cell.status === "failed") {
          return `<span>${engine.label}: -</span>`;
        }
        return `<span>${engine.label}: ${cell.mentioned ? "Named" : "Missing"}</span>`;
      }).join(" · ");
      const urls = ENGINES.flatMap((engine) => row.byEngine[engine.id]?.citedUrls ?? []).slice(0, 2);
      return `<section class="prompt">
  <h3>${escapeHtml(row.promptText)}</h3>
  <p class="meta">${engines}</p>
  <p><strong>Who won:</strong> ${escapeHtml(primaryWhoWon(row))}</p>
  <p>${escapeHtml(Object.values(row.byEngine).find((v) => v?.sentence)?.sentence || "")}</p>
  <p><strong>Next action:</strong> ${escapeHtml(primaryAction(row, args.brand))}</p>
  ${urls.length ? `<p class="meta">Cited: ${urls.map(escapeHtml).join(" · ")}</p>` : ""}
</section>`;
    })
    .join("\n");

  const priorityHtml = priorities
    .map(
      (item, i) => `<li>
  <strong>${i + 1}. ${escapeHtml(item.question)}</strong>
  <div class="meta">Why it matters: ${escapeHtml(item.why)} · Owner: ${escapeHtml(item.owner)}</div>
  <div>${escapeHtml(item.action)}</div>
</li>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(args.brand)} · CiteBrief</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: Inter, system-ui, sans-serif; color: #171717; background: #FAFAF8; margin: 0; }
    .page { max-width: 720px; margin: 0 auto; padding: 0.7in; background: #FAFAF8; }
    h1 { font-size: 22px; margin: 24px 0 8px; }
    .score { font-family: ui-monospace, monospace; font-size: 42px; color: #0B3D2E; margin: 16px 0; }
    .muted { color: #737373; font-size: 12px; }
    .meta { color: #737373; font-size: 12px; }
    .prompt { border-top: 1px solid #E8E6E1; padding: 16px 0; }
    .prompt h3 { font-size: 14px; margin: 0 0 8px; font-weight: 600; }
    .banner { background: #f6ead4; color: #B45309; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
    ol { padding-left: 18px; }
    li { margin-bottom: 12px; }
  </style>
</head>
<body>
  <article class="page">
    <p class="muted">${escapeHtml(args.agency)}</p>
    <h1>${escapeHtml(args.brand)}</h1>
    <p class="muted">Week of ${escapeHtml(args.period)}</p>
    <p class="score">${scoreMentioned}/${scoreTotal}</p>
    <p><strong>Named in ${scoreMentioned} of ${scoreTotal} buyer questions this week.</strong></p>
    <p>${escapeHtml(summary)}</p>
    ${partialBanner}
    ${promptBlocks}
    <section class="prompt">
      <h3>Three priorities for the next 10 days</h3>
      <ol>${priorityHtml}</ol>
    </section>
    <p class="muted">Prepared by ${escapeHtml(args.agency)} · ${escapeHtml(dateLabel)}</p>
  </article>
</body>
</html>`;

  const pdfBytes = buildSimplePdf({
    agency: args.agency,
    brand: args.brand,
    period: args.period,
    scoreLine: `Named in ${scoreMentioned} of ${scoreTotal} buyer questions this week.`,
    summary,
    priorities: priorities.map((p) => `${p.action} (${p.owner})`),
    dateLabel,
  });

  return { scoreMentioned, scoreTotal, summary, priorities, html, pdfBytes };
}

/** Minimal multi-line PDF without external deps (Workers-safe). */
function buildSimplePdf(args: {
  agency: string;
  brand: string;
  period: string;
  scoreLine: string;
  summary: string;
  priorities: string[];
  dateLabel: string;
}): Uint8Array {
  const lines = [
    args.agency,
    `${args.brand} · Week of ${args.period}`,
    args.scoreLine,
    "",
    args.summary,
    "",
    "Priorities:",
    ...args.priorities.map((line, i) => `${i + 1}. ${line}`),
    "",
    `Prepared by ${args.agency} · ${args.dateLabel}`,
  ];

  const contentLines: string[] = ["BT", "/F1 11 Tf", "50 750 Td", "14 TL"];
  lines.forEach((line, index) => {
    const safe = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    if (index === 0) {
      contentLines.push(`(${safe}) Tj`);
    } else {
      contentLines.push("T*", `(${safe}) Tj`);
    }
  });
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const streamBytes = new TextEncoder().encode(stream);

  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
  );
  objects.push(
    `4 0 obj<< /Length ${streamBytes.byteLength} >>stream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [encoder.encode("%PDF-1.4\n")];
  const offsets: number[] = [0];
  let size = parts[0]!.byteLength;
  for (const obj of objects) {
    offsets.push(size);
    const bytes = encoder.encode(obj);
    parts.push(bytes);
    size += bytes.byteLength;
  }
  const xrefStart = size;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(encoder.encode(xref));
  const out = new Uint8Array(parts.reduce((n, part) => n + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
