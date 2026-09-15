import { formatShortDate } from "@/lib/friday";
import type { EngineId } from "@/lib/engines";
import { CORE_ENGINES, ENGINES } from "@/lib/engines";

export type PromptAgg = {
  promptId: string;
  promptText: string;
  sortOrder: number;
  byEngine: Partial<
    Record<
      EngineId,
      {
        mentioned: boolean;
        recommended?: boolean;
        whoWon: string | null;
        sentence: string | null;
        nextAction: string | null;
        citedUrls: string[];
        status: string;
      }
    >
  >;
};

function enginesForAgg(agg: PromptAgg) {
  const present = ENGINES.filter((engine) => agg.byEngine[engine.id]);
  return present.length > 0 ? present : [...CORE_ENGINES];
}

export type WrittenReport = {
  scoreMentioned: number;
  scoreRecommended: number;
  scoreTotal: number;
  summary: string;
  priorities: Array<{ question: string; why: string; action: string; owner: string }>;
  html: string;
  pdfBytes: Uint8Array;
  suggestedEmailSubject: string;
  suggestedEmailBody: string;
};

/** Reuses stored report copy. No extra model call (PRODUCT §18.2 / §22.3). */
export function suggestedClientEmail(args: { brand: string; summary: string; period?: string | null }) {
  const period = args.period?.trim();
  return {
    subject: `${args.brand}: this week's visibility report`,
    body: [
      args.summary.trim(),
      period ? `Period: week of ${period}.` : null,
      "Open the client link for the full report and three next actions.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function promptNamed(agg: PromptAgg): boolean {
  return enginesForAgg(agg).some((engine) => agg.byEngine[engine.id]?.mentioned);
}

function promptRecommended(agg: PromptAgg): boolean {
  return enginesForAgg(agg).some((engine) => agg.byEngine[engine.id]?.recommended);
}

function primaryWhoWon(agg: PromptAgg): string {
  for (const engine of enginesForAgg(agg)) {
    const row = agg.byEngine[engine.id];
    if (row?.whoWon) {
      return row.whoWon;
    }
  }
  return "";
}

function primaryAction(agg: PromptAgg, brand: string): string {
  for (const engine of enginesForAgg(agg)) {
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
  accentColor?: string;
  logoUrl?: string;
}): WrittenReport {
  const sorted = [...args.prompts].sort((a, b) => a.sortOrder - b.sortOrder);
  const scoreMentioned = sorted.filter(promptNamed).length;
  const scoreRecommended = sorted.filter(promptRecommended).length;
  const scoreTotal = sorted.length || 20;
  const hole = sorted.find((row) => !promptNamed(row));
  const holeWinner = hole ? (primaryWhoWon(hole) || args.competitors[0] || "a rival") : args.competitors[0] || "a rival";
  const summary = hole
    ? `${args.brand} was named in ${scoreMentioned} of ${scoreTotal} buyer questions this week. The biggest gap is "${hole.promptText}" — ${holeWinner} currently wins that shortlist.`
    : `${args.brand} appeared in all ${scoreTotal} buyer questions this week. The priority now is defending that position — keep comparison content and case studies updated so rivals do not reclaim ground next week.`;

  const losses = sorted.filter((row) => !promptNamed(row)).slice(0, 3);
  const WHY_LABELS = [
    "Buyers shortlist from this question — not ranking here is costing pipeline.",
    "Comparison questions drive 30–40% of final decisions — this is where rivals win.",
    "Switching signals show buyers are already looking; they should find you first.",
  ];
  const OWNER_LABELS = ["Content team", "Website / landing page", "PR / thought leadership"];
  const priorities = (losses.length ? losses : sorted.slice(0, 3)).map((row, index) => ({
    question: row.promptText,
    why: WHY_LABELS[index] ?? WHY_LABELS[0]!,
    action: primaryAction(row, args.brand),
    owner: OWNER_LABELS[index] ?? OWNER_LABELS[0]!,
  }));

  const dateLabel = formatShortDate(new Date());
  const accent = args.accentColor && /^#[0-9A-Fa-f]{6}$/.test(args.accentColor) ? args.accentColor : "#0B3D2E";
  const logoHtml = args.logoUrl
    ? `<img src="${escapeHtml(args.logoUrl)}" alt="" style="height:24px;object-fit:contain;" />`
    : "";

  const partialBanner = args.partial
    ? `<p class="banner">Partial engine set returned. Numbers reflect available engines.</p>`
    : "";

  const promptBlocks = sorted
    .map((row) => {
      const engines = enginesForAgg(row).map((engine) => {
        const cell = row.byEngine[engine.id];
        if (!cell || cell.status === "failed") {
          return `<span>${engine.label}: -</span>`;
        }
        return `<span>${engine.label}: <span class="${cell.mentioned ? "named" : "missing"}">${cell.mentioned ? "Named" : "Missing"}</span></span>`;
      }).join(" · ");
      const urls = enginesForAgg(row).flatMap((engine) => row.byEngine[engine.id]?.citedUrls ?? []).slice(0, 2);
      return `<section class="prompt">
  <h3>${escapeHtml(row.promptText)}</h3>
  <p class="meta">${engines}</p>
  ${primaryWhoWon(row) ? `<p class="meta"><strong>Currently winning:</strong> ${escapeHtml(primaryWhoWon(row))}</p>` : ""}
  ${Object.values(row.byEngine).find((v) => v?.sentence)?.sentence ? `<p>${escapeHtml(Object.values(row.byEngine).find((v) => v?.sentence)?.sentence ?? "")}</p>` : ""}
  <p><strong>Next action:</strong> ${escapeHtml(primaryAction(row, args.brand))}</p>
  ${urls.length ? `<p class="meta">Cited: ${urls.map(escapeHtml).join(" · ")}</p>` : ""}
</section>`;
    })
    .join("\n");

  const priorityHtml = priorities
    .map(
      (item, i) => `<li>
  <strong>${i + 1}. ${escapeHtml(item.question)}</strong>
  <div class="meta" style="margin:4px 0 2px;">${escapeHtml(item.why)}</div>
  <div><strong>Action:</strong> ${escapeHtml(item.action)}</div>
  <div class="meta">Owner: ${escapeHtml(item.owner)}</div>
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
    .score { font-family: ui-monospace, monospace; font-size: 42px; color: ${accent}; margin: 16px 0; }
    .muted { color: #737373; font-size: 12px; }
    .meta { color: #737373; font-size: 12px; }
    .prompt { border-top: 1px solid #E8E6E1; padding: 16px 0; }
    .prompt h3 { font-size: 14px; margin: 0 0 8px; font-weight: 600; }
    .named { color: ${accent}; font-weight: 600; }
    .missing { color: #B45309; font-weight: 600; }
    .banner { background: #f6ead4; color: #B45309; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
    ol { padding-left: 18px; }
    li { margin-bottom: 12px; }
    @media print {
      body { background: #fff; }
      .page { padding: 0.5in; max-width: 100%; }
      .prompt { page-break-inside: avoid; }
      li { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <article class="page">
    <div style="display:flex;align-items:center;gap:12px;min-height:24px;">${logoHtml}<p class="muted" style="margin:0">${escapeHtml(args.agency)}</p></div>
    <h1>${escapeHtml(args.brand)}</h1>
    <p class="muted">Week of ${escapeHtml(args.period)}</p>
    <p class="score">${scoreMentioned}/${scoreTotal}</p>
    <p><strong>Named in ${scoreMentioned} of ${scoreTotal} buyer questions this week.</strong></p>
    <p><strong>Recommended in ${scoreRecommended} of ${scoreTotal}.</strong></p>
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
    recommendedLine: `Recommended in ${scoreRecommended} of ${scoreTotal}.`,
    summary,
    priorities: priorities.map((p) => `${p.action} (${p.owner})`),
    dateLabel,
  });

  const suggested = suggestedClientEmail({ brand: args.brand, summary, period: args.period });
  return {
    scoreMentioned,
    scoreRecommended,
    scoreTotal,
    summary,
    priorities,
    html,
    pdfBytes,
    suggestedEmailSubject: suggested.subject,
    suggestedEmailBody: suggested.body,
  };
}

/** Minimal multi-line PDF without external deps (Workers-safe). */
function buildSimplePdf(args: {
  agency: string;
  brand: string;
  period: string;
  scoreLine: string;
  recommendedLine?: string;
  summary: string;
  priorities: string[];
  dateLabel: string;
}): Uint8Array {
  const lines = [
    args.agency,
    `${args.brand} · Week of ${args.period}`,
    args.scoreLine,
    args.recommendedLine || "",
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
