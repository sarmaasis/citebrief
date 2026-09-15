import type { EngineId } from "@/lib/engines";

/** Cap raw engine text before extract (APP-UPDATES / PAIN P0). */
export const RAW_ANSWER_MAX_CHARS = 3000;

export type ExtractedRow = {
  mentioned: boolean;
  recommended: boolean;
  rankInShortlist: number | null;
  position: number | null;
  sentiment: "positive" | "mixed" | "negative" | "n/a";
  citedUrls: string[];
  citedBrandUrl: boolean;
  whoWon: string;
  othersNamed: string[];
  /** Alias of othersNamed for export / product schema. */
  competitorsNamed: string[];
  sentence: string;
  verbatim: string;
  nextAction: string;
};

export function clipRawAnswer(raw: string, max = RAW_ANSWER_MAX_CHARS): string {
  return raw.length <= max ? raw : raw.slice(0, max);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)]+/g) ?? [];
  return [...new Set(matches)].slice(0, 5);
}

function clipSentence(text: string, maxWords = 20): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  return `${words.slice(0, maxWords).join(" ")}.`;
}

function evidenceSentence(text: string, brand: string, competitors: string[]) {
  const names = [brand, ...competitors].filter(Boolean);
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    sentences.find((line) => names.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(line))) ??
    sentences[0] ??
    ""
  ).slice(0, 280);
}

function answerSentiment(args: {
  mentioned: boolean;
  recommended: boolean;
  brand: string;
  rawAnswer: string;
}): ExtractedRow["sentiment"] {
  if (!args.mentioned) return "n/a";
  if (args.recommended) return "positive";
  if (new RegExp(`${escapeRegExp(args.brand)}.{0,80}\\b(not|missing|behind|weaker|expensive|limited)\\b`, "i").test(args.rawAnswer)) {
    return "negative";
  }
  if (new RegExp(`${escapeRegExp(args.brand)}.{0,80}\\b(but|however|although|mixed)\\b`, "i").test(args.rawAnswer)) {
    return "mixed";
  }
  return "mixed";
}

/** Hostname for customer-facing copy; never invents `.example` placeholders. */
export function brandSiteLabel(siteUrl: string | null | undefined, brand: string): string {
  const raw = siteUrl?.trim();
  if (raw) {
    try {
      const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const host = new URL(withProtocol).hostname.replace(/^www\./i, "");
      if (host) {
        return host;
      }
    } catch {
      // Invalid URL — fall through to brand wording.
    }
  }
  return `the ${brand} site`;
}

const NEXT_ACTIONS = [
  (brand: string, incumbent: string) => `Write a comparison page for ${incumbent} vs ${brand}`,
  (brand: string, _incumbent: string, category: string) =>
    `Publish a "best ${category} for agencies" page with pricing table`,
  (_brand: string, _incumbent: string, _category: string, domain: string) =>
    `Earn a mention on ${domain}`,
  (_brand: string, _incumbent: string, _category: string, _domain: string, siteLabel: string) =>
    `Fix the pricing / integrations section on ${siteLabel}`,
  (_brand: string, _incumbent: string, category: string) => `Get listed on G2 ${category} category`,
] as const;

/**
 * Cheap deterministic extractor (Prompts §E). Workers AI later.
 * Mention and citation are separate: a cited URL without a bold name still counts as citation.
 */
export function extractFromAnswer(args: {
  brand: string;
  competitors: string[];
  prompt: string;
  engine: EngineId;
  rawAnswer: string;
  incumbent?: string | null;
  category?: string | null;
  siteUrl?: string | null;
}): ExtractedRow {
  const rawAnswer = clipRawAnswer(args.rawAnswer);
  const brandRe = new RegExp(`\\b${escapeRegExp(args.brand)}\\b`, "i");
  const mentioned = brandRe.test(rawAnswer);
  const urls = findUrls(rawAnswer);
  const siteLabel = brandSiteLabel(args.siteUrl, args.brand);
  const brandHostHint = siteLabel.includes(" ")
    ? args.brand.toLowerCase().replace(/\s+/g, "-")
    : siteLabel.toLowerCase();
  const citedBrandUrl = urls.some((url) => url.toLowerCase().includes(brandHostHint));

  const namedOthers = args.competitors.filter((name) =>
    new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(rawAnswer),
  );

  let whoWon = namedOthers[0] ?? args.competitors[0] ?? "Unknown";
  const leadsMatch = rawAnswer.match(/([A-Z][A-Za-z0-9.&-]*)\s+leads/i);
  if (leadsMatch?.[1]) {
    whoWon = leadsMatch[1];
  }
  if (/leads this shortlist/i.test(rawAnswer) === false && /and leads/i.test(rawAnswer) && mentioned) {
    whoWon = args.brand;
  }
  if (new RegExp(`${escapeRegExp(args.brand)}.*leads`, "i").test(rawAnswer)) {
    whoWon = args.brand;
  }

  const shortlistMatch = rawAnswer.match(/Shortlist:\s*([^.]+)/i);
  const shortlist = shortlistMatch
    ? shortlistMatch[1]!.split(",").map((part) => part.trim()).filter(Boolean)
    : [];
  const rank = shortlist.findIndex((name) => name.toLowerCase() === args.brand.toLowerCase());
  const recommended = mentioned && (rank === 0 || whoWon.toLowerCase() === args.brand.toLowerCase());
  const sentiment = answerSentiment({ mentioned, recommended, brand: args.brand, rawAnswer });

  const sentence = mentioned
    ? clipSentence(`${args.brand} appears; ${whoWon} leads this buyer question.`)
    : citedBrandUrl
      ? clipSentence(`${args.brand} site is cited; ${whoWon} still leads the shortlist.`)
      : clipSentence(`${args.brand} is missing; ${whoWon} wins this buyer question.`);

  const incumbent = args.incumbent || args.competitors[0] || "the incumbent";
  const category = args.category || "software";
  const domain = urls[0]?.replace(/^https?:\/\//, "").split("/")[0] || "g2.com";
  const actionFn = NEXT_ACTIONS[Math.abs(args.prompt.length + args.engine.length) % NEXT_ACTIONS.length]!;
  const nextAction = mentioned
    ? `Fix the pricing / integrations section on ${siteLabel}`
    : actionFn(args.brand, incumbent, category, domain, siteLabel);

  return {
    mentioned,
    recommended,
    rankInShortlist: rank >= 0 ? rank + 1 : null,
    position: rank >= 0 ? rank + 1 : null,
    sentiment,
    citedUrls: urls,
    citedBrandUrl,
    whoWon,
    othersNamed: namedOthers,
    competitorsNamed: namedOthers,
    sentence,
    verbatim: evidenceSentence(rawAnswer, args.brand, args.competitors),
    nextAction,
  };
}
