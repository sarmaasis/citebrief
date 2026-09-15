import { formatShortDate } from "@/lib/friday";
import type { EngineId } from "@/lib/engines";
import { CORE_ENGINES, ENGINES } from "@/lib/engines";
import { isScoreIntent } from "@/lib/prompts";

export type PromptAgg = {
  promptId: string;
  promptText: string;
  sortOrder: number;
  intent?: string | null;
  branded?: boolean;
  byEngine: Partial<
    Record<
      EngineId,
      {
        mentioned: boolean;
        recommended?: boolean;
        whoWon: string | null;
        sentence: string | null;
        verbatim?: string | null;
        position?: number | null;
        sentiment?: string | null;
        nextAction: string | null;
        citedUrls: string[];
        citedBrandUrl?: boolean;
        competitorsNamed?: string[];
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
  filename: string;
};

export function clientBriefFilename(agency: string, client: string, date = new Date()): string {
  const clean = (value: string) =>
    value
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "Agency";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${clean(agency)}_${clean(client)}_AI-brief_${y}-${m}-${d}.pdf`;
}

const GSC_DISCLAIMER = "Do not add these mentions to Search Console totals.";

/** Reuses stored report copy. No extra model call (PRODUCT §18.2 / §22.3). */
export function suggestedClientEmail(args: { brand: string; summary: string; period?: string | null }) {
  const period = args.period?.trim();
  return {
    subject: `${args.brand}: this week's visibility report`,
    body: [
      args.summary.trim(),
      period ? `Period: week of ${period}.` : null,
      "Open the client link for the full report and five next actions.",
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

function isUnavailable(status: string | undefined) {
  return status === "failed" || status === "unavailable" || status === "skipped";
}

function promptNamed(agg: PromptAgg): boolean {
  return enginesForAgg(agg).some((engine) => {
    const cell = agg.byEngine[engine.id];
    return cell && !isUnavailable(cell.status) && cell.mentioned;
  });
}

function promptRecommended(agg: PromptAgg): boolean {
  return enginesForAgg(agg).some((engine) => {
    const cell = agg.byEngine[engine.id];
    return cell && !isUnavailable(cell.status) && cell.recommended;
  });
}

function isScorePrompt(agg: PromptAgg): boolean {
  if (agg.branded) return false;
  return isScoreIntent(agg.intent);
}

function primaryWhoWon(agg: PromptAgg): string {
  for (const engine of enginesForAgg(agg)) {
    const row = agg.byEngine[engine.id];
    if (row && !isUnavailable(row.status) && row.whoWon) {
      return row.whoWon;
    }
  }
  return "";
}

function primaryCited(agg: PromptAgg): { brandHit: boolean; urls: string[] } {
  const urls = enginesForAgg(agg).flatMap((engine) => agg.byEngine[engine.id]?.citedUrls ?? []);
  const brandHit = enginesForAgg(agg).some((engine) => agg.byEngine[engine.id]?.citedBrandUrl);
  return { brandHit, urls: [...new Set(urls)].slice(0, 3) };
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

function primaryVerbatim(agg: PromptAgg): string {
  for (const engine of enginesForAgg(agg)) {
    const row = agg.byEngine[engine.id];
    if (row?.verbatim) return row.verbatim;
  }
  return "";
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
  market?: string | null;
  trend?: Array<{ period: string; mentioned: number; recommended?: number; competitor?: string }>;
}): WrittenReport {
  const sorted = [...args.prompts].sort((a, b) => a.sortOrder - b.sortOrder);
  const scorePool = sorted.filter(isScorePrompt);
  const scored = scorePool.length ? scorePool : sorted.filter((row) => !row.branded);
  const scoreMentioned = scored.filter(promptNamed).length;
  const scoreRecommended = scored.filter(promptRecommended).length;
  const scoreTotal = scored.length || 1;
  const hole = scored.find((row) => !promptNamed(row));
  const holeWinner = hole ? (primaryWhoWon(hole) || args.competitors[0] || "a rival") : args.competitors[0] || "a rival";
  const summary = hole
    ? `${args.brand} was named in ${scoreMentioned} of ${scoreTotal} unbranded buyer questions this week. The biggest gap is "${hole.promptText}" — ${holeWinner} currently wins that shortlist.`
    : `${args.brand} appeared in all ${scoreTotal} scored buyer questions this week. The priority now is defending that position — keep comparison content and case studies updated so rivals do not reclaim ground next week.`;

  const losses = scored.filter((row) => !promptNamed(row)).slice(0, 5);
  const WHY_LABELS = [
    "Buyers shortlist from this question — not ranking here is costing pipeline.",
    "Comparison questions drive final decisions — this is where rivals win.",
    "Job questions show commercial intent; they should find you first.",
    "Switching signals show buyers are already looking.",
    "Incumbent gaps are where you take the slot next week.",
  ];
  const OWNER_LABELS = [
    "Content team",
    "Website / landing page",
    "PR / thought leadership",
    "Product marketing",
    "Account team",
  ];
  const priorities = (losses.length ? losses : scored.slice(0, 5)).slice(0, 5).map((row, index) => ({
    question: row.promptText,
    why: WHY_LABELS[index] ?? WHY_LABELS[0]!,
    action: primaryAction(row, args.brand),
    owner: OWNER_LABELS[index] ?? OWNER_LABELS[0]!,
  }));

  const engineIds = [...new Set(sorted.flatMap((row) => enginesForAgg(row).map((e) => e.id)))];
  const engineTableRows = ENGINES.filter((e) => engineIds.includes(e.id)).map((engine) => {
    const cells = scored
      .map((row) => row.byEngine[engine.id])
      .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));
    const live = cells.filter((c) => !isUnavailable(c.status));
    const n = live.length || 1;
    const mentionedPct = Math.round((live.filter((c) => c.mentioned).length / n) * 100);
    const citedPct = Math.round((live.filter((c) => c.citedBrandUrl || (c.citedUrls?.length ?? 0) > 0).length / n) * 100);
    const winners = live.map((c) => c.whoWon).filter(Boolean) as string[];
    const topSub =
      winners.sort((a, b) => winners.filter((w) => w === b).length - winners.filter((w) => w === a).length)[0] ||
      "—";
    const unavailable = cells.length > 0 && live.length === 0;
    return {
      label: engine.label,
      mentionedPct: unavailable ? null : mentionedPct,
      citedPct: unavailable ? null : citedPct,
      topSub: unavailable ? "unavailable" : topSub,
    };
  });

  const trend = args.trend ?? [];
  const deltaLine =
    trend.length > 1
      ? `Δ vs last run: named ${scoreMentioned - (trend[trend.length - 2]?.mentioned ?? scoreMentioned)}.`
      : "First brief — no trend yet.";

  const trendHtml =
    trend.length > 1
      ? `<section class="prompt">
  <h3>Eight-week named vs recommended</h3>
  <table>
    <thead><tr><th>Week</th><th>Named</th><th>Recommended</th></tr></thead>
    <tbody>
      ${trend
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.period)}</td><td>${row.mentioned}</td><td>${row.recommended ?? "—"}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>
</section>`
      : "";
  const dateLabel = formatShortDate(new Date());
  const accent = args.accentColor && /^#[0-9A-Fa-f]{6}$/.test(args.accentColor) ? args.accentColor : "#0B3D2E";
  const logoHtml = args.logoUrl
    ? `<img src="${escapeHtml(args.logoUrl)}" alt="" style="height:24px;object-fit:contain;" />`
    : "";
  const market = args.market?.trim() || "US";
  const nEngines = engineTableRows.length || 4;

  const partialBanner = args.partial
    ? `<p class="banner">Partial engine set returned. Numbers reflect available engines.</p>`
    : "";

  const engineTableHtml = `<table>
  <thead><tr><th>Engine</th><th>Mentioned</th><th>Cited</th><th>Who won</th></tr></thead>
  <tbody>
    ${engineTableRows
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.label)}</td><td>${row.mentionedPct == null ? "—" : `${row.mentionedPct}%`}</td><td>${row.citedPct == null ? "—" : `${row.citedPct}%`}</td><td>${escapeHtml(row.topSub)}</td></tr>`,
      )
      .join("")}
  </tbody>
