import type { EngineId } from "@/lib/engines";

export type ExtractedRow = {
  mentioned: boolean;
  recommended: boolean;
  rankInShortlist: number | null;
  citedUrls: string[];
  citedBrandUrl: boolean;
  whoWon: string;
  othersNamed: string[];
  sentence: string;
  nextAction: string;
};

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
  const brandRe = new RegExp(`\\b${escapeRegExp(args.brand)}\\b`, "i");
  const mentioned = brandRe.test(args.rawAnswer);
  const urls = findUrls(args.rawAnswer);
  const siteLabel = brandSiteLabel(args.siteUrl, args.brand);
  const brandHostHint = siteLabel.includes(" ")
    ? args.brand.toLowerCase().replace(/\s+/g, "-")
    : siteLabel.toLowerCase();
  const citedBrandUrl = urls.some((url) => url.toLowerCase().includes(brandHostHint));

  const namedOthers = args.competitors.filter((name) =>
    new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(args.rawAnswer),
  );

  let whoWon = namedOthers[0] ?? args.competitors[0] ?? "Unknown";
  const leadsMatch = args.rawAnswer.match(/([A-Z][A-Za-z0-9.&-]*)\s+leads/i);
  if (leadsMatch?.[1]) {
    whoWon = leadsMatch[1];
  }
  if (/leads this shortlist/i.test(args.rawAnswer) === false && /and leads/i.test(args.rawAnswer) && mentioned) {
    whoWon = args.brand;
  }
  if (new RegExp(`${escapeRegExp(args.brand)}.*leads`, "i").test(args.rawAnswer)) {
    whoWon = args.brand;
  }

  const shortlistMatch = args.rawAnswer.match(/Shortlist:\s*([^.]+)/i);
  const shortlist = shortlistMatch
    ? shortlistMatch[1]!.split(",").map((part) => part.trim()).filter(Boolean)
    : [];
  const rank = shortlist.findIndex((name) => name.toLowerCase() === args.brand.toLowerCase());
  const recommended = mentioned && (rank === 0 || whoWon.toLowerCase() === args.brand.toLowerCase());

  const sentence = mentioned
    ? clipSentence(`${args.brand} appears; ${whoWon} leads this buyer question.`)
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
    citedUrls: urls,
    citedBrandUrl,
    whoWon,
    othersNamed: namedOthers,
    sentence,
    nextAction,
  };
}