</table>`;

  const lostHtml = scored
    .filter((row) => !promptNamed(row))
    .slice(0, 12)
    .map((row) => {
      const urls = primaryCited(row);
      const rival = urls.urls[0] ?? "";
      return `<tr>
  <td>${escapeHtml(row.promptText)}</td>
  <td>${escapeHtml(primaryWhoWon(row) || "—")}</td>
  <td class="meta">${rival ? escapeHtml(rival) : "—"}</td>
</tr>`;
    })
    .join("");

  const verbatimHtml = scored
    .slice(0, 8)
    .map((row) => {
      const v = primaryVerbatim(row);
      if (!v) return "";
      const urls = primaryCited(row);
      return `<section class="prompt">
  <h3>${escapeHtml(row.promptText)}</h3>
  <p>“${escapeHtml(v)}”</p>
  ${urls.urls[0] ? `<p class="meta">${escapeHtml(urls.urls[0])}</p>` : ""}
</section>`;
    })
    .join("");

  const competitorWins = scored
    .filter((row) => !promptNamed(row) && primaryWhoWon(row))
    .reduce<Record<string, number>>((acc, row) => {
      const name = primaryWhoWon(row);
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
  const competitorHtml = Object.entries(competitorWins)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => `<li><strong>${escapeHtml(name)}</strong> — ${count} buyer question${count === 1 ? "" : "s"}</li>`)
    .join("");

  const methodPrompts = sorted
    .map(
      (row) =>
        `<li><span class="meta">[${escapeHtml(row.intent || "discovery")}${row.branded ? ", branded" : ""}]</span> ${escapeHtml(row.promptText)}</li>`,
    )
    .join("");

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
  <title>${escapeHtml(args.brand)} · AI brief</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: Inter, system-ui, sans-serif; color: #171717; background: #FAFAF8; margin: 0; }
    .page { max-width: 720px; margin: 0 auto; padding: 0.7in; background: #FAFAF8; }
    h1 { font-size: 22px; margin: 24px 0 8px; }
    h2 { font-size: 16px; margin: 28px 0 8px; }
    .score { font-family: ui-monospace, monospace; font-size: 42px; color: ${accent}; margin: 16px 0; }
    .muted { color: #737373; font-size: 12px; }
    .meta { color: #737373; font-size: 12px; }
    .prompt { border-top: 1px solid #E8E6E1; padding: 16px 0; }
    .prompt h3 { font-size: 14px; margin: 0 0 8px; font-weight: 600; }
    .named { color: ${accent}; font-weight: 600; }
    .missing { color: #B45309; font-weight: 600; }
    .banner { background: #f6ead4; color: #B45309; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
    ol, ul { padding-left: 18px; }
    li { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; }
    th, td { text-align: left; padding: 6px 8px 6px 0; border-bottom: 1px solid #E8E6E1; vertical-align: top; }
    @media print {
      body { background: #fff; }
      .page { padding: 0.5in; max-width: 100%; }
      .prompt, li, table { page-break-inside: avoid; }
      h2 { page-break-before: always; }
      h2:first-of-type { page-break-before: avoid; }
    }
  </style>
</head>
<body>
  <article class="page">
    <div style="display:flex;align-items:center;gap:12px;min-height:24px;">${logoHtml}<p class="muted" style="margin:0">${escapeHtml(args.agency)}</p></div>
    <h1>${escapeHtml(args.brand)}</h1>
    <p class="muted">Week of ${escapeHtml(args.period)} · Market ${escapeHtml(market)} · n=${scoreTotal} prompts × ${nEngines} engines</p>
    <p class="muted">Presence / Prominence / Portrayal</p>
    <p class="score">${scoreMentioned}/${scoreTotal}</p>
    <p><strong>Named in ${scoreMentioned} of ${scoreTotal} scored buyer questions this week.</strong></p>
    <p><strong>Recommended in ${scoreRecommended} of ${scoreTotal}.</strong></p>
    <p class="meta">${escapeHtml(deltaLine)} Unbranded buyer questions only. Branded checks in appendix.</p>
    <p>${escapeHtml(summary)}</p>
    ${partialBanner}
    <h2>Per engine</h2>
    ${engineTableHtml}
    <h2>Lost buyer questions</h2>
    <table>
      <thead><tr><th>Question</th><th>Who won</th><th>Cited URL</th></tr></thead>
      <tbody>${lostHtml || `<tr><td colspan="3" class="meta">No losses in the scored set.</td></tr>`}</tbody>
    </table>
    <h2>Short verbatim + cited URL</h2>
    ${verbatimHtml || `<p class="meta">No verbatim excerpts stored for this run.</p>`}
    <h2>Competitors who took the slot</h2>
    <ul>${competitorHtml || `<li class="meta">No competitor took a scored slot this week.</li>`}</ul>
    <h2>Five actions</h2>
    <ol>${priorityHtml}</ol>
    ${trendHtml}
    <h2>Method appendix</h2>
    <p class="meta">Engines: ${engineTableRows.map((r) => escapeHtml(r.label)).join(", ")}. Prepared ${escapeHtml(dateLabel)}.</p>
    <ol>${methodPrompts}</ol>
    <p class="muted">${escapeHtml(GSC_DISCLAIMER)}</p>
    <p class="muted">Prepared by ${escapeHtml(args.agency)} · ${escapeHtml(dateLabel)}</p>
  </article>
</body>
</html>`;

  const pdfBytes = buildSimplePdf({
    agency: args.agency,
    brand: args.brand,
    period: args.period,
    market,
    scoreLine: `Named in ${scoreMentioned} of ${scoreTotal} scored buyer questions this week.`,
    recommendedLine: `Recommended in ${scoreRecommended} of ${scoreTotal}. ${deltaLine}`,
    summary,
    engineLines: engineTableRows.map(
      (row) =>
        `${row.label}: mention ${row.mentionedPct == null ? "—" : `${row.mentionedPct}%`}, cite ${row.citedPct == null ? "—" : `${row.citedPct}%`}, won by ${row.topSub}`,
    ),
    priorities: priorities.map((p) => `${p.action} (${p.owner})`),
    disclaimer: GSC_DISCLAIMER,
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
    filename: clientBriefFilename(args.agency, args.brand),
  };
}

/** Minimal multi-line PDF without external deps (Workers-safe). */
function buildSimplePdf(args: {
  agency: string;
  brand: string;
  period: string;
  market: string;
  scoreLine: string;
  recommendedLine?: string;
  summary: string;
  engineLines: string[];
  priorities: string[];
  disclaimer: string;
  dateLabel: string;
}): Uint8Array {
  const lines = [
    args.agency,
    `${args.brand} · Week of ${args.period} · ${args.market}`,
    "Presence / Prominence / Portrayal",
    args.scoreLine,
    args.recommendedLine || "",
    args.summary,
    "",
    "Per engine:",
    ...args.engineLines,
    "",
    "Five actions:",
    ...args.priorities.map((line, i) => `${i + 1}. ${line}`),
    "",
    args.disclaimer,
    `Prepared by ${args.agency} · ${args.dateLabel}`,
  ];

  const contentLines: string[] = ["BT", "/F1 10 Tf", "40 760 Td", "12 TL"];
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
